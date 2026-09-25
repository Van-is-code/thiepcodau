const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize, CtvProfile, Wallet, PayoutRequest, User, AppSetting
} = require('../models');
const walletService = require('./walletService');
const disbursement = require('./payoutDisbursementService');
const collectionService = require('./collectionService');
const auditService = require('./auditService');
const notifyService = require('./notifyService');
const { roundVnd } = require('../utils/money');

const ctvNameById = async (ctvId) => {
  const c = await CtvProfile.findByPk(ctvId, { attributes: ['display_name'] }).catch(() => null);
  return c ? c.display_name : null;
};

const publicRequest = (r) => ({
  id: r.id,
  ctv_id: r.ctv_id,
  amount: roundVnd(r.amount),
  type: r.type,
  status: r.status,
  requested_by: r.requested_by,
  note: r.note,
  admin_note: r.admin_note,
  payment_reference: r.payment_reference,
  approved_at: r.approved_at,
  rejected_at: r.rejected_at,
  period_start: r.period_start,
  period_end: r.period_end,
  created_at: r.created_at,
  // ----- Chi hộ payOS -----
  provider: r.provider || 'manual',
  provider_state: r.provider_state || null,
  provider_payout_id: r.provider_payout_id || null,
  provider_reference: r.provider_reference || null,
  failure_reason: r.failure_reason || null,
  disbursed_at: r.disbursed_at || null
});

const startOfWeekAgo = () => new Date(Date.now() - 7 * 24 * 3600 * 1000);

// ---------------- Chính sách rút tiền (toàn hệ) ----------------
//
// Lưu chung một dòng app_settings với cấu hình quét tự động, vì cùng là "luật rút
// tiền" và tránh phải thêm bảng mới.
//
// min_payout_amount là SÀN CỦA NỀN TẢNG. Mỗi CTV còn có mức riêng
// (auto_payout_min_amount) — mức riêng chỉ được CAO HƠN sàn, không được thấp hơn.
// Nếu để CTV tự hạ xuống 0 thì cái sàn chẳng còn nghĩa gì: ai cũng rút 10 nghìn
// một lần, phí chuyển khoản và công đối soát ăn hết phần lãi.
const POLICY_KEY = 'auto_payout';
// Giá trị ban đầu lấy từ biến môi trường, nhưng CHỈ cho lần đầu. Sau đó admin
// chỉnh trên trang quản trị và giá trị nằm trong CSDL — đổi cách chi tiền không
// còn phải sửa .env rồi dựng lại cả hệ thống.
const POLICY_MAC_DINH = {
  default_weekday: 1,
  run_hour: 9,
  min_payout_amount: 0,
  last_run_date: null,

  // Có tự quét ví theo lịch tuần để TẠO SẴN phiếu rút không.
  auto_sweep_enabled: String(process.env.AUTO_PAYOUT_ENABLED || 'false').toLowerCase() === 'true',

  // Duyệt phiếu xong thì tiền đi kiểu nào:
  //   manual = hệ thống chỉ chốt sổ, ADMIN TỰ CHUYỂN KHOẢN rồi ghi mã giao dịch
  //   payos  = gọi API chi hộ payOS, tiền đi luôn
  payout_mode: String(process.env.PAYOUT_MODE || 'manual').toLowerCase() === 'payos' ? 'payos' : 'manual',
};

const PAYOUT_MODES = ['manual', 'payos'];

const getPolicy = async () => {
  const row = await AppSetting.findByPk(POLICY_KEY);
  return { ...POLICY_MAC_DINH, ...((row && row.value) || {}) };
};

// Ngưỡng thật sự áp cho một CTV: lấy cái CAO HƠN giữa sàn nền tảng và mức riêng.
const effectiveMin = (ctv, policy) => Math.max(
  roundVnd((policy && policy.min_payout_amount) || 0) || 0,
  roundVnd((ctv && ctv.auto_payout_min_amount) || 0) || 0
);

// Tách riêng phần kiểm tham số để kiểm thử được mà không cần CSDL.
// Chỉ nhận đúng khoá mình hiểu: gửi kèm last_run_date hay khoá lạ đều bị bỏ qua,
// không cho ghi đè trạng thái nội bộ của bộ quét.
const MUC_RUT_TOI_DA = 50000000;

const validatePolicy = (body = {}, truoc = POLICY_MAC_DINH) => {
  const sau = { ...truoc };

  if (body.min_payout_amount !== undefined) {
    const v = roundVnd(body.min_payout_amount);
    if (!Number.isFinite(v) || v < 0) { const e = new Error('Mức rút tối thiểu không hợp lệ'); e.status = 400; throw e; }
    // Chặn con số vô lý: đặt sàn 100 triệu là khoá cứng mọi CTV mà không ai nhận ra.
    if (v > MUC_RUT_TOI_DA) {
      const e = new Error(`Mức rút tối thiểu không được quá ${MUC_RUT_TOI_DA.toLocaleString('vi-VN')}đ`);
      e.status = 400; throw e;
    }
    sau.min_payout_amount = v;
  }
  if (body.default_weekday !== undefined) {
    const wd = Number.parseInt(body.default_weekday, 10);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) { const e = new Error('Thứ trong tuần phải 0..6 (0 = Chủ nhật)'); e.status = 400; throw e; }
    sau.default_weekday = wd;
  }
  if (body.run_hour !== undefined) {
    const h = Number.parseInt(body.run_hour, 10);
    if (!Number.isInteger(h) || h < 0 || h > 23) { const e = new Error('Giờ chạy phải 0..23'); e.status = 400; throw e; }
    sau.run_hour = h;
  }

  if (body.auto_sweep_enabled !== undefined) {
    sau.auto_sweep_enabled = body.auto_sweep_enabled === true || body.auto_sweep_enabled === 'true';
  }

  if (body.payout_mode !== undefined) {
    const m = String(body.payout_mode).toLowerCase();
    if (!PAYOUT_MODES.includes(m)) {
      const e = new Error('Cách chi tiền chỉ nhận manual hoặc payos'); e.status = 400; throw e;
    }
    // Bật chi tự động mà chưa có khoá payOS thì lệnh chi sẽ trả 503 ngay lần
    // duyệt đầu — chặn ở đây để admin biết trước, đừng để phát hiện lúc đang
    // trả tiền cho cộng tác viên.
    if (m === 'payos' && !disbursement.isConfigured()) {
      const e = new Error(
        'Chưa cấu hình khoá chi hộ payOS (PAYOS_PAYOUT_CLIENT_ID / API_KEY / CHECKSUM_KEY). '
        + 'Điền khoá rồi mới bật được chi tiền tự động.'
      );
      e.status = 400; throw e;
    }
    sau.payout_mode = m;
  }

  return sau;
};

const updatePolicy = async (body = {}, { adminUserId = null, ip = null } = {}) => {
  const truoc = await getPolicy();
  const sau = validatePolicy(body, truoc);

  const [row] = await AppSetting.findOrCreate({
    where: { key: POLICY_KEY },
    defaults: { key: POLICY_KEY, value: sau, updated_at: new Date() }
  });
  row.value = sau;
  row.updated_at = new Date();
  await row.save();

  await auditService.log({
    actorType: 'admin', actorId: adminUserId,
    action: 'payout.policy.update', entityType: 'app_setting', entityId: POLICY_KEY,
    oldValue: truoc, newValue: sau, ip
  });

  return sau;
};

// Số CTV sẽ bị chặn nếu áp mức sàn này — để admin thấy hậu quả trước khi bấm lưu.
const policyImpact = async (minAmount) => {
  const min = roundVnd(minAmount) || 0;
  const ctvs = await CtvProfile.findAll({
    where: { status: 'active' },
    attributes: ['id', 'display_name', 'auto_payout_min_amount'],
    include: [{ model: Wallet, as: 'wallet', attributes: ['balance'], required: false }]
  });
  let duoi_nguong = 0;
  for (const c of ctvs) {
    const bal = roundVnd((c.wallet && c.wallet.balance) || 0);
    if (bal > 0 && bal < min) duoi_nguong += 1;
  }
  return { tong_ctv: ctvs.length, ctv_duoi_nguong: duoi_nguong };
};

// ---------------- CTV tạo phiếu rút thủ công ----------------
const createRequest = async (ctv, { amount, note = null, type = 'manual', requestedBy = 'ctv', allowBelowMin = false }, ctx = {}) => {
  if (ctv.status !== 'active') { const e = new Error('Tài khoản CTV đang bị khoá'); e.status = 403; throw e; }
  const value = roundVnd(amount);
  if (!Number.isFinite(value) || value <= 0) { const e = new Error('Số tiền rút phải lớn hơn 0'); e.status = 400; throw e; }

  // Ngưỡng tối thiểu kiểm ở ĐÂY chứ không phải ở giao diện: mọi đường tạo phiếu
  // (CTV tự bấm, admin tạo hộ, cron quét) đều đi qua hàm này. Chặn ở form là chặn
  // cho vui — gọi thẳng API là lọt.
  if (!allowBelowMin) {
    const min = effectiveMin(ctv, await getPolicy());
    if (min > 0 && value < min) {
      const e = new Error(`Số tiền rút tối thiểu là ${min.toLocaleString('vi-VN')}đ (bạn yêu cầu ${value.toLocaleString('vi-VN')}đ)`);
      e.status = 400; throw e;
    }
  }

  const result = await sequelize.transaction(async (transaction) => {
    const wallet = await walletService.lockedWallet(ctv.id, transaction);

    const pendingCount = await PayoutRequest.count({ where: { ctv_id: ctv.id, status: 'pending' }, transaction });
    if (pendingCount > 0) {
      const e = new Error('Bạn đang có 1 phiếu rút chờ duyệt. Vui lòng đợi admin xử lý xong.');
      e.status = 409; throw e;
    }
    if (value > roundVnd(wallet.balance)) {
      const e = new Error(`Số dư khả dụng không đủ (còn ${roundVnd(wallet.balance).toLocaleString('vi-VN')}đ)`);
      e.status = 400; throw e;
    }

    const request = await PayoutRequest.create({
      id: randomUUID(),
      ctv_id: ctv.id,
      wallet_id: wallet.id,
      amount: value,
      type,
      status: 'pending',
      requested_by: requestedBy,
      note,
      period_start: type === 'auto' ? startOfWeekAgo() : null,
      period_end: type === 'auto' ? new Date() : null,
      created_at: new Date(),
      updated_at: new Date()
    }, { transaction });

    const holdTxn = await walletService.holdForPayout(ctv.id, {
      payoutRequestId: request.id,
      amount: value,
      note: `Giữ tiền phiếu rút ${request.id}`,
      createdBy: requestedBy === 'system' ? 'cron' : 'system'
    }, { transaction });

    request.hold_txn_id = holdTxn.id;
    await request.save({ transaction });

    await auditService.log({
      actorType: requestedBy === 'system' ? 'system' : 'ctv',
      actorId: ctx.actorId || null,
      action: 'payout.request', entityType: 'payout_request', entityId: request.id,
      newValue: { amount: value, type }, ip: ctx.ip || null
    }, { transaction });

    return publicRequest(request);
  });

  notifyService.payoutRequested({ request: result, ctv });
  return result;
};

const listForCtv = async (ctvId, { status, page = 1, limit = 20 } = {}) => {
  const where = { ctv_id: ctvId };
  if (status) where.status = status;
  const offset = (page - 1) * limit;
  const { count, rows } = await PayoutRequest.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset
  });
  return {
    items: rows.map(publicRequest),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

const cancelByCtv = async (requestId, ctv, ctx = {}) => {
  const result = await sequelize.transaction(async (transaction) => {
    const request = await PayoutRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request || String(request.ctv_id) !== String(ctv.id)) {
      const e = new Error('Không tìm thấy phiếu rút'); e.status = 404; throw e;
    }
    if (request.status !== 'pending') {
      const e = new Error(`Chỉ huỷ được phiếu đang chờ duyệt (phiếu đang ${request.status})`); e.status = 400; throw e;
    }
    await walletService.releaseHold(ctv.id, {
      payoutRequestId: request.id, amount: request.amount,
      note: `Nhả tiền — CTV huỷ phiếu ${request.id}`, createdBy: 'admin'
    }, { transaction });
    request.status = 'cancelled';
    request.updated_at = new Date();
    await request.save({ transaction });
    await auditService.log({
      actorType: 'ctv', actorId: ctx.actorId || null,
      action: 'payout.cancel', entityType: 'payout_request', entityId: request.id, ip: ctx.ip || null
    }, { transaction });
    return publicRequest(request);
  });

  notifyService.payoutCancelled({ request: result, ctvName: ctv.display_name });
  return result;
};

// ---------------- Admin ----------------
const listForAdmin = async ({ status, ctvId, page = 1, limit = 30 } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (ctvId) where.ctv_id = ctvId;
  const offset = (page - 1) * limit;
  const { count, rows } = await PayoutRequest.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset,
    include: [{ model: CtvProfile, as: 'ctv', attributes: ['id', 'display_name', 'bank_name', 'bank_account_number', 'bank_account_name'] }]
  });
  return {
    items: rows.map((r) => ({ ...publicRequest(r), ctv: r.ctv })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

// Duyệt phiếu rút.
//
//   mode = 'manual' : admin tự chuyển khoản, hệ thống chỉ ghi nhận (hành vi cũ).
//   mode = 'payos'  : CHI HỘ tự động — payOS chuyển thẳng vào tài khoản CTV.
//
// Thứ tự cố ý: ghi DB TRƯỚC (chốt ví, đánh dấu đang xử lý), gọi payOS SAU khi
// transaction đã commit. Xem ghi chú đầu payoutDisbursementService.js.
const approve = async (requestId, { paymentReference, adminNote, adminUserId, ip, mode } = {}) => {
  // Cách chi tiền đọc từ cài đặt trên trang quản trị, không đọc .env nữa —
  // đổi cách chi không còn phải dựng lại hệ thống. Tham số mode vẫn thắng, để
  // admin ép riêng một phiếu mà không đụng cài đặt chung.
  const cheDo = mode || (await getPolicy()).payout_mode || 'manual';
  const useProvider = String(cheDo).toLowerCase() === 'payos';

  // --- Giai đoạn 1: khoá phiếu, chốt ví, đánh dấu trạng thái (trong transaction) ---
  const prepared = await sequelize.transaction(async (transaction) => {
    const request = await PayoutRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) { const e = new Error('Không tìm thấy phiếu rút'); e.status = 404; throw e; }
    if (request.status !== 'pending') {
      const e = new Error(`Phiếu đã ${request.status}, không thể duyệt lại`); e.status = 400; throw e;
    }

    const ctv = await CtvProfile.findByPk(request.ctv_id, { transaction });
    if (!ctv) { const e = new Error('Không tìm thấy hồ sơ CTV'); e.status = 404; throw e; }
    if (useProvider) disbursement.assertPayoutReady(ctv);

    // Tiền đã rời ví lúc hold -> chỉ dịch pending_balance -> total_paid.
    await walletService.settlePayout(request.ctv_id, { amount: request.amount }, { transaction });

    request.status = 'approved';
    request.payment_reference = paymentReference || null;
    request.admin_note = adminNote || null;
    request.approved_by = adminUserId || null;
    request.approved_at = new Date();
    request.provider = useProvider ? 'payos' : 'manual';
    // Chi hộ tự động: chưa biết kết quả -> 'processing'. Thủ công: admin đã chuyển tay.
    request.provider_state = useProvider ? 'processing' : 'succeeded';
    request.disbursed_at = useProvider ? null : new Date();
    request.bank_snapshot = disbursement.bankSnapshotOf(ctv);
    request.updated_at = new Date();
    await request.save({ transaction });

    // Các khoản THU HỘ tương ứng chuyển sang trạng thái đã tất toán.
    await collectionService.markSettled(
      request.ctv_id,
      { payoutRequestId: request.id, until: request.created_at || new Date() },
      { transaction }
    );

    await auditService.log({
      actorType: 'admin', actorId: adminUserId || null,
      action: useProvider ? 'payout.approve.payos' : 'payout.approve',
      entityType: 'payout_request', entityId: request.id,
      newValue: {
        amount: roundVnd(request.amount),
        provider: request.provider,
        payment_reference: paymentReference || null
      },
      ip: ip || null
    }, { transaction });

    return { request, ctv };
  });

  // --- Giai đoạn 2: gọi payOS (NGOÀI transaction) ---
  if (useProvider) {
    try {
      await disbursement.dispatch(prepared.request, prepared.ctv);
    } catch (error) {
      // Lệnh chi hỏng -> trả tiền về ví CTV và đưa phiếu về chờ duyệt.
      await disbursement.markFailed(prepared.request.id, error.message || 'Lỗi gọi payOS');
      const e = new Error(`Chi hộ thất bại: ${error.message}. Phiếu đã được trả về trạng thái chờ duyệt.`);
      e.status = error.status || 502;
      throw e;
    }
  }

  const result = publicRequest(prepared.request);
  notifyService.payoutApproved({ request: result, ctvName: await ctvNameById(result.ctv_id) });
  return result;
};

const reject = async (requestId, { adminNote, adminUserId, ip } = {}) => {
  const result = await sequelize.transaction(async (transaction) => {
    const request = await PayoutRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) { const e = new Error('Không tìm thấy phiếu rút'); e.status = 404; throw e; }
    if (request.status !== 'pending') {
      const e = new Error(`Phiếu đã ${request.status}, không thể từ chối`); e.status = 400; throw e;
    }
    await walletService.releaseHold(request.ctv_id, {
      payoutRequestId: request.id, amount: request.amount,
      note: `Nhả tiền — admin từ chối phiếu ${request.id}`, createdBy: 'admin'
    }, { transaction });
    request.status = 'rejected';
    request.admin_note = adminNote || null;
    request.rejected_at = new Date();
    request.updated_at = new Date();
    await request.save({ transaction });
    await auditService.log({
      actorType: 'admin', actorId: adminUserId || null,
      action: 'payout.reject', entityType: 'payout_request', entityId: request.id,
      newValue: { reason: adminNote || null }, ip: ip || null
    }, { transaction });
    return publicRequest(request);
  });

  notifyService.payoutRejected({ request: result, ctvName: await ctvNameById(result.ctv_id) });
  return result;
};

const adminCreateForCtv = async (ctvId, { amount, note, allowBelowMin = false, adminUserId, ip } = {}) => {
  const ctv = await CtvProfile.findByPk(ctvId);
  if (!ctv) { const e = new Error('Không tìm thấy CTV'); e.status = 404; throw e; }
  return createRequest(ctv, {
    amount, note: note || 'Phiếu do admin tạo', type: 'manual', requestedBy: 'system',
    // Admin tạo hộ thì được phép dưới ngưỡng, nhưng phải nói rõ ý định.
    allowBelowMin: allowBelowMin === true
  }, { actorId: adminUserId, ip });
};

// ---------------- Auto sweep (chạy theo lịch tuần) ----------------
const runAutoSweep = async ({ trigger = 'cron', force = false } = {}) => {
  const setting = await AppSetting.findByPk(POLICY_KEY);
  const cfg = await getPolicy();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (trigger === 'cron' && !force) {
    if (cfg.last_run_date === todayStr) return { skipped: 'already_ran_today', created: [] };
    if (now.getHours() < (cfg.run_hour ?? 9)) return { skipped: 'before_run_hour', created: [] };
  }

  const weekday = now.getDay(); // 0=CN
  const ctvs = await CtvProfile.findAll({ where: { status: 'active', auto_payout_enabled: true } });
  const created = [];
  const skipped = [];

  for (const ctv of ctvs) {
    const effWeekday = ctv.auto_payout_weekday != null ? ctv.auto_payout_weekday : (cfg.default_weekday ?? 1);
    if (trigger === 'cron' && !force && weekday !== effWeekday) { skipped.push({ ctv_id: ctv.id, reason: 'not_weekday' }); continue; }

    const wallet = await walletService.getOrCreateWallet(ctv.id);
    const balance = roundVnd(wallet.balance);
    const min = Math.max(effectiveMin(ctv, cfg), 1);
    if (balance < min) { skipped.push({ ctv_id: ctv.id, reason: 'below_min', balance }); continue; }

    const pending = await PayoutRequest.count({ where: { ctv_id: ctv.id, status: 'pending' } });
    if (pending > 0) { skipped.push({ ctv_id: ctv.id, reason: 'has_pending' }); continue; }

    try {
      const req = await createRequest(ctv, {
        amount: balance, note: 'Phiếu rút tự động theo lịch tuần', type: 'auto', requestedBy: 'system'
      }, { actorId: null });
      created.push(req);
    } catch (error) {
      skipped.push({ ctv_id: ctv.id, reason: error.message });
    }
  }

  if (trigger === 'cron' && setting) {
    setting.value = { ...cfg, last_run_date: todayStr };
    setting.updated_at = new Date();
    await setting.save();
  }

  return { trigger, weekday, created, skipped };
};

module.exports = {
  getPolicy, updatePolicy, validatePolicy, effectiveMin, policyImpact, POLICY_MAC_DINH, PAYOUT_MODES,
  createRequest,
  handlePayoutWebhook: disbursement.handleWebhook,
  markDisbursementFailed: disbursement.markFailed,
  reconcilePendingDisbursements: disbursement.reconcilePending,
  listForCtv,
  cancelByCtv,
  listForAdmin,
  approve,
  reject,
  adminCreateForCtv,
  runAutoSweep,
  publicRequest
};
