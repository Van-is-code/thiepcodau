const { randomUUID } = require('crypto');
const {
  sequelize, Order, Customer, CtvProfile, User, Invoice, PaymentTransaction, Product
} = require('../models');
const pricingService = require('./pricingService');
const entitlementService = require('./entitlementService');
const walletService = require('./walletService');
const payosService = require('./payosService');
const collectionService = require('./collectionService');
const auditService = require('./auditService');
const notifyService = require('./notifyService');
const { roundVnd } = require('../utils/money');

const ORDER_TTL_HOURS = Number(process.env.PAYOS_ORDER_TTL_HOURS) || 24;
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

const payPageUrl = (token) => (FRONTEND_URL ? `${FRONTEND_URL}/pay/${token}` : `/pay/${token}`);

const publicOrderView = (order) => ({
  order_token: order.order_token,
  status: order.status,
  amount: roundVnd(order.amount),
  product_code: order.product_code,
  card_quantity: order.card_quantity,
  customer_name: order.customer ? order.customer.name : null,
  ctv_name: order.ctv ? order.ctv.display_name : null,
  created_at: order.created_at,
  expired_at: order.expired_at,
  paid_at: order.paid_at
});

// Tóm tắt đơn cho CTV / admin (không lộ gì nhạy cảm hơn mức cần).
const orderSummary = (order) => ({
  id: order.id,
  status: order.status,
  kind: order.kind,
  product_code: order.product_code,
  card_quantity: order.card_quantity,
  amount: roundVnd(order.amount),
  admin_base_price: order.admin_base_price != null ? roundVnd(order.admin_base_price) : null,
  ctv_selling_price: order.ctv_selling_price != null ? roundVnd(order.ctv_selling_price) : null,
  commission_rate: order.commission_rate != null ? Number(order.commission_rate) : null,
  commission_amount: order.commission_amount != null ? roundVnd(order.commission_amount) : null,
  ctv_earning_amount: order.ctv_earning_amount != null ? roundVnd(order.ctv_earning_amount) : null,
  ctv_id: order.ctv_id,
  customer_id: order.customer_id,
  payos_order_code: order.payos_order_code ? String(order.payos_order_code) : null,
  payos_checkout_url: order.payos_checkout_url,
  order_token: order.order_token,
  pay_page_url: order.order_token ? payPageUrl(order.order_token) : null,
  expired_at: order.expired_at,
  paid_at: order.paid_at,
  created_at: order.created_at
});

const isExpired = (order) => order.status === 'pending' && order.expired_at && new Date(order.expired_at).getTime() < Date.now();

// Tạo payment link payOS cho 1 order (dùng khi tạo mới hoặc làm mới sau khi hết hạn).
const attachPaymentLink = async (order, { regenerateCode = false } = {}) => {
  if (regenerateCode || !order.payos_order_code) {
    order.payos_order_code = payosService.generateOrderCode();
  }
  const desc = `TCD ${String(order.payos_order_code).slice(-8)}`;
  const link = await payosService.createPaymentLink({
    orderCode: order.payos_order_code,
    amount: roundVnd(order.amount),
    description: desc,
    expiredAt: order.expired_at,
    buyerName: order.customer?.name || undefined
  });
  order.payos_payment_link_id = link.paymentLinkId;
  order.payos_checkout_url = link.checkoutUrl;
  order.payos_qr = link.qrCode;
  return order;
};

// ---------------- CTV: tạo đơn ----------------
const createCtvOrder = async ({ ctvId, customerId, productCode }, ctx = {}) => {
  if (!payosService.isConfigured()) {
    const e = new Error('Cổng thanh toán payOS chưa được cấu hình. Liên hệ quản trị viên.');
    e.status = 503;
    throw e;
  }

  const ctv = await CtvProfile.findByPk(ctvId);
  if (!ctv) { const e = new Error('Không tìm thấy hồ sơ CTV'); e.status = 404; throw e; }
  if (ctv.status !== 'active') { const e = new Error('Tài khoản CTV đang bị khoá'); e.status = 403; throw e; }

  const customer = await Customer.findByPk(customerId);
  if (!customer) { const e = new Error('Không tìm thấy khách hàng'); e.status = 404; throw e; }
  if (String(customer.ctv_id) !== String(ctv.id)) {
    const e = new Error('Khách hàng này không thuộc quyền quản lý của bạn'); e.status = 403; throw e;
  }

  const quote = await pricingService.quoteForOrder({ ctvProfile: ctv, productCode });

  const now = new Date();
  const expiredAt = new Date(now.getTime() + ORDER_TTL_HOURS * 3600 * 1000);
  const token = randomUUID();

  let order = await Order.create({
    id: randomUUID(),
    users_id: customer.user_id,
    kind: 'ctv',
    ctv_id: ctv.id,
    customer_id: customer.id,
    product_id: quote.productId,
    product_code: quote.productCode,
    card_quantity: quote.cardQuantity,
    slot_quantity: quote.cardQuantity,
    amount: quote.sellingPrice,
    admin_base_price: quote.adminBasePrice,
    ctv_selling_price: quote.sellingPrice,
    commission_rate: quote.commissionRate,
    commission_amount: quote.commissionAmount,
    ctv_earning_amount: quote.ctvEarningAmount,
    status: 'pending',
    payment_provider: 'payos',
    order_token: token,
    transfer_content: `TCD${String(Date.now()).slice(-9)}`,
    expired_at: expiredAt,
    created_at: now,
    updated_at: now
  });

  // Gắn payment link (retry 1 lần nếu đụng orderCode duy nhất).
  try {
    await attachPaymentLink(order, { regenerateCode: true });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      await attachPaymentLink(order, { regenerateCode: true });
    } else {
      // Xoá đơn rỗng để không rác DB rồi ném lỗi.
      await order.destroy().catch(() => {});
      throw error;
    }
  }
  order.updated_at = new Date();
  await order.save();

  await auditService.log({
    actorType: 'ctv', actorId: ctx.actorId || null,
    action: 'order.create', entityType: 'order', entityId: order.id,
    newValue: {
      customer_id: customer.id, product_code: quote.productCode,
      ctv_selling_price: quote.sellingPrice, commission_rate: quote.commissionRate,
      commission_amount: quote.commissionAmount, ctv_earning_amount: quote.ctvEarningAmount
    },
    ip: ctx.ip || null
  });

  notifyService.orderCreated({ order, ctvName: ctv.display_name, customerName: customer.name });

  return {
    order: orderSummary(order),
    checkout: { checkoutUrl: order.payos_checkout_url, qr: order.payos_qr, orderCode: String(order.payos_order_code) },
    pay_page_url: payPageUrl(token)
  };
};

const listOrdersForCtv = async (ctvId, { status, customerId, page = 1, limit = 20 } = {}) => {
  const where = { ctv_id: ctvId };
  if (status) where.status = status;
  if (customerId) where.customer_id = customerId;
  const offset = (page - 1) * limit;
  const { count, rows } = await Order.findAndCountAll({
    where, order: [['created_at', 'DESC']], limit, offset,
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }]
  });
  return {
    items: rows.map((o) => ({ ...orderSummary(o), customer: o.customer })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
  };
};

const getOrderForCtv = async (orderId, ctvId) => {
  const order = await Order.findByPk(orderId, {
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'status'] }]
  });
  if (!order || String(order.ctv_id) !== String(ctvId)) {
    const e = new Error('Không tìm thấy đơn hàng'); e.status = 404; throw e;
  }
  return { ...orderSummary(order), customer: order.customer };
};

const cancelCtvOrder = async (orderId, ctvId, ctx = {}) => {
  const order = await Order.findByPk(orderId);
  if (!order || String(order.ctv_id) !== String(ctvId)) {
    const e = new Error('Không tìm thấy đơn hàng'); e.status = 404; throw e;
  }
  if (order.status !== 'pending') {
    const e = new Error(`Chỉ huỷ được đơn ở trạng thái chờ thanh toán (đơn đang ${order.status})`);
    e.status = 400; throw e;
  }
  order.status = 'cancelled';
  order.updated_at = new Date();
  await order.save();
  if (order.payos_order_code) {
    await payosService.cancelPaymentLink(order.payos_order_code, 'CTV huỷ đơn').catch(() => {});
  }
  await auditService.log({
    actorType: 'ctv', actorId: ctx.actorId || null,
    action: 'order.cancel', entityType: 'order', entityId: order.id, ip: ctx.ip || null
  });
  return orderSummary(order);
};

// Lấy lại thông tin thanh toán cho CTV (không tạo link mới nếu còn hạn).
const getPaymentInfoForCtv = async (orderId, ctvId) => {
  const order = await Order.findByPk(orderId, { include: [{ model: Customer, as: 'customer', attributes: ['name'] }] });
  if (!order || String(order.ctv_id) !== String(ctvId)) {
    const e = new Error('Không tìm thấy đơn hàng'); e.status = 404; throw e;
  }
  if (order.status === 'paid') return { status: 'paid', order: orderSummary(order) };
  if (['cancelled', 'refunded'].includes(order.status)) {
    return { status: order.status, order: orderSummary(order) };
  }
  if (isExpired(order)) {
    order.status = 'expired';
    await order.save();
    return { status: 'expired', order: orderSummary(order), can_refresh: true };
  }
  return {
    status: 'pending',
    order: orderSummary(order),
    checkout: { checkoutUrl: order.payos_checkout_url, qr: order.payos_qr, orderCode: String(order.payos_order_code) }
  };
};

// ---------------- Trang thanh toán công khai /pay/:token ----------------
const getPublicOrder = async (token) => {
  const order = await Order.findOne({
    where: { order_token: token },
    include: [
      { model: Customer, as: 'customer', attributes: ['name'] },
      { model: CtvProfile, as: 'ctv', attributes: ['display_name'] }
    ]
  });
  if (!order) { const e = new Error('Không tìm thấy đơn thanh toán'); e.status = 404; throw e; }

  if (isExpired(order)) {
    order.status = 'expired';
    await order.save();
  }

  const view = publicOrderView(order);
  if (order.status === 'pending') {
    view.checkout = {
      checkoutUrl: order.payos_checkout_url,
      qr: order.payos_qr,
      orderCode: String(order.payos_order_code)
    };
  }
  view.can_refresh = order.status === 'expired';
  return view;
};

// Làm mới link khi HẾT HẠN — cho chính Order đó, KHÔNG tạo Customer/Order mới.
const refreshPublicPayment = async (token, ctx = {}) => {
  if (!payosService.isConfigured()) {
    const e = new Error('Cổng thanh toán payOS chưa được cấu hình.'); e.status = 503; throw e;
  }
  const order = await Order.findOne({
    where: { order_token: token },
    include: [{ model: Customer, as: 'customer', attributes: ['name'] }]
  });
  if (!order) { const e = new Error('Không tìm thấy đơn thanh toán'); e.status = 404; throw e; }

  if (order.status === 'paid') return getPublicOrder(token);
  if (['cancelled', 'refunded'].includes(order.status)) {
    const e = new Error(`Đơn đã ${order.status === 'cancelled' ? 'bị huỷ' : 'được hoàn tiền'}, không thể thanh toán.`);
    e.status = 400; throw e;
  }

  // Còn hạn -> trả lại link cũ (không tạo mới).
  if (order.status === 'pending' && !isExpired(order)) return getPublicOrder(token);

  // Hết hạn -> huỷ link cũ, tạo link mới với orderCode mới, gia hạn.
  if (order.payos_order_code) {
    await payosService.cancelPaymentLink(order.payos_order_code, 'Tạo lại link do hết hạn').catch(() => {});
  }
  order.expired_at = new Date(Date.now() + ORDER_TTL_HOURS * 3600 * 1000);
  order.status = 'pending';
  await attachPaymentLink(order, { regenerateCode: true });
  order.updated_at = new Date();
  await order.save();

  await auditService.log({
    actorType: 'system', action: 'payment.link_refresh',
    entityType: 'order', entityId: order.id, ip: ctx.ip || null
  });

  return getPublicOrder(token);
};

// ---------------- Settlement (chạy trong transaction webhook) ----------------
const settlePaidOrder = async (order, meta, options = {}) => {
  const transaction = options.transaction;
  const qty = order.card_quantity || order.slot_quantity || 1;

  order.status = 'paid';
  order.paid_at = new Date();
  order.transaction_id = meta.providerTxnRef || order.transaction_id;
  order.updated_at = new Date();
  await order.save({ transaction });

  // Kích hoạt khách nếu đang chờ thanh toán.
  let customerActivated = false;
  if (order.customer_id) {
    const customer = await Customer.findByPk(order.customer_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (customer && customer.status === 'pending_payment') {
      const before = customer.status;
      customer.status = 'active';
      customer.activated_at = new Date();
      customer.updated_at = new Date();
      await customer.save({ transaction });
      customerActivated = true;
      await auditService.log({
        actorType: 'system', action: 'customer.activate',
        entityType: 'customer', entityId: customer.id,
        oldValue: { status: before }, newValue: { status: 'active' }
      }, { transaction });
    }

    // Cộng entitlement (+card_quantity).
    const ent = await entitlementService.creditPurchase(
      order.customer_id,
      { orderId: order.id, quantity: qty, note: `Thanh toán đơn ${order.id}` },
      { transaction }
    );
    await auditService.log({
      actorType: 'system', action: 'entitlement.add',
      entityType: 'customer', entityId: order.customer_id,
      newValue: { delta: qty, ...ent }
    }, { transaction });
  }

  // Cộng hoa hồng vào ví CTV.
  if (order.ctv_id && order.ctv_earning_amount != null) {
    const wtx = await walletService.creditCommission(
      order.ctv_id,
      { orderId: order.id, amount: order.ctv_earning_amount, note: `Hoa hồng đơn ${order.id}` },
      { transaction }
    );
    await auditService.log({
      actorType: 'system', action: 'commission.create',
      entityType: 'order', entityId: order.id,
      newValue: {
        ctv_selling_price: roundVnd(order.ctv_selling_price),
        commission_rate: Number(order.commission_rate),
        commission_amount: roundVnd(order.commission_amount),
        ctv_earning_amount: roundVnd(order.ctv_earning_amount)
      }
    }, { transaction });
    await auditService.log({
      actorType: 'system', action: 'wallet.credit',
      entityType: 'wallet_transaction', entityId: wtx.id,
      newValue: { amount: roundVnd(order.ctv_earning_amount), balance_after: roundVnd(wtx.balance_after) }
    }, { transaction });
  }

  // Sổ THU HỘ: ghi nhận nền tảng vừa thu bao nhiêu, giữ lại bao nhiêu, thu hộ CTV
  // bao nhiêu. order_id UNIQUE nên webhook lặp lại không sinh dòng trùng.
  await collectionService.recordCollection(
    order,
    { providerTxnRef: meta.providerTxnRef || null },
    { transaction }
  );

  // Hoá đơn.
  await Invoice.create({
    id: randomUUID(),
    order_id: order.id,
    transaction_id: meta.providerTxnRef || meta.eventId || String(order.payos_order_code),
    transfer_content: order.transfer_content || `TCD${order.id}`,
    payment_method: 'payos',
    paid_at: new Date(),
    created_at: new Date(),
    updated_at: new Date()
  }, { transaction });

  await auditService.log({
    actorType: 'system', action: 'payment.paid',
    entityType: 'order', entityId: order.id,
    newValue: { amount: roundVnd(order.amount), provider: 'payos', event_id: meta.eventId }
  }, { transaction });

  return { customerActivated };
};

// ---------------- Webhook payOS ----------------
const handlePayosWebhook = async (rawBody) => {
  let data;
  try {
    data = payosService.verifyWebhook(rawBody);
  } catch (error) {
    // Chữ ký sai -> ack 200 để payOS không spam retry, nhưng KHÔNG xử lý gì.
    console.warn('[payos webhook] chữ ký không hợp lệ:', error.message);
    notifyService.warn('Webhook payOS: chữ ký không hợp lệ', error.message || 'verify thất bại', 'payos:badsig');
    return { ack: true, processed: false, reason: 'invalid_signature' };
  }

  const orderCode = data?.orderCode;
  if (!orderCode) return { ack: true, processed: false, reason: 'missing_order_code' };

  const order = await Order.findOne({ where: { payos_order_code: orderCode } });
  if (!order) {
    // Gồm cả ping test của payOS (orderCode=123) -> ack.
    return { ack: true, processed: false, reason: 'order_not_found' };
  }

  const eventId = String(
    data.reference || `${orderCode}:${data.transactionDateTime || data.paymentLinkId || Date.now()}`
  ).slice(0, 120);
  const success = data.code === '00' || String(data.desc || '').toLowerCase() === 'success';
  const paidAmount = roundVnd(data.amount);
  const expectedAmount = roundVnd(order.ctv_selling_price != null ? order.ctv_selling_price : order.amount);

  const result = await sequelize.transaction(async (transaction) => {
    // Idempotency: event_id UNIQUE. Trùng -> created=false -> no-op.
    const [pt, created] = await PaymentTransaction.findOrCreate({
      where: { event_id: eventId },
      defaults: {
        id: randomUUID(),
        order_id: order.id,
        provider: 'payos',
        event_id: eventId,
        provider_txn_ref: data.reference || null,
        amount: paidAmount,
        status: 'pending',
        signature_valid: true,
        raw_payload: rawBody,
        created_at: new Date()
      },
      transaction
    });

    if (!created) return { processed: false, reason: 'duplicate_event' };

    if (!success) {
      pt.status = 'failed';
      pt.processed_at = new Date();
      await pt.save({ transaction });
      return { processed: false, reason: 'payment_not_success' };
    }

    if (paidAmount !== expectedAmount) {
      pt.status = 'failed';
      pt.processed_at = new Date();
      await pt.save({ transaction });
      await auditService.log({
        actorType: 'system', action: 'payment.amount_mismatch',
        entityType: 'order', entityId: order.id,
        newValue: { expected: expectedAmount, received: paidAmount }
      }, { transaction });
      return { processed: false, reason: 'amount_mismatch', expected: expectedAmount, received: paidAmount };
    }

    // Khoá dòng đơn, kiểm trạng thái trong transaction -> không PAID 2 lần.
    const locked = await Order.findByPk(order.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (locked.status === 'pending' || locked.status === 'expired') {
      const settle = await settlePaidOrder(locked, { eventId, providerTxnRef: data.reference }, { transaction });
      pt.status = 'succeeded';
      pt.processed_at = new Date();
      await pt.save({ transaction });
      return { processed: true, orderId: locked.id, customerActivated: settle.customerActivated };
    }

    // Đã paid/cancelled/refunded từ trước -> ghi nhận nhưng không cộng lại.
    pt.status = 'succeeded';
    pt.processed_at = new Date();
    await pt.save({ transaction });
    return { processed: false, reason: `order_already_${locked.status}` };
  });

  // Gửi thông báo NGOÀI transaction (chỉ khi đã commit thành công).
  if (result.reason === 'amount_mismatch') {
    notifyService.warn(
      'Webhook payOS: sai số tiền',
      `đơn #${notifyService.shortId(order.id)} — chờ ${notifyService.money(result.expected)}, nhận ${notifyService.money(result.received)}`,
      `payos:amount:${order.id}`
    );
  }
  if (result.processed) {
    try {
      const full = await Order.findByPk(result.orderId, {
        include: [
          {
            model: Customer, as: 'customer', attributes: ['id', 'name', 'created_at', 'activated_at'],
            include: [{ model: User, as: 'user', attributes: ['username'] }]
          },
          { model: CtvProfile, as: 'ctv', attributes: ['display_name'] }
        ]
      });
      if (full) {
        notifyService.orderPaid({
          order: full,
          ctvName: full.ctv ? full.ctv.display_name : null,
          customerName: full.customer ? full.customer.name : null
        });
        if (result.customerActivated && full.customer) {
          notifyService.customerActivated({
            customer: {
              name: full.customer.name,
              username: full.customer.user ? full.customer.user.username : null,
              created_at: full.customer.created_at
            },
            orderId: full.id
          });
        }
      }
    } catch (_e) { /* thông báo không được làm hỏng webhook */ }
  }

  return { ack: true, ...result };
};

// ---------------- Admin: hoàn tiền ----------------
const refundOrder = async (orderId, { reason, adminUserId, ip } = {}) => {
  let snapshot = null;
  const summary = await sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) { const e = new Error('Không tìm thấy đơn hàng'); e.status = 404; throw e; }
    if (order.status !== 'paid') {
      const e = new Error(`Chỉ hoàn tiền được đơn đã thanh toán (đơn đang ${order.status})`);
      e.status = 400; throw e;
    }

    snapshot = {
      id: order.id, amount: order.amount, card_quantity: order.card_quantity || order.slot_quantity || 1,
      ctv_earning_amount: order.ctv_earning_amount
    };
    const before = order.status;
    order.status = 'refunded';
    order.updated_at = new Date();
    await order.save({ transaction });

    const qty = order.card_quantity || order.slot_quantity || 1;
    if (order.customer_id) {
      await entitlementService.reverseForRefund(
        order.customer_id,
        { orderId: order.id, quantity: qty, note: reason || 'Hoàn tiền' },
        { transaction }
      );
    }
    if (order.ctv_id && order.ctv_earning_amount != null) {
      await walletService.debitRefund(
        order.ctv_id,
        { orderId: order.id, amount: order.ctv_earning_amount, note: reason || 'Hoàn tiền đơn' },
        { transaction }
      );
    }

    await auditService.log({
      actorType: 'admin', actorId: adminUserId || null,
      action: 'refund', entityType: 'order', entityId: order.id,
      oldValue: { status: before }, newValue: { status: 'refunded', reason: reason || null },
      ip: ip || null
    }, { transaction });

    return orderSummary(order);
  });

  if (snapshot) notifyService.orderRefunded({ order: snapshot, reason });
  return summary;
};

module.exports = {
  createCtvOrder,
  listOrdersForCtv,
  getOrderForCtv,
  cancelCtvOrder,
  getPaymentInfoForCtv,
  getPublicOrder,
  refreshPublicPayment,
  settlePaidOrder,
  handlePayosWebhook,
  refundOrder,
  orderSummary
};
