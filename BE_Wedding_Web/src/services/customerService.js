const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { assertCredentials, BCRYPT_ROUNDS } = require('../utils/credentials');
const { Op } = require('sequelize');
const {
  sequelize, User, Customer, CtvProfile, Order, Invitation, CardEntitlement,
  Groom, Bride, InvitationTemplate
} = require('../models');
const { getLockState } = require('../utils/editLock');
const auditService = require('./auditService');
const notifyService = require('./notifyService');
const invitationService = require('./invitationService');

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
const createCustomer = async (ctv, { name, email, phone, username, password, cards = 1, slot }, ctx = {}) => {
  assertCtvActive(ctv);
  const { username: uname, password: pwd } = assertCredentials(username, password);

  const existed = await User.findOne({ where: { username: uname } });
  if (existed) { const e = new Error('username đã tồn tại'); e.status = 409; throw e; }

  const cardQty = Number(slot !== undefined ? slot : cards) > 0 ? Math.floor(Number(slot !== undefined ? slot : cards)) : 0;
  const initStatus = cardQty > 0 ? 'active' : 'pending_payment';

  const created = await sequelize.transaction(async (transaction) => {
    const now = new Date();
    const user = await User.create({
      id: randomUUID(),
      username: uname,
      password: await bcrypt.hash(pwd, BCRYPT_ROUNDS),
      role: 'user',
      slot: cardQty,
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
      status: initStatus,
      cards_purchased: cardQty,
      cards_used: 0,
      cards_available: cardQty,
      activated_at: cardQty > 0 ? now : null,
      created_at: now,
      updated_at: now
    }, { transaction });

    await auditService.log({
      actorType: 'ctv', actorId: ctx.actorId || null,
      action: 'customer.create', entityType: 'customer', entityId: customer.id,
      newValue: { name: customer.name, phone: customer.phone, ctv_id: ctv.id, cards: cardQty, status: initStatus },
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
      { email: { [Op.iLike]: `%${search}%` } },
      { '$user.username$': { [Op.iLike]: `%${search}%` } }
    ];
  }
  const offset = (Number(page) - 1) * Number(limit);
  const { count, rows } = await Customer.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit: Number(limit), offset,
    include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
  });

  // Tổng tiền đã thanh toán mỗi khách.
  const ids = rows.map((r) => r.id);
  const userIds = rows.map((r) => r.user_id).filter(Boolean);

  const [paidSums, invCounts] = await Promise.all([
    ids.length
      ? Order.findAll({
        attributes: ['customer_id', [sequelize.fn('SUM', sequelize.col('amount')), 's'], [sequelize.fn('COUNT', sequelize.col('id')), 'c']],
        where: { customer_id: { [Op.in]: ids }, status: 'paid' },
        group: ['customer_id']
      })
      : [],
    userIds.length
      ? Invitation.findAll({
        attributes: ['users_id', [sequelize.fn('COUNT', sequelize.col('id')), 'c']],
        where: { users_id: { [Op.in]: userIds } },
        group: ['users_id']
      })
      : []
  ]);

  const sumMap = Object.fromEntries(paidSums.map((x) => [String(x.customer_id), { total: Number(x.get('s')) || 0, orders: Number(x.get('c')) || 0 }]));
  const invMap = Object.fromEntries(invCounts.map((x) => [String(x.users_id), Number(x.get('c')) || 0]));

  return {
    items: rows.map((r) => ({
      ...publicCustomer(r),
      total_paid: sumMap[String(r.id)]?.total || 0,
      paid_orders: sumMap[String(r.id)]?.orders || 0,
      invitation_count: invMap[String(r.user_id)] || 0
    })),
    pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil(count / Number(limit)) }
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

const updateCustomer = async (customerId, ctv, { name, email, phone, password, cards_available, slot }, ctx = {}) => {
  assertCtvActive(ctv);
  const customer = await getCustomerOwnedByCtv(customerId, ctv);
  const before = { name: customer.name, email: customer.email, phone: customer.phone, status: customer.status };
  if (name !== undefined) customer.name = String(name).trim();
  if (email !== undefined) customer.email = email ? String(email).trim() : null;
  if (phone !== undefined) customer.phone = phone ? String(phone).trim() : null;

  const targetSlots = slot !== undefined ? slot : cards_available;
  if (targetSlots !== undefined && Number(targetSlots) >= 0) {
    const newQty = Number(targetSlots);
    const diff = newQty - customer.cards_available;
    customer.cards_available = newQty;
    if (diff > 0) customer.cards_purchased += diff;
    if (newQty > 0 && customer.status !== 'active') {
      customer.status = 'active';
      customer.activated_at = customer.activated_at || new Date();
    }
    const user = await User.findByPk(customer.user_id);
    if (user) {
      user.slot = newQty;
      await user.save();
    }
  }

  if (password) {
    if (String(password).length < 6) {
      const e = new Error('Mật khẩu tối thiểu 6 ký tự');
      e.status = 400;
      throw e;
    }
    const user = await User.findByPk(customer.user_id);
    if (user) {
      user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
      user.updated_at = new Date();
      await user.save();
    }
  }

  customer.updated_at = new Date();
  await customer.save();
  await auditService.log({
    actorType: 'ctv', actorId: ctx.actorId || null,
    action: 'customer.update', entityType: 'customer', entityId: customer.id,
    oldValue: before, newValue: { name: customer.name, email: customer.email, phone: customer.phone, status: customer.status },
    ip: ctx.ip || null
  });
  return publicCustomer(customer);
};

const deleteCustomer = async (customerId, ctv, ctx = {}) => {
  assertCtvActive(ctv);
  const customer = await getCustomerOwnedByCtv(customerId, ctv);
  const user = await User.findByPk(customer.user_id);
  await sequelize.transaction(async (t) => {
    await Invitation.destroy({ where: { users_id: customer.user_id }, transaction: t });
    await CardEntitlement.destroy({ where: { customer_id: customer.id }, transaction: t });
    await Order.destroy({ where: { customer_id: customer.id }, transaction: t });
    await Customer.destroy({ where: { id: customer.id }, transaction: t });
    if (user) await user.destroy({ transaction: t });
  });
  await auditService.log({
    actorType: 'ctv', actorId: ctx.actorId || null,
    action: 'customer.delete', entityType: 'customer', entityId: customer.id,
    ip: ctx.ip || null
  });
  return true;
};

const getCustomerCards = async (customerId, ctv) => {
  const customer = await getCustomerOwnedByCtv(customerId, ctv);
  const invitations = await Invitation.findAll({
    where: { users_id: customer.user_id },
    order: [['created_at', 'DESC']],
    include: [
      { model: Groom, as: 'groom', attributes: ['id', 'name_groom'] },
      { model: Bride, as: 'bride', attributes: ['id', 'name_bride'] },
      { model: InvitationTemplate, as: 'template', attributes: ['id', 'template_name', 'template_code'] }
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
    invitations: invitations.map((i) => {
      const p = i.toJSON();
      p.lock_state = getLockState(p);
      return p;
    })
  };
};

// CTV tạo thiệp hộ khách hàng
const createInvitationForCustomer = async (customerId, ctv, templateId, ctx = {}) => {
  assertCtvActive(ctv);
  const customer = await getCustomerOwnedByCtv(customerId, ctv);
  if (!templateId) {
    const e = new Error('Vui lòng chọn mẫu thiệp (template_id)');
    e.status = 400;
    throw e;
  }

  // Tự động kích hoạt tài khoản khách nếu chưa kích hoạt
  if (customer.status !== 'active') {
    customer.status = 'active';
    customer.activated_at = customer.activated_at || new Date();
  }

  if (customer.cards_available > 0) {
    customer.cards_available -= 1;
    customer.cards_used += 1;
  } else {
    customer.cards_purchased += 1;
    customer.cards_used += 1;
  }
  customer.updated_at = new Date();
  await customer.save();

  // Tạo draft thiệp gán thẳng vào user_id của khách
  const invitation = await invitationService.createDraft(templateId, customer.user_id, {
    chargeSlot: false,
    actor: { id: ctv.user_id, role: 'ctv' }
  });

  await auditService.log({
    actorType: 'ctv', actorId: ctx.actorId || null,
    action: 'customer.create_invitation', entityType: 'invitation', entityId: invitation.id,
    newValue: { customer_id: customer.id, template_id: templateId },
    ip: ctx.ip || null
  });

  return invitation;
};

// Danh sách toàn bộ thiệp thuộc các khách hàng của CTV
const listInvitationsForCtv = async (ctv, { search = '', page = 1, limit = 30, customerId } = {}) => {
  const custWhere = { ctv_id: ctv.id };
  if (customerId) custWhere.id = customerId;
  const customers = await Customer.findAll({
    where: custWhere,
    attributes: ['id', 'user_id', 'name', 'phone', 'email']
  });
  const userIds = customers.map((c) => c.user_id).filter(Boolean);
  if (!userIds.length) {
    return { items: [], pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 } };
  }
  const custMap = Object.fromEntries(customers.map((c) => [c.user_id, c]));

  const where = { users_id: { [Op.in]: userIds } };
  if (search) {
    where[Op.or] = [
      { title_vi: { [Op.iLike]: `%${search}%` } },
      { invitation_slug: { [Op.iLike]: `%${search}%` } }
    ];
  }
  const offset = (Number(page) - 1) * Number(limit);
  const { count, rows } = await Invitation.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset,
    include: [
      { model: Groom, as: 'groom', attributes: ['id', 'name_groom'] },
      { model: Bride, as: 'bride', attributes: ['id', 'name_bride'] },
      { model: InvitationTemplate, as: 'template', attributes: ['id', 'template_name', 'template_code'] }
    ]
  });

  return {
    items: rows.map((inv) => {
      const p = inv.toJSON();
      p.customer = custMap[p.users_id] || null;
      p.lock_state = getLockState(p);
      return p;
    }),
    pagination: {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / Number(limit))
    }
  };
};

const ensureCtvOwnsInvitation = async (invitationId, ctv) => {
  const item = await Invitation.findByPk(invitationId);
  if (!item) { const e = new Error('Không tìm thấy thiệp'); e.status = 404; throw e; }
  const customer = await Customer.findOne({ where: { user_id: item.users_id, ctv_id: ctv.id } });
  if (!customer) { const e = new Error('Bạn không có quyền quản lý thiệp này'); e.status = 403; throw e; }
  return item;
};

const lockInvitationForCtv = async (invitationId, ctv) => {
  assertCtvActive(ctv);
  const item = await ensureCtvOwnsInvitation(invitationId, ctv);
  const past = new Date(); past.setUTCFullYear(past.getUTCFullYear() - 1);
  item.edit_deadline = past;
  item.updated_at = new Date();
  await item.save();
  const p = item.toJSON();
  p.lock_state = getLockState(p);
  return p;
};

const unlockInvitationForCtv = async (invitationId, ctv, { extendDays } = {}) => {
  assertCtvActive(ctv);
  const item = await ensureCtvOwnsInvitation(invitationId, ctv);
  item.edit_count = 0;
  if (extendDays) {
    const base = item.edit_deadline ? new Date(item.edit_deadline) : new Date();
    base.setUTCDate(base.getUTCDate() + Number.parseInt(extendDays, 10));
    item.edit_deadline = base;
  } else {
    item.edit_deadline = null;
  }
  item.updated_at = new Date();
  await item.save();
  const p = item.toJSON();
  p.lock_state = getLockState(p);
  return p;
};

const resetCustomerPassword = async (customerId, ctv, newPassword, ctx = {}) => {
  assertCtvActive(ctv);
  const customer = await getCustomerOwnedByCtv(customerId, ctv);
  if (!newPassword || newPassword.length < 6) {
    const e = new Error('Mật khẩu phải từ 6 ký tự trở lên'); e.status = 400; throw e;
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS || 10);
  await User.update({ password: hash, updated_at: new Date() }, { where: { id: customer.user_id } });
  await auditService.log({
    actorType: 'ctv', actorId: ctx.actorId || null,
    action: 'customer.reset_password', entityType: 'customer', entityId: customer.id,
    newValue: { username: customer.user?.username },
    ip: ctx.ip || null
  });
  return { success: true };
};

module.exports = {
  resolveCtv,
  assertCtvActive,
  createCustomer,
  listCustomers,
  getCustomerOwnedByCtv,
  getCustomerDetail,
  updateCustomer,
  deleteCustomer,
  getCustomerCards,
  createInvitationForCustomer,
  listInvitationsForCtv,
  lockInvitationForCtv,
  unlockInvitationForCtv,
  resetCustomerPassword,
  publicCustomer
};
