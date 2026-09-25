const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { assertCredentials, BCRYPT_ROUNDS } = require('../utils/credentials');
const { Op } = require('sequelize');
const {
  sequelize, User, Customer, CtvProfile, Order, Invitation, CardEntitlement,
  Groom, Bride
} = require('../models');
const auditService = require('./auditService');
const notifyService = require('./notifyService');

const publicCustomer = (c) => ({
  id: c.id,
  ctv_id: c.ctv_id,
  name: c.name,
  email: c.email,
  phone: c.phone,
  status: c.status,
  username: c.user ? c.user.username : undefined,
  cards_purchased: c.cards_purchased,
  cards_used: c.cards_used,
  cards_available: c.cards_available,
  activated_at: c.activated_at,
  created_at: c.created_at
});

const resolveCtv = async (userId) => {
  const ctv = await CtvProfile.findOne({ where: { user_id: userId } });
  if (!ctv) { const e = new Error('Không tìm thấy hồ sơ CTV'); e.status = 404; throw e; }
  return ctv;
};

const assertCtvActive = (ctv) => {
  if (ctv.status !== 'active') {
    const e = new Error('Tài khoản CTV đang bị khoá, không thể thao tác'); e.status = 403; throw e;
  }
};

// CTV tạo tài khoản khách. Trả lại username/password để CTV bàn giao cho khách.
const createCustomer = async (ctv, { name, email, phone, username, password }, ctx = {}) => {
  assertCtvActive(ctv);
  // CTV bàn giao username/password này cho khách -> vẫn phải đủ mạnh.
  const { username: uname, password: pwd } = assertCredentials(username, password);

  const existed = await User.findOne({ where: { username: uname } });
  if (existed) { const e = new Error('username đã tồn tại'); e.status = 409; throw e; }

  const created = await sequelize.transaction(async (transaction) => {
    const now = new Date();
    const user = await User.create({
      id: randomUUID(),
      username: uname,
      password: await bcrypt.hash(pwd, BCRYPT_ROUNDS),
      role: 'user',
      slot: 0,
      created_at: now,
      updated_at: now
    }, { transaction });

    const customer = await Customer.create({
      id: randomUUID(),
      user_id: user.id,
      ctv_id: ctv.id,
      name: String(name || uname).trim(),
      email: email ? String(email).trim() : null,
      phone: phone ? String(phone).trim() : null,
      status: 'pending_payment',
      cards_purchased: 0, cards_used: 0, cards_available: 0,
      created_at: now, updated_at: now
    }, { transaction });

    await auditService.log({
      actorType: 'ctv', actorId: ctx.actorId || null,
      action: 'customer.create', entityType: 'customer', entityId: customer.id,
      newValue: { name: customer.name, phone: customer.phone, ctv_id: ctv.id },
      ip: ctx.ip || null
    }, { transaction });

    return { user, customer };
  });

  notifyService.customerCreated({
    customer: {
      name: created.customer.name,
      username: created.user.username,
      phone: created.customer.phone,
      created_at: created.customer.created_at
    },
    ctvName: ctv.display_name
  });

  return { ...publicCustomer({ ...created.customer.toJSON(), user: created.user }), password: pwd };
};

const listCustomers = async (ctv, { search = '', status, page = 1, limit = 30 } = {}) => {
  const where = { ctv_id: ctv.id };
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }
  const offset = (page - 1) * limit;
  const { count, rows } = await Customer.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset,
    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
  });

  // Tổng tiền đã thanh toán mỗi khách.
  const ids = rows.map((r) => r.id);
  const paidSums = ids.length
    ? await Order.findAll({
      attributes: ['customer_id', [sequelize.fn('SUM', sequelize.col('amount')), 's'], [sequelize.fn('COUNT', sequelize.col('id')), 'c']],
      where: { customer_id: { [Op.in]: ids }, status: 'paid' },
      group: ['customer_id']
    })
    : [];
  const sumMap = Object.fromEntries(paidSums.map((x) => [String(x.customer_id), { total: Number(x.get('s')) || 0, orders: Number(x.get('c')) || 0 }]));

  return {
    items: rows.map((r) => ({
      ...publicCustomer(r),
      total_paid: sumMap[String(r.id)]?.total || 0,
      paid_orders: sumMap[String(r.id)]?.orders || 0
    })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

const getCustomerOwnedByCtv = async (customerId, ctv, options = {}) => {
  const customer = await Customer.findByPk(customerId, {
    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }],
    ...options
  });
  if (!customer || String(customer.ctv_id) !== String(ctv.id)) {
    const e = new Error('Không tìm thấy khách hàng thuộc quyền quản lý của bạn'); e.status = 404; throw e;
  }
  return customer;
};

const getCustomerDetail = async (customerId, ctv) => {
  const customer = await getCustomerOwnedByCtv(customerId, ctv);
  const [orders, entitlements] = await Promise.all([
    Order.findAll({ where: { customer_id: customerId }, order: [['created_at', 'DESC']], limit: 50 }),
    CardEntitlement.findAll({ where: { customer_id: customerId }, order: [['created_at', 'DESC']], limit: 50 })
  ]);
  return {
    customer: publicCustomer(customer),
    orders: orders.map((o) => ({
      id: o.id, status: o.status, product_code: o.product_code, card_quantity: o.card_quantity,
      amount: Number(o.amount), order_token: o.order_token, pay_page_url: o.order_token ? `/pay/${o.order_token}` : null,
      created_at: o.created_at, paid_at: o.paid_at
    })),
    entitlements: entitlements.map((e) => ({
      delta: e.delta, reason: e.reason, available_after: e.available_after,
      purchased_after: e.purchased_after, used_after: e.used_after, created_at: e.created_at
    }))
  };
};

const updateCustomer = async (customerId, ctv, { name, email, phone }, ctx = {}) => {
  assertCtvActive(ctv);
  const customer = await getCustomerOwnedByCtv(customerId, ctv);
  const before = { name: customer.name, email: customer.email, phone: customer.phone };
  if (name !== undefined) customer.name = String(name).trim();
  if (email !== undefined) customer.email = email ? String(email).trim() : null;
  if (phone !== undefined) customer.phone = phone ? String(phone).trim() : null;
  customer.updated_at = new Date();
  await customer.save();
  await auditService.log({
    actorType: 'ctv', actorId: ctx.actorId || null,
    action: 'customer.update', entityType: 'customer', entityId: customer.id,
    oldValue: before, newValue: { name: customer.name, email: customer.email, phone: customer.phone },
    ip: ctx.ip || null
  });
  return publicCustomer(customer);
};

const getCustomerCards = async (customerId, ctv) => {
  const customer = await getCustomerOwnedByCtv(customerId, ctv);
  const invitations = await Invitation.findAll({
    where: { users_id: customer.user_id },
    order: [['created_at', 'DESC']],
    include: [
      { model: Groom, as: 'groom', attributes: ['id', 'name_groom'] },
      { model: Bride, as: 'bride', attributes: ['id', 'name_bride'] }
    ]
  });
  return {
    customer: publicCustomer(customer),
    counters: {
      purchased: customer.cards_purchased,
      used: customer.cards_used,
      available: customer.cards_available
    },
    can_edit: customer.status === 'active',
    invitations: invitations.map((i) => ({
      id: i.id,
      title_vi: i.title_vi,
      slug: i.invitation_slug,
      groom: i.groom ? i.groom.name_groom : null,
      bride: i.bride ? i.bride.name_bride : null,
      created_at: i.created_at,
      updated_at: i.updated_at
    }))
  };
};

module.exports = {
  resolveCtv,
  assertCtvActive,
  createCustomer,
  listCustomers,
  getCustomerOwnedByCtv,
  getCustomerDetail,
  updateCustomer,
  getCustomerCards,
  publicCustomer
};
