const { Op } = require('sequelize');
const { Customer, CardEntitlement, User, sequelize } = require('../models');
const { applyEntitlementDelta } = require('../utils/entitlementMath');

// Nguồn chân lý: card_entitlements (ledger). customers.cards_* là cache.
// Bất biến duy trì trong service:
//   cards_available === users.slot (của user gắn với customer)
//   cards_available === cards_purchased - cards_used   (khi không có admin_adjust âm/refund)
//   cards_available >= 0  (CHECK ở DB + kiểm ở đây)

const lockedCustomer = async (customerId, transaction) => {
  const customer = await Customer.findByPk(customerId, {
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined
  });
  if (!customer) {
    const e = new Error('Không tìm thấy khách hàng');
    e.status = 404;
    throw e;
  }
  return customer;
};

const writeLedgerAndCache = async (customer, { delta, reason, orderId = null, invitationId = null, note = null }, transaction) => {
  const next = applyEntitlementDelta(
    { purchased: customer.cards_purchased, used: customer.cards_used },
    { delta, reason }
  );
  const { purchased, used, available } = next;

  customer.cards_purchased = purchased;
  customer.cards_used = used;
  customer.cards_available = available;
  customer.updated_at = new Date();
  await customer.save({ transaction });

  // Đồng bộ users.slot = cards_available để invitationService cũ vẫn đúng.
  await User.update(
    { slot: available, updated_at: new Date() },
    { where: { id: customer.user_id }, transaction }
  );

  await CardEntitlement.create({
    customer_id: customer.id,
    order_id: orderId,
    invitation_id: invitationId,
    delta,
    reason,
    purchased_after: purchased,
    used_after: used,
    available_after: available,
    note,
    created_at: new Date()
  }, { transaction });

  return { purchased, used, available };
};

// Cộng quyền khi thanh toán thành công (mỗi lần thanh toán = 1 lần cộng).
const creditPurchase = async (customerId, { orderId, quantity, note = null }, options = {}) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    const e = new Error('quantity phải là số nguyên dương'); e.status = 400; throw e;
  }
  const transaction = options.transaction;
  const customer = await lockedCustomer(customerId, transaction);
  return writeLedgerAndCache(customer, { delta: quantity, reason: 'purchase', orderId, note }, transaction);
};

// Trừ 1 quyền khi khách/CTV tạo 1 thiệp mới. Chặn khi hết quyền.
//
// BẮT BUỘC gọi trong transaction: lockedCustomer() dùng SELECT ... FOR UPDATE, nên
// khi nhiều request tạo thiệp chạy song song thì chúng phải xếp hàng, request thứ hai
// đọc được số dư ĐÃ bị trừ và bị chặn đúng lúc. Nếu gọi ngoài transaction thì không
// có khoá, và N request đồng thời đều thấy "còn lượt" -> tạo được N thiệp từ 1 lượt.
const debitForCardCreation = async (customerId, { invitationId = null, note = null }, options = {}) => {
  const transaction = options.transaction;
  if (!transaction) {
    throw new Error('debitForCardCreation phải chạy trong transaction để khoá được dòng khách hàng');
  }
  const customer = await lockedCustomer(customerId, transaction);
  if (customer.cards_available <= 0) {
    const e = new Error('Khách đã hết lượt tạo thiệp. Vui lòng tạo đơn mua thêm.');
    e.status = 403;
    throw e;
  }
  return writeLedgerAndCache(customer, { delta: -1, reason: 'card_created', invitationId, note }, transaction);
};

// Trừ 1 lượt của tài khoản TỰ PHỤC VỤ (users.slot, không gắn Customer của CTV).
//
// Dùng UPDATE ... WHERE slot > 0 nên việc kiểm tra và trừ diễn ra trong CÙNG một câu
// lệnh nguyên tử ở DB. Trả về số dòng bị ảnh hưởng: 0 nghĩa là đã hết lượt.
// Cách cũ (user.decrement) không kiểm điều kiện nên slot tụt xuống ÂM khi có nhiều
// request song song — đã đo được slot = -7 sau 12 request đồng thời.
const debitUserSlot = async (userId, options = {}) => {
  const transaction = options.transaction;
  const [affected] = await User.update(
    { slot: sequelize.literal('slot - 1'), updated_at: new Date() },
    { where: { id: userId, slot: { [Op.gt]: 0 } }, transaction }
  );
  if (!affected) {
    const e = new Error('Bạn đã hết lượt tạo thiệp. Vui lòng liên hệ admin để được cấp thêm.');
    e.status = 403;
    throw e;
  }
  return true;
};

// Đảo quyền khi hoàn tiền 1 đơn.
const reverseForRefund = async (customerId, { orderId, quantity, note = null }, options = {}) => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    const e = new Error('quantity phải là số nguyên dương'); e.status = 400; throw e;
  }
  const transaction = options.transaction;
  const customer = await lockedCustomer(customerId, transaction);
  return writeLedgerAndCache(
    customer,
    { delta: -quantity, reason: 'refund', orderId, note: note || 'Hoàn tiền đơn hàng' },
    transaction
  );
};

const adminAdjust = async (customerId, delta, note, options = {}) => {
  if (!Number.isInteger(delta) || delta === 0) {
    const e = new Error('delta phải là số nguyên khác 0'); e.status = 400; throw e;
  }
  const transaction = options.transaction;
  const customer = await lockedCustomer(customerId, transaction);
  return writeLedgerAndCache(customer, { delta, reason: 'admin_adjust', note }, transaction);
};

// Dựng lại cache customers.cards_* + users.slot từ ledger (dùng khi nghi lệch).
const rebuild = async (customerId) => {
  return sequelize.transaction(async (transaction) => {
    const customer = await lockedCustomer(customerId, transaction);
    const rows = await CardEntitlement.findAll({ where: { customer_id: customerId }, transaction });
    let purchased = 0;
    let used = 0;
    for (const r of rows) {
      if (r.reason === 'card_created') used += -r.delta;
      else purchased += r.delta;
    }
    const available = Math.max(purchased - used, 0);
    customer.cards_purchased = purchased;
    customer.cards_used = used;
    customer.cards_available = available;
    customer.updated_at = new Date();
    await customer.save({ transaction });
    await User.update({ slot: available, updated_at: new Date() }, { where: { id: customer.user_id }, transaction });
    return { purchased, used, available };
  });
};

module.exports = {
  creditPurchase,
  debitForCardCreation,
  debitUserSlot,
  reverseForRefund,
  adminAdjust,
  rebuild
};
