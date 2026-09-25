// CHI HỘ — chuyển tiền hoa hồng từ nền tảng về tài khoản ngân hàng của CTV.
//
// Tách riêng khỏi payoutService.js vì luồng này có một ràng buộc riêng: nó gọi API
// ra bên ngoài (payOS Payouts), nên KHÔNG được gọi bên trong transaction DB. Một lần
// timeout trong transaction sẽ rollback phiếu rút trong khi tiền CÓ THỂ đã chuyển đi
// thật — sai lệch đó không cứu được bằng dữ liệu.
const {
  sequelize, CtvProfile, PayoutRequest,
} = require('../models');
const walletService = require('./walletService');
const payosPayoutService = require('./payosPayoutService');
const collectionService = require('./collectionService');
const auditService = require('./auditService');
const notifyService = require('./notifyService');
const { roundVnd } = require('../utils/money');
const { isUuid } = require('../utils/isUuid');

// Kiểm tra CTV đã đủ điều kiện nhận chi hộ tự động chưa.
const assertPayoutReady = (ctv) => {
  if (!payosPayoutService.isConfigured()) {
    const e = new Error('Chưa cấu hình chi hộ payOS. Dùng chế độ chuyển khoản thủ công hoặc bổ sung PAYOS_PAYOUT_*.');
    e.status = 503; throw e;
  }
  if (!ctv.bank_bin || !ctv.bank_account_number) {
    const e = new Error('CTV chưa khai đủ mã ngân hàng (BIN) và số tài khoản — không thể chi hộ tự động.');
    e.status = 400; throw e;
  }
  return true;
};

const bankSnapshotOf = (ctv) => ({
  bank_name: ctv.bank_name || null,
  bank_bin: ctv.bank_bin || null,
  bank_account_number: ctv.bank_account_number || null,
  bank_account_name: ctv.bank_account_name || null,
});

// Gửi lệnh chi tới payOS rồi ghi kết quả vào phiếu. Chạy NGOÀI transaction.
const dispatch = async (request, ctv) => {
  const payout = await payosPayoutService.createPayout({
    // referenceId = id phiếu rút -> payOS tự chống trùng: bấm duyệt hai lần, hoặc
    // phải thử lại vì mạng lỗi, đều KHÔNG chuyển tiền hai lần.
    referenceId: request.id,
    amount: roundVnd(request.amount),
    toBin: ctv.bank_bin,
    toAccountNumber: ctv.bank_account_number,
    toAccountName: ctv.bank_account_name,
    description: 'RUT ' + String(request.id).slice(0, 8),
  });

  const state = payosPayoutService.normalizeState(payout.state || payout.status);
  const txn = Array.isArray(payout.transactions) && payout.transactions.length ? payout.transactions[0] : null;

  await request.update({
    provider_payout_id: payout.id ? String(payout.id) : null,
    provider_state: state,
    provider_reference: txn && txn.reference ? String(txn.reference) : null,
    provider_payload: payout,
    disbursed_at: state === 'succeeded' ? new Date() : null,
    updated_at: new Date(),
  });

  return { state, payout };
};

// Hoàn nguyên 1 phiếu rút khi lệnh chi hộ thất bại.
//
// Tiền chưa rời khỏi nền tảng, nên phải: trả lại số dư khả dụng cho CTV, đảo trạng
// thái các khoản thu hộ về "còn nợ", và đưa phiếu về pending để duyệt lại. Bỏ bước
// này thì CTV mất tiền trên sổ sách mà thực tế chưa nhận được đồng nào.
const markFailed = async (requestId, reason) => sequelize.transaction(async (transaction) => {
  const request = await PayoutRequest.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!request) return null;
  // Đã chi thành công rồi thì không đảo ngược (chặn webhook đến muộn phá dữ liệu).
  if (request.provider_state === 'succeeded') return request;

  const amount = roundVnd(request.amount);

  // Đảo bước settlePayout: total_paid giảm, pending_balance tăng lại...
  const wallet = await walletService.lockedWallet(request.ctv_id, transaction);
  wallet.total_paid = roundVnd(Number(wallet.total_paid) - amount);
  wallet.pending_balance = roundVnd(Number(wallet.pending_balance) + amount);
  wallet.updated_at = new Date();
  await wallet.save({ transaction });

  // ...rồi nhả hold để tiền quay lại số dư khả dụng của CTV.
  await walletService.releaseHold(request.ctv_id, {
    payoutRequestId: request.id,
    amount,
    note: 'Nhả tiền — chi hộ thất bại: ' + String(reason).slice(0, 180),
    createdBy: 'system',
  }, { transaction });

  await collectionService.unmarkSettled(request.id, { transaction });

  request.status = 'pending';
  request.provider_state = 'failed';
  request.failure_reason = String(reason).slice(0, 1000);
  request.approved_at = null;
  request.disbursed_at = null;
  request.updated_at = new Date();
  await request.save({ transaction });

  await auditService.log({
    actorType: 'system', action: 'payout.disbursement_failed',
    entityType: 'payout_request', entityId: request.id,
    newValue: { reason: String(reason).slice(0, 300), amount },
  }, { transaction });

  return request;
});

// Webhook chi hộ payOS: cập nhật kết quả cuối cùng của 1 lệnh chi.
//
// KHÔNG auth — bảo vệ bằng chữ ký HMAC trong payosPayoutService.verifyPayoutWebhook.
// Bỏ verify thì bất kỳ ai cũng POST giả một lệnh SUCCEEDED để đánh dấu phiếu đã trả
// trong khi thực tế chưa chuyển đồng nào.
const handleWebhook = async (rawBody) => {
  let data;
  try {
    data = payosPayoutService.verifyPayoutWebhook(rawBody);
  } catch (error) {
    notifyService.warn('Webhook chi hộ payOS: chữ ký không hợp lệ', error.message || '', 'payout:badsig');
    return { ack: true, processed: false, reason: 'invalid_signature' };
  }

  // referenceId chính là id phiếu rút (ta đặt lúc tạo lệnh chi).
  const requestId = data.referenceId || data.reference_id;
  if (!requestId) return { ack: true, processed: false, reason: 'missing_reference' };

  // Chặn sớm id không phải UUID: Postgres sẽ ném lỗi kiểu và biến webhook thành 500,
  // khiến payOS retry vô hạn cho một payload chắc chắn không bao giờ xử lý được.
  if (!isUuid(String(requestId))) return { ack: true, processed: false, reason: 'invalid_reference' };

  const request = await PayoutRequest.findByPk(requestId);
  if (!request) return { ack: true, processed: false, reason: 'payout_not_found' };

  const state = payosPayoutService.normalizeState(data.state || data.status);

  // Idempotent: trạng thái không đổi -> không làm gì thêm.
  if (request.provider_state === state && state !== 'processing') {
    return { ack: true, processed: false, reason: 'duplicate_state' };
  }

  if (state === 'failed') {
    await markFailed(request.id, data.errorMessage || data.desc || 'payOS báo lệnh chi thất bại');
    notifyService.alert(
      'Chi hộ payOS THẤT BẠI',
      'phiếu #' + String(request.id).slice(0, 8) + ' · ' + roundVnd(request.amount).toLocaleString('vi-VN')
        + 'đ · đã trả tiền về ví CTV',
      'payout:failed:' + request.id
    );
    return { ack: true, processed: true, state };
  }

  const txn = Array.isArray(data.transactions) && data.transactions.length ? data.transactions[0] : null;
  await request.update({
    provider_state: state,
    provider_reference: txn && txn.reference ? String(txn.reference) : request.provider_reference,
    provider_payload: data,
    disbursed_at: state === 'succeeded' ? new Date() : request.disbursed_at,
    updated_at: new Date(),
  });

  await auditService.log({
    actorType: 'system', action: 'payout.webhook',
    entityType: 'payout_request', entityId: request.id,
    newValue: { state, reference: txn ? txn.reference : null },
  });

  return { ack: true, processed: true, state };
};

// Đối soát: tra lại payOS cho các lệnh còn treo 'processing' (khi webhook không tới).
const reconcilePending = async ({ olderThanMinutes = 15 } = {}) => {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const pending = await PayoutRequest.findAll({
    where: { provider: 'payos', provider_state: 'processing' },
    limit: 100,
  });

  const out = [];
  for (const request of pending) {
    if (new Date(request.updated_at) > cutoff) continue;
    if (!request.provider_payout_id) continue;
    try {
      const info = await payosPayoutService.getPayout(request.provider_payout_id);
      const state = payosPayoutService.normalizeState(info.state || info.status);
      if (state === 'failed') {
        await markFailed(request.id, 'Đối soát: payOS báo lệnh chi thất bại');
      } else if (state !== request.provider_state) {
        await request.update({
          provider_state: state,
          provider_payload: info,
          disbursed_at: state === 'succeeded' ? new Date() : null,
          updated_at: new Date(),
        });
      }
      out.push({ id: request.id, state });
    } catch (error) {
      out.push({ id: request.id, error: error.message });
    }
  }
  return out;
};

module.exports = {
  // Đã có khoá chi hộ payOS chưa — trang quản trị hỏi trước khi cho bật chi tự động.
  isConfigured: () => payosPayoutService.isConfigured(),
  assertPayoutReady,
  bankSnapshotOf,
  dispatch,
  markFailed,
  handleWebhook,
  reconcilePending,
};
