const adminCtvService = require('../services/adminCtvService');
const payoutService = require('../services/payoutService');
const collectionService = require('../services/collectionService');
const payosPayoutService = require('../services/payosPayoutService');
const orderService = require('../services/orderService');
const { actorFromReq } = require('../services/auditService');

const ctxOf = (req) => {
  const a = actorFromReq(req);
  return { actorId: a.actorId, ip: a.ip };
};
const ok = (res, data, message = 'OK', status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res, error) => res.status(error.status || 500).json({ success: false, message: error.message || 'Lỗi máy chủ' });
const pg = (req) => ({
  page: Number.parseInt(req.query.page, 10) || 1,
  limit: Number.parseInt(req.query.limit, 10) || 30
});

// ---------------- CTV ----------------
const listCtvs = async (req, res) => {
  try { ok(res, await adminCtvService.listCtvs({ search: req.query.search, status: req.query.status, ...pg(req) }), 'Danh sách CTV'); }
  catch (e) { fail(res, e); }
};
const createCtv = async (req, res) => {
  try { ok(res, await adminCtvService.createCtv(req.body || {}, ctxOf(req)), 'Đã tạo CTV', 201); }
  catch (e) { fail(res, e); }
};
const getCtv = async (req, res) => {
  try { ok(res, await adminCtvService.getCtvDetail(req.params.id), 'Chi tiết CTV'); }
  catch (e) { fail(res, e); }
};
const updateCtv = async (req, res) => {
  try { ok(res, await adminCtvService.updateCtv(req.params.id, req.body || {}, ctxOf(req)), 'Đã cập nhật CTV'); }
  catch (e) { fail(res, e); }
};
const lockCtv = async (req, res) => {
  try { ok(res, await adminCtvService.setCtvStatus(req.params.id, 'locked', ctxOf(req)), 'Đã khoá CTV'); }
  catch (e) { fail(res, e); }
};
const unlockCtv = async (req, res) => {
  try { ok(res, await adminCtvService.setCtvStatus(req.params.id, 'active', ctxOf(req)), 'Đã mở khoá CTV'); }
  catch (e) { fail(res, e); }
};
const getCtvStats = async (req, res) => {
  try { ok(res, await adminCtvService.getCtvStats(req.params.id), 'Thống kê CTV'); }
  catch (e) { fail(res, e); }
};

// ---------------- Products (giá sàn) ----------------
const listProducts = async (req, res) => {
  try { ok(res, await adminCtvService.listProducts(), 'Sản phẩm'); }
  catch (e) { fail(res, e); }
};
const updateProduct = async (req, res) => {
  try { ok(res, await adminCtvService.updateProduct(req.params.id, req.body || {}, ctxOf(req)), 'Đã cập nhật giá sàn'); }
  catch (e) { fail(res, e); }
};

// ---------------- Orders / Customers / Payments ----------------
const listOrders = async (req, res) => {
  try {
    ok(res, await adminCtvService.listAllOrders({
      ctvId: req.query.ctvId, customerId: req.query.customerId, status: req.query.status, ...pg(req)
    }), 'Danh sách đơn');
  } catch (e) { fail(res, e); }
};
const listCustomers = async (req, res) => {
  try {
    ok(res, await adminCtvService.listAllCustomers({
      ctvId: req.query.ctvId, search: req.query.search, status: req.query.status, ...pg(req)
    }), 'Danh sách khách');
  } catch (e) { fail(res, e); }
};
const listPaymentTransactions = async (req, res) => {
  try { ok(res, await adminCtvService.listPaymentTransactions({ orderId: req.query.orderId, status: req.query.status, ...pg(req) }), 'Giao dịch payOS'); }
  catch (e) { fail(res, e); }
};
const refundOrder = async (req, res) => {
  try {
    const ctx = ctxOf(req);
    const data = await orderService.refundOrder(req.params.id, { reason: req.body?.reason, adminUserId: ctx.actorId, ip: ctx.ip });
    ok(res, data, 'Đã hoàn tiền đơn (đảo entitlement + hoa hồng)');
  } catch (e) { fail(res, e); }
};

// ---------------- Đối soát ----------------
const reconciliation = async (req, res) => {
  try { ok(res, await adminCtvService.reconciliation({ ctvId: req.query.ctvId }), 'Bảng đối soát'); }
  catch (e) { fail(res, e); }
};

// ---------------- Phiếu rút ----------------
const listPayouts = async (req, res) => {
  try { ok(res, await payoutService.listForAdmin({ status: req.query.status, ctvId: req.query.ctvId, ...pg(req) }), 'Phiếu rút'); }
  catch (e) { fail(res, e); }
};
// mode = 'payos' -> chi hộ tự động qua payOS Payouts.
// mode = 'manual' (mặc định) -> admin tự chuyển khoản, hệ thống chỉ ghi nhận.
const approvePayout = async (req, res) => {
  try {
    const ctx = ctxOf(req);
    ok(res, await payoutService.approve(req.params.id, {
      paymentReference: req.body?.payment_reference, adminNote: req.body?.admin_note,
      mode: req.body?.mode,
      adminUserId: ctx.actorId, ip: ctx.ip
    }), 'Đã duyệt phiếu rút');
  } catch (e) { fail(res, e); }
};

// ---------------- Thu hộ & chi hộ ----------------

// Tổng quan thu hộ toàn hệ: đã thu bao nhiêu, nền tảng giữ bao nhiêu, còn nợ CTV bao nhiêu.
const collectionSummary = async (req, res) => {
  try {
    ok(res, await collectionService.summary(req.query.ctvId || null, {
      from: req.query.from, to: req.query.to,
    }), 'Tổng hợp thu hộ');
  } catch (e) { fail(res, e); }
};

// Đối soát thu hộ theo từng CTV (kèm số tiền còn phải chi hộ).
const collectionByCtv = async (req, res) => {
  try { ok(res, await collectionService.reconcileByCtv(), 'Đối soát thu hộ theo CTV'); }
  catch (e) { fail(res, e); }
};

// Số dư tài khoản chi hộ ở payOS — xem trước khi duyệt để khỏi tạo lệnh chắc chắn hỏng.
const payoutBalance = async (req, res) => {
  try { ok(res, await payosPayoutService.getBalance(), 'Số dư tài khoản chi hộ'); }
  catch (e) { fail(res, e); }
};

// Tra lại payOS cho các lệnh chi còn treo (dùng khi webhook không tới).
const reconcileDisbursements = async (req, res) => {
  try {
    ok(res, await payoutService.reconcilePendingDisbursements({
      olderThanMinutes: Number.parseInt(req.body?.older_than_minutes, 10) || 15,
    }), 'Đã đối soát lệnh chi treo');
  } catch (e) { fail(res, e); }
};
const rejectPayout = async (req, res) => {
  try {
    const ctx = ctxOf(req);
    ok(res, await payoutService.reject(req.params.id, { adminNote: req.body?.admin_note, adminUserId: ctx.actorId, ip: ctx.ip }), 'Đã từ chối phiếu rút');
  } catch (e) { fail(res, e); }
};
const createPayoutForCtv = async (req, res) => {
  try {
    const ctx = ctxOf(req);
    ok(res, await payoutService.adminCreateForCtv(req.params.id, {
      amount: req.body?.amount, note: req.body?.note,
      // Admin cố ý tạo phiếu dưới ngưỡng thì phải gửi cờ này, không mặc định bỏ qua.
      allowBelowMin: req.body?.allow_below_min === true,
      adminUserId: ctx.actorId, ip: ctx.ip,
    }), 'Đã tạo phiếu rút hộ CTV', 201);
  } catch (e) { fail(res, e); }
};
// ---------------- Chính sách rút tiền ----------------
const getPayoutPolicy = async (req, res) => {
  try {
    const policy = await payoutService.getPolicy();
    ok(res, {
      ...policy,
      // Kèm số CTV sẽ bị chặn ở mức hiện tại, để admin thấy hậu quả ngay trên trang.
      impact: await payoutService.policyImpact(policy.min_payout_amount),
      // Đã có khoá chi hộ payOS chưa — chưa có thì giao diện khoá luôn nút bật
      // chi tự động, thay vì để admin bật rồi ăn lỗi 503 lúc đang trả tiền.
      payos_ready: require('../services/payoutDisbursementService').isConfigured(),
    }, 'Chính sách rút tiền');
  } catch (e) { fail(res, e); }
};

const updatePayoutPolicy = async (req, res) => {
  try {
    const ctx = ctxOf(req);
    const policy = await payoutService.updatePolicy(req.body || {}, { adminUserId: ctx.actorId, ip: ctx.ip });
    ok(res, {
      ...policy,
      impact: await payoutService.policyImpact(policy.min_payout_amount),
      payos_ready: require('../services/payoutDisbursementService').isConfigured(),
    }, 'Đã cập nhật chính sách rút tiền');
  } catch (e) { fail(res, e); }
};

// Xem trước hậu quả của một mức sàn TRƯỚC khi lưu.
const previewPayoutPolicy = async (req, res) => {
  try { ok(res, await payoutService.policyImpact(req.query.min_payout_amount), 'Ước lượng ảnh hưởng'); }
  catch (e) { fail(res, e); }
};

const runAutoSweep = async (req, res) => {
  try { ok(res, await payoutService.runAutoSweep({ trigger: 'manual', force: req.body?.force === true }), 'Đã chạy quét rút tự động'); }
  catch (e) { fail(res, e); }
};

// ---------------- Audit logs ----------------
const listAuditLogs = async (req, res) => {
  try {
    ok(res, await adminCtvService.listAuditLogs({
      entityType: req.query.entity_type, entityId: req.query.entity_id,
      actorType: req.query.actor_type, action: req.query.action,
      page: Number.parseInt(req.query.page, 10) || 1, limit: Number.parseInt(req.query.limit, 10) || 50
    }), 'Nhật ký hệ thống');
  } catch (e) { fail(res, e); }
};

module.exports = {
  listCtvs, createCtv, getCtv, updateCtv, lockCtv, unlockCtv, getCtvStats,
  listProducts, updateProduct,
  listOrders, listCustomers, listPaymentTransactions, refundOrder,
  reconciliation,
  listPayouts, approvePayout, rejectPayout, createPayoutForCtv, runAutoSweep,
  getPayoutPolicy, updatePayoutPolicy, previewPayoutPolicy,
  collectionSummary, collectionByCtv, payoutBalance, reconcileDisbursements,
  listAuditLogs
};
