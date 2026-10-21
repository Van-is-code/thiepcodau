const { Op } = require('sequelize');
const { sequelize, CtvProfile, Customer, Order, Wallet } = require('../models');
const walletService = require('./walletService');
const payoutService = require('./payoutService');
const auditService = require('./auditService');
const { roundVnd, toNumber } = require('../utils/money');

const publicProfile = (p) => ({
  id: p.id,
  user_id: p.user_id,
  display_name: p.display_name,
  email: p.email,
  phone: p.phone,
  status: p.status,
  single_price: roundVnd(p.single_price),
  combo_price: roundVnd(p.combo_price),
  commission_rate: toNumber(p.commission_rate),
  commission_percent: Math.round(toNumber(p.commission_rate) * 10000) / 100,
  auto_payout_enabled: p.auto_payout_enabled,
  auto_payout_weekday: p.auto_payout_weekday,
  auto_payout_min_amount: roundVnd(p.auto_payout_min_amount),
  bank_name: p.bank_name,
  bank_account_number: p.bank_account_number,
  bank_account_name: p.bank_account_name,
  created_at: p.created_at
});

const resolveCtv = async (userId) => {
  const ctv = await CtvProfile.findOne({ where: { user_id: userId } });
  if (!ctv) { const e = new Error('Tài khoản chưa được thiết lập hồ sơ CTV'); e.status = 404; throw e; }
  return ctv;
};

const getMe = async (userId) => {
  const ctv = await resolveCtv(userId);
  const wallet = await walletService.getSummary(ctv.id);
  // Trả kèm ngưỡng rút đang áp để CTV biết trước, thay vì bấm rút rồi mới ăn lỗi.
  const policy = await payoutService.getPolicy();
  return {
    profile: publicProfile(ctv),
    wallet,
    payout_policy: {
      platform_min: roundVnd(policy.min_payout_amount) || 0,
      effective_min: payoutService.effectiveMin(ctv, policy)
    }
  };
};

const monthRange = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
};

const getDashboard = async (ctv) => {
  const { start, end } = monthRange();

  const [revenueMonth, earningMonth, ordersMonth] = await Promise.all([
    Order.sum('amount', { where: { ctv_id: ctv.id, status: 'paid', paid_at: { [Op.gte]: start, [Op.lt]: end } } }),
    Order.sum('ctv_earning_amount', { where: { ctv_id: ctv.id, status: 'paid', paid_at: { [Op.gte]: start, [Op.lt]: end } } }),
    Order.count({ where: { ctv_id: ctv.id, status: 'paid', paid_at: { [Op.gte]: start, [Op.lt]: end } } })
  ]);

  const [customerCount, activeCustomers, pendingOrders, paidOrdersTotal, wallet] = await Promise.all([
    Customer.count({ where: { ctv_id: ctv.id } }),
    Customer.count({ where: { ctv_id: ctv.id, status: 'active' } }),
    Order.count({ where: { ctv_id: ctv.id, status: 'pending' } }),
    Order.count({ where: { ctv_id: ctv.id, status: 'paid' } }),
    walletService.getSummary(ctv.id)
  ]);

  return {
    month: { revenue: roundVnd(revenueMonth || 0), commission_earning: roundVnd(earningMonth || 0), paid_orders: ordersMonth },
    customers: { total: customerCount, active: activeCustomers },
    orders: { pending: pendingOrders, paid_total: paidOrdersTotal },
    wallet
  };
};

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const updatePayoutSettings = async (ctv, body, ctx = {}) => {
  const before = {
    auto_payout_enabled: ctv.auto_payout_enabled,
    auto_payout_weekday: ctv.auto_payout_weekday,
    auto_payout_min_amount: roundVnd(ctv.auto_payout_min_amount),
    bank_name: ctv.bank_name,
    bank_account_number: ctv.bank_account_number,
    bank_account_name: ctv.bank_account_name
  };

  if (body.auto_payout_enabled !== undefined) ctv.auto_payout_enabled = Boolean(body.auto_payout_enabled);
  if (body.auto_payout_weekday !== undefined) {
    if (body.auto_payout_weekday === null || body.auto_payout_weekday === '') {
      ctv.auto_payout_weekday = null;
    } else {
      const wd = Number.parseInt(body.auto_payout_weekday, 10);
      if (!WEEKDAYS.includes(wd)) { const e = new Error('auto_payout_weekday phải 0..6 (0=Chủ nhật)'); e.status = 400; throw e; }
      ctv.auto_payout_weekday = wd;
    }
  }
  if (body.auto_payout_min_amount !== undefined) {
    const v = roundVnd(body.auto_payout_min_amount);
    if (!Number.isFinite(v) || v < 0) { const e = new Error('Ngưỡng rút tối thiểu không hợp lệ'); e.status = 400; throw e; }
    // CTV chỉ được đặt mức CAO HƠN sàn của nền tảng. Cho hạ xuống dưới sàn thì
    // cái sàn thành vô nghĩa — ai cũng tự hạ về 0 rồi rút lắt nhắt.
    const san = roundVnd((await payoutService.getPolicy()).min_payout_amount) || 0;
    if (v > 0 && v < san) {
      const e = new Error(`Nền tảng đang đặt mức rút tối thiểu ${san.toLocaleString('vi-VN')}đ, bạn không thể đặt thấp hơn`);
      e.status = 400; throw e;
    }
    ctv.auto_payout_min_amount = v;
  }
  if (body.bank_name !== undefined) ctv.bank_name = body.bank_name ? String(body.bank_name).trim() : null;
  if (body.bank_account_number !== undefined) ctv.bank_account_number = body.bank_account_number ? String(body.bank_account_number).trim() : null;
  if (body.bank_account_name !== undefined) ctv.bank_account_name = body.bank_account_name ? String(body.bank_account_name).trim() : null;

  ctv.updated_at = new Date();
  await ctv.save();

  await auditService.log({
    actorType: 'ctv', actorId: ctx.actorId || null,
    action: 'ctv.payout_settings_update', entityType: 'ctv_profile', entityId: ctv.id,
    oldValue: before,
    newValue: {
      auto_payout_enabled: ctv.auto_payout_enabled,
      auto_payout_weekday: ctv.auto_payout_weekday,
      auto_payout_min_amount: roundVnd(ctv.auto_payout_min_amount),
      bank_name: ctv.bank_name,
      bank_account_number: ctv.bank_account_number,
      bank_account_name: ctv.bank_account_name
    },
    ip: ctx.ip || null
  });

  return publicProfile(ctv);
};

module.exports = {
  resolveCtv,
  getMe,
  getDashboard,
  updatePayoutSettings,
  publicProfile
};
