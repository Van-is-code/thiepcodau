const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { assertCredentials, BCRYPT_ROUNDS } = require('../utils/credentials');
const { Op } = require('sequelize');
const {
  sequelize, User, CtvProfile, Customer, Wallet, Order, Product,
  PaymentTransaction, AuditLog, PayoutRequest
} = require('../models');
const pricingService = require('./pricingService');
const walletService = require('./walletService');
const auditService = require('./auditService');
const { roundVnd, toNumber } = require('../utils/money');

const publicProfile = (p) => ({
  id: p.id,
  user_id: p.user_id,
  username: p.user ? p.user.username : undefined,
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

// Chuẩn hoá commission: nhận commission_rate (0..1) hoặc commission_percent (0..100).
const normalizeRate = (body) => {
  if (body.commission_rate !== undefined && body.commission_rate !== null && body.commission_rate !== '') {
    return toNumber(body.commission_rate);
  }
  if (body.commission_percent !== undefined && body.commission_percent !== null && body.commission_percent !== '') {
    return toNumber(body.commission_percent) / 100;
  }
  return undefined;
};

const assertRate = (rate) => {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    const e = new Error('Hoa hồng phải trong khoảng 0%..100%'); e.status = 400; throw e;
  }
  return rate;
};

// ---------------- CTV CRUD ----------------
const listCtvs = async ({ search = '', status, page = 1, limit = 30 } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { display_name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } }
    ];
  }
  const offset = (page - 1) * limit;
  const { count, rows } = await CtvProfile.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset,
    include: [
      { model: User, as: 'user', attributes: ['id', 'username'] },
      { model: Wallet, as: 'wallet' }
    ]
  });

  const ids = rows.map((r) => r.id);
  const [custCounts, orderAgg] = await Promise.all([
    ids.length ? Customer.findAll({
      attributes: ['ctv_id', [sequelize.fn('COUNT', sequelize.col('id')), 'c']],
      where: { ctv_id: { [Op.in]: ids } }, group: ['ctv_id']
    }) : [],
    ids.length ? Order.findAll({
      attributes: [
        'ctv_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'revenue'],
        [sequelize.fn('SUM', sequelize.col('ctv_earning_amount')), 'earning']
      ],
      where: { ctv_id: { [Op.in]: ids }, status: 'paid' }, group: ['ctv_id']
    }) : []
  ]);
  const custMap = Object.fromEntries(custCounts.map((x) => [String(x.ctv_id), Number(x.get('c'))]));
  const ordMap = Object.fromEntries(orderAgg.map((x) => [String(x.ctv_id), {
    orders: Number(x.get('orders')) || 0, revenue: Number(x.get('revenue')) || 0, earning: Number(x.get('earning')) || 0
  }]));

  return {
    items: rows.map((r) => ({
      ...publicProfile(r),
      wallet: r.wallet ? {
        balance: roundVnd(r.wallet.balance),
        pending_balance: roundVnd(r.wallet.pending_balance),
        total_earned: roundVnd(r.wallet.total_earned),
        total_paid: roundVnd(r.wallet.total_paid)
      } : null,
      customer_count: custMap[String(r.id)] || 0,
      paid_orders: ordMap[String(r.id)]?.orders || 0,
      revenue: ordMap[String(r.id)]?.revenue || 0,
      commission_earning: ordMap[String(r.id)]?.earning || 0
    })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

const createCtv = async (body, ctx = {}) => {
  const username = String(body.username || '').trim();
  // Tài khoản CTV nắm dòng tiền hoa hồng -> áp đúng chính sách chung, không nới
  // xuống 6 ký tự như trước.
  const { password } = assertCredentials(username, body.password);

  const rate = assertRate(normalizeRate(body) ?? 0);
  const { singlePrice, comboPrice } = await pricingService.validateCtvPrices({
    singlePrice: body.single_price, comboPrice: body.combo_price
  });

  const existed = await User.findOne({ where: { username } });
  if (existed) { const e = new Error('username đã tồn tại'); e.status = 409; throw e; }

  const result = await sequelize.transaction(async (transaction) => {
    const now = new Date();
    const user = await User.create({
      id: randomUUID(), username, password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: 'ctv', slot: 0, created_at: now, updated_at: now
    }, { transaction });

    const profile = await CtvProfile.create({
      id: randomUUID(), user_id: user.id,
      display_name: body.display_name ? String(body.display_name).trim() : username,
      email: body.email ? String(body.email).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      status: 'active',
      single_price: singlePrice, combo_price: comboPrice, commission_rate: rate,
      auto_payout_enabled: false,
      auto_payout_weekday: body.auto_payout_weekday != null ? Number.parseInt(body.auto_payout_weekday, 10) : null,
      auto_payout_min_amount: body.auto_payout_min_amount != null ? roundVnd(body.auto_payout_min_amount) : 0,
      bank_name: body.bank_name || null,
      bank_account_number: body.bank_account_number || null,
      bank_account_name: body.bank_account_name || null,
      created_at: now, updated_at: now
    }, { transaction });

    await Wallet.create({ id: randomUUID(), ctv_id: profile.id, updated_at: now }, { transaction });

    await auditService.log({
      actorType: 'admin', actorId: ctx.actorId || null,
      action: 'ctv.create', entityType: 'ctv_profile', entityId: profile.id,
      newValue: { username, single_price: singlePrice, combo_price: comboPrice, commission_rate: rate },
      ip: ctx.ip || null
    }, { transaction });

    return { user, profile };
  });

  return { ...publicProfile({ ...result.profile.toJSON(), user: result.user }), password };
};

const getCtvProfile = async (id, options = {}) => {
  const ctv = await CtvProfile.findByPk(id, {
    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }, { model: Wallet, as: 'wallet' }],
    ...options
  });
  if (!ctv) { const e = new Error('Không tìm thấy CTV'); e.status = 404; throw e; }
  return ctv;
};

const getCtvDetail = async (id) => {
  const ctv = await getCtvProfile(id);
  const stats = await getCtvStats(id);
  return {
    profile: publicProfile(ctv),
    wallet: await walletService.getSummary(id),
    stats
  };
};

const updateCtv = async (id, body, ctx = {}) => {
  const ctv = await getCtvProfile(id);
  const before = publicProfile(ctv);

  const priceChanged = body.single_price !== undefined || body.combo_price !== undefined;
  if (priceChanged) {
    const { singlePrice, comboPrice } = await pricingService.validateCtvPrices({
      singlePrice: body.single_price !== undefined ? body.single_price : ctv.single_price,
      comboPrice: body.combo_price !== undefined ? body.combo_price : ctv.combo_price
    });
    ctv.single_price = singlePrice;
    ctv.combo_price = comboPrice;
  }

  const rate = normalizeRate(body);
  const rateChanged = rate !== undefined;
  if (rateChanged) ctv.commission_rate = assertRate(rate);

  if (body.display_name !== undefined) ctv.display_name = body.display_name ? String(body.display_name).trim() : null;
  if (body.email !== undefined) ctv.email = body.email ? String(body.email).trim() : null;
  if (body.phone !== undefined) ctv.phone = body.phone ? String(body.phone).trim() : null;
  if (body.bank_name !== undefined) ctv.bank_name = body.bank_name || null;
  if (body.bank_account_number !== undefined) ctv.bank_account_number = body.bank_account_number || null;
  if (body.bank_account_name !== undefined) ctv.bank_account_name = body.bank_account_name || null;
  if (body.auto_payout_enabled !== undefined) ctv.auto_payout_enabled = Boolean(body.auto_payout_enabled);
  if (body.auto_payout_weekday !== undefined) {
    ctv.auto_payout_weekday = (body.auto_payout_weekday === null || body.auto_payout_weekday === '')
      ? null : Number.parseInt(body.auto_payout_weekday, 10);
  }
  if (body.auto_payout_min_amount !== undefined) ctv.auto_payout_min_amount = roundVnd(body.auto_payout_min_amount);

  ctv.updated_at = new Date();
  await ctv.save();

  if (priceChanged) {
    await auditService.log({
      actorType: 'admin', actorId: ctx.actorId || null,
      action: 'price.update', entityType: 'ctv_profile', entityId: ctv.id,
      oldValue: { single_price: before.single_price, combo_price: before.combo_price },
      newValue: { single_price: roundVnd(ctv.single_price), combo_price: roundVnd(ctv.combo_price) },
      ip: ctx.ip || null
    });
  }
  if (rateChanged) {
    await auditService.log({
      actorType: 'admin', actorId: ctx.actorId || null,
      action: 'commission.update', entityType: 'ctv_profile', entityId: ctv.id,
      oldValue: { commission_rate: before.commission_rate },
      newValue: { commission_rate: toNumber(ctv.commission_rate) },
      ip: ctx.ip || null
    });
  }

  return publicProfile(ctv);
};

const setCtvStatus = async (id, status, ctx = {}) => {
  if (!['active', 'locked'].includes(status)) { const e = new Error('status không hợp lệ'); e.status = 400; throw e; }
  const ctv = await getCtvProfile(id);
  const before = ctv.status;
  ctv.status = status;
  ctv.updated_at = new Date();
  await ctv.save();
  await auditService.log({
    actorType: 'admin', actorId: ctx.actorId || null,
    action: status === 'locked' ? 'ctv.lock' : 'ctv.unlock',
    entityType: 'ctv_profile', entityId: ctv.id,
    oldValue: { status: before }, newValue: { status }, ip: ctx.ip || null
  });
  return publicProfile(ctv);
};

const getCtvStats = async (id) => {
  const [agg, customerCount, wallet, pendingPayout] = await Promise.all([
    Order.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'revenue'],
        [sequelize.fn('SUM', sequelize.col('commission_amount')), 'platform'],
        [sequelize.fn('SUM', sequelize.col('ctv_earning_amount')), 'earning'],
        [sequelize.fn('SUM', sequelize.col('card_quantity')), 'cards']
      ],
      where: { ctv_id: id, status: 'paid' }, raw: true
    }),
    Customer.count({ where: { ctv_id: id } }),
    walletService.getSummary(id),
    PayoutRequest.sum('amount', { where: { ctv_id: id, status: 'pending' } })
  ]);

  return {
    paid_orders: Number(agg?.orders) || 0,
    revenue: roundVnd(agg?.revenue || 0),
    platform_commission: roundVnd(agg?.platform || 0),
    ctv_earning_total: roundVnd(agg?.earning || 0),
    cards_sold: Number(agg?.cards) || 0,
    customers: customerCount,
    wallet_balance: wallet.balance,
    pending_payout: roundVnd(pendingPayout || 0),
    paid_to_ctv: wallet.total_paid,
    unpaid_to_ctv: roundVnd(wallet.balance + wallet.pending_balance)
  };
};

// ---------------- Products (giá sàn) ----------------
const listProducts = async () => {
  const rows = await Product.findAll({ order: [['card_quantity', 'ASC']] });
  return rows.map((p) => ({
    id: p.id, code: p.code, name: p.name, card_quantity: p.card_quantity,
    base_price: roundVnd(p.base_price), active: p.active
  }));
};

const updateProduct = async (id, body, ctx = {}) => {
  const product = await Product.findByPk(id);
  if (!product) { const e = new Error('Không tìm thấy sản phẩm'); e.status = 404; throw e; }
  const before = { base_price: roundVnd(product.base_price), name: product.name, active: product.active };

  if (body.base_price !== undefined) {
    const v = roundVnd(body.base_price);
    if (!Number.isFinite(v) || v <= 0) { const e = new Error('Giá sàn phải là số dương'); e.status = 400; throw e; }
    product.base_price = v;
  }
  if (body.name !== undefined) product.name = String(body.name).trim();
  if (body.active !== undefined) product.active = Boolean(body.active);
  product.updated_at = new Date();
  await product.save();

  await auditService.log({
    actorType: 'admin', actorId: ctx.actorId || null,
    action: 'price.update', entityType: 'product', entityId: product.id,
    oldValue: before, newValue: { base_price: roundVnd(product.base_price), name: product.name, active: product.active },
    ip: ctx.ip || null
  });

  // Cảnh báo: CTV nào đang có giá dưới sàn mới.
  const field = product.code === 'combo' ? 'combo_price' : 'single_price';
  const below = await CtvProfile.findAll({
    where: { [field]: { [Op.lt]: roundVnd(product.base_price) } },
    attributes: ['id', 'display_name', field]
  });

  return {
    product: { id: product.id, code: product.code, name: product.name, base_price: roundVnd(product.base_price), active: product.active },
    ctvs_below_floor: below.map((c) => ({ id: c.id, display_name: c.display_name, price: roundVnd(c[field]) }))
  };
};

// ---------------- Orders / Customers / Payments (đọc toàn hệ) ----------------
const listAllOrders = async ({ ctvId, customerId, status, page = 1, limit = 30 } = {}) => {
  const where = {};
  if (ctvId) where.ctv_id = ctvId;
  if (customerId) where.customer_id = customerId;
  if (status) where.status = status;
  const offset = (page - 1) * limit;
  const { count, rows } = await Order.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset,
    include: [
      { model: CtvProfile, as: 'ctv', attributes: ['id', 'display_name'] },
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }
    ]
  });
  return {
    items: rows.map((o) => ({
      id: o.id, kind: o.kind, status: o.status, product_code: o.product_code, card_quantity: o.card_quantity,
      amount: roundVnd(o.amount),
      admin_base_price: o.admin_base_price != null ? roundVnd(o.admin_base_price) : null,
      ctv_selling_price: o.ctv_selling_price != null ? roundVnd(o.ctv_selling_price) : null,
      commission_rate: o.commission_rate != null ? Number(o.commission_rate) : null,
      commission_amount: o.commission_amount != null ? roundVnd(o.commission_amount) : null,
      ctv_earning_amount: o.ctv_earning_amount != null ? roundVnd(o.ctv_earning_amount) : null,
      ctv: o.ctv, customer: o.customer,
      order_token: o.order_token, paid_at: o.paid_at, created_at: o.created_at
    })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

const listAllCustomers = async ({ ctvId, search = '', status, page = 1, limit = 30 } = {}) => {
  const where = {};
  if (ctvId) where.ctv_id = ctvId;
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } }
    ];
  }
  const offset = (page - 1) * limit;
  const { count, rows } = await Customer.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset,
    include: [
      { model: User, as: 'user', attributes: ['id', 'username'] },
      { model: CtvProfile, as: 'ctv', attributes: ['id', 'display_name'] }
    ]
  });
  return {
    items: rows.map((c) => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email, status: c.status,
      username: c.user?.username, ctv: c.ctv,
      cards_purchased: c.cards_purchased, cards_used: c.cards_used, cards_available: c.cards_available,
      created_at: c.created_at
    })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

const listPaymentTransactions = async ({ orderId, status, page = 1, limit = 30 } = {}) => {
  const where = {};
  if (orderId) where.order_id = orderId;
  if (status) where.status = status;
  const offset = (page - 1) * limit;
  const { count, rows } = await PaymentTransaction.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset
  });
  return {
    items: rows.map((t) => ({
      id: t.id, order_id: t.order_id, provider: t.provider, event_id: t.event_id,
      provider_txn_ref: t.provider_txn_ref, amount: roundVnd(t.amount), status: t.status,
      signature_valid: t.signature_valid, processed_at: t.processed_at, created_at: t.created_at
    })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

// ---------------- Đối soát ----------------
const reconciliation = async ({ ctvId } = {}) => {
  const where = ctvId ? { id: ctvId } : {};
  const ctvs = await CtvProfile.findAll({
    where, order: [['display_name', 'ASC']],
    include: [{ model: Wallet, as: 'wallet' }]
  });
  const rows = [];
  for (const ctv of ctvs) {
    const agg = await Order.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'revenue'],
        [sequelize.fn('SUM', sequelize.col('commission_amount')), 'platform'],
        [sequelize.fn('SUM', sequelize.col('ctv_earning_amount')), 'earning']
      ],
      where: { ctv_id: ctv.id, status: 'paid' }, raw: true
    });
    const w = ctv.wallet || {};
    rows.push({
      ctv_id: ctv.id,
      display_name: ctv.display_name,
      bank: { name: ctv.bank_name, number: ctv.bank_account_number, holder: ctv.bank_account_name },
      paid_orders: Number(agg?.orders) || 0,
      revenue: roundVnd(agg?.revenue || 0),
      platform_commission: roundVnd(agg?.platform || 0),
      ctv_earning_total: roundVnd(agg?.earning || 0),
      paid_to_ctv: roundVnd(w.total_paid || 0),
      wallet_balance: roundVnd(w.balance || 0),
      pending_payout: roundVnd(w.pending_balance || 0),
      unpaid_to_ctv: roundVnd((Number(w.balance) || 0) + (Number(w.pending_balance) || 0))
    });
  }
  return rows;
};

// ---------------- Audit logs ----------------
const listAuditLogs = async ({ entityType, entityId, actorType, action, page = 1, limit = 50 } = {}) => {
  const where = {};
  if (entityType) where.entity_type = entityType;
  if (entityId) where.entity_id = entityId;
  if (actorType) where.actor_type = actorType;
  if (action) where.action = action;
  const offset = (page - 1) * limit;
  const { count, rows } = await AuditLog.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset
  });
  return {
    items: rows,
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

module.exports = {
  listCtvs,
  createCtv,
  getCtvDetail,
  updateCtv,
  setCtvStatus,
  getCtvStats,
  listProducts,
  updateProduct,
  listAllOrders,
  listAllCustomers,
  listPaymentTransactions,
  reconciliation,
  listAuditLogs,
  publicProfile
};
