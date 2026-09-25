const { Wallet, WalletTransaction, sequelize } = require('../models');
const { roundVnd } = require('../utils/money');
const { applyWalletAmount } = require('../utils/walletMath');

// Bất biến: wallet.balance === SUM(wallet_transactions.amount)
// pending_balance === tổng amount các phiếu rút đang 'pending' (gương của các txn payout_hold chưa release)
// total_earned === SUM(commission_credit)
// total_paid   === SUM(amount phiếu rút đã 'approved')

const getOrCreateWallet = async (ctvId, options = {}) => {
  const transaction = options.transaction;
  let wallet = await Wallet.findOne({ where: { ctv_id: ctvId }, transaction });
  if (!wallet) {
    wallet = await Wallet.create({ ctv_id: ctvId }, { transaction });
  }
  return wallet;
};

const lockedWallet = async (ctvId, transaction) => {
  const wallet = await Wallet.findOne({
    where: { ctv_id: ctvId },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined
  });
  if (!wallet) {
    const e = new Error('Không tìm thấy ví CTV');
    e.status = 404;
    throw e;
  }
  return wallet;
};

// Ghi 1 dòng ledger + cập nhật balance. amount có dấu.
const applyTxn = async (wallet, { amount, type, orderId = null, payoutRequestId = null, note = null, createdBy = 'system' }, transaction) => {
  const delta = roundVnd(amount);
  const balanceAfter = applyWalletAmount(wallet.balance, delta);

  const row = await WalletTransaction.create({
    wallet_id: wallet.id,
    ctv_id: wallet.ctv_id,
    amount: delta,
    type,
    order_id: orderId,
    payout_request_id: payoutRequestId,
    balance_after: balanceAfter,
    note,
    created_by: createdBy,
    created_at: new Date()
  }, { transaction });

  wallet.balance = balanceAfter;
  wallet.updated_at = new Date();
  await wallet.save({ transaction });

  return row;
};

// Hoa hồng khi đơn PAID.
const creditCommission = async (ctvId, { orderId, amount, note = null }, options = {}) => {
  const transaction = options.transaction;
  const wallet = await lockedWallet(ctvId, transaction);
  const value = roundVnd(amount);
  const row = await applyTxn(wallet, {
    amount: value, type: 'commission_credit', orderId,
    note: note || `Hoa hồng đơn ${orderId}`, createdBy: 'system'
  }, transaction);
  wallet.total_earned = roundVnd(Number(wallet.total_earned) + value);
  await wallet.save({ transaction });
  return row;
};

// Đảo hoa hồng khi hoàn tiền.
const debitRefund = async (ctvId, { orderId, amount, note = null }, options = {}) => {
  const transaction = options.transaction;
  const wallet = await lockedWallet(ctvId, transaction);
  const value = roundVnd(amount);
  const row = await applyTxn(wallet, {
    amount: -value, type: 'refund_debit', orderId,
    note: note || `Đảo hoa hồng do hoàn tiền đơn ${orderId}`, createdBy: 'admin'
  }, transaction);
  wallet.total_earned = roundVnd(Number(wallet.total_earned) - value);
  await wallet.save({ transaction });
  return row;
};

// Giữ tiền khi tạo phiếu rút. createdBy: 'system' (CTV/manual) | 'cron' (auto) | 'admin'.
const holdForPayout = async (ctvId, { payoutRequestId, amount, note = null, createdBy = 'system' }, options = {}) => {
  const transaction = options.transaction;
  const wallet = await lockedWallet(ctvId, transaction);
  const value = roundVnd(amount);
  if (value <= 0) { const e = new Error('Số tiền rút phải lớn hơn 0'); e.status = 400; throw e; }
  if (value > roundVnd(wallet.balance)) {
    const e = new Error(`Số dư khả dụng không đủ (còn ${roundVnd(wallet.balance).toLocaleString('vi-VN')}đ)`);
    e.status = 400;
    throw e;
  }
  const by = ['system', 'admin', 'cron'].includes(createdBy) ? createdBy : 'system';
  const row = await applyTxn(wallet, {
    amount: -value, type: 'payout_hold', payoutRequestId,
    note: note || 'Giữ tiền cho phiếu rút', createdBy: by
  }, transaction);
  wallet.pending_balance = roundVnd(Number(wallet.pending_balance) + value);
  await wallet.save({ transaction });
  return row;
};

// Nhả tiền khi phiếu rút bị từ chối / huỷ.
const releaseHold = async (ctvId, { payoutRequestId, amount, note = null, createdBy = 'admin' }, options = {}) => {
  const transaction = options.transaction;
  const wallet = await lockedWallet(ctvId, transaction);
  const value = roundVnd(amount);
  const row = await applyTxn(wallet, {
    amount: value, type: 'payout_release', payoutRequestId,
    note: note || 'Nhả tiền do phiếu rút bị huỷ/từ chối', createdBy
  }, transaction);
  wallet.pending_balance = roundVnd(Math.max(Number(wallet.pending_balance) - value, 0));
  await wallet.save({ transaction });
  return row;
};

// Chốt phiếu rút đã chuyển khoản: tiền đã rời ví lúc hold, chỉ dịch pending -> paid.
const settlePayout = async (ctvId, { amount }, options = {}) => {
  const transaction = options.transaction;
  const wallet = await lockedWallet(ctvId, transaction);
  const value = roundVnd(amount);
  wallet.pending_balance = roundVnd(Math.max(Number(wallet.pending_balance) - value, 0));
  wallet.total_paid = roundVnd(Number(wallet.total_paid) + value);
  wallet.updated_at = new Date();
  await wallet.save({ transaction });
  return wallet;
};

const getSummary = async (ctvId) => {
  const wallet = await getOrCreateWallet(ctvId);
  const sum = await WalletTransaction.sum('amount', { where: { ctv_id: ctvId } });
  const ledgerBalance = roundVnd(sum || 0);
  return {
    balance: roundVnd(wallet.balance),
    pending_balance: roundVnd(wallet.pending_balance),
    total_earned: roundVnd(wallet.total_earned),
    total_paid: roundVnd(wallet.total_paid),
    ledger_balance: ledgerBalance,
    ledger_consistent: ledgerBalance === roundVnd(wallet.balance)
  };
};

const listLedger = async (ctvId, { page = 1, limit = 30 } = {}) => {
  const offset = (page - 1) * limit;
  const { count, rows } = await WalletTransaction.findAndCountAll({
    where: { ctv_id: ctvId },
    order: [['created_at', 'DESC']],
    limit,
    offset
  });
  return {
    items: rows,
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

module.exports = {
  getOrCreateWallet,
  lockedWallet,
  creditCommission,
  debitRefund,
  holdForPayout,
  releaseHold,
  settlePayout,
  getSummary,
  listLedger,
  _sequelize: sequelize
};
