// THU HỘ — sổ ghi nhận nền tảng thu tiền HỘ cộng tác viên.
//
// Mô hình tiền: khách trả toàn bộ tiền vào tài khoản payOS của NỀN TẢNG (thu hộ).
// Trong số đó:
//   platform_amount = hoa hồng nền tảng giữ lại
//   ctv_amount      = phần thu hộ cho CTV, sẽ được CHI HỘ lại qua phiếu rút
//
// Bất biến cần giữ:
//   gross_amount === platform_amount + ctv_amount
//   SUM(ctv_amount của các dòng pending_settlement) === số tiền còn nợ CTV
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { CollectionRecord, CtvProfile, Order, sequelize } = require('../models');
const { roundVnd } = require('../utils/money');

// Ghi nhận thu hộ cho 1 đơn vừa PAID. Chạy TRONG transaction của webhook.
//
// order_id là UNIQUE ở DB nên findOrCreate biến hàm này thành idempotent: webhook
// payOS gửi lại cùng 1 đơn bao nhiêu lần cũng chỉ sinh đúng 1 dòng thu hộ.
const recordCollection = async (order, { providerTxnRef = null } = {}, options = {}) => {
  const transaction = options.transaction;

  const gross = roundVnd(order.ctv_selling_price != null ? order.ctv_selling_price : order.amount);
  const ctvAmount = roundVnd(order.ctv_earning_amount != null ? order.ctv_earning_amount : 0);
  // Suy ra phần nền tảng từ tổng trừ phần CTV -> luôn khớp bất biến kể cả khi dữ
  // liệu cũ thiếu commission_amount.
  const platformAmount = roundVnd(gross - ctvAmount);

  const [row] = await CollectionRecord.findOrCreate({
    where: { order_id: order.id },
    defaults: {
      id: randomUUID(),
      order_id: order.id,
      ctv_id: order.ctv_id || null,
      customer_id: order.customer_id || null,
      provider: order.payment_provider || 'payos',
      provider_txn_ref: providerTxnRef,
      gross_amount: gross,
      platform_amount: platformAmount,
      ctv_amount: ctvAmount,
      // Không có CTV (đơn tự phục vụ) thì không nợ ai -> coi như đã tất toán.
      settlement_status: order.ctv_id ? 'pending_settlement' : 'settled',
      settled_at: order.ctv_id ? null : new Date(),
      collected_at: new Date(),
      created_at: new Date(),
    },
    transaction,
  });

  return row;
};

// Đánh dấu các khoản thu hộ của 1 CTV là ĐÃ tất toán sau khi chi hộ thành công.
// Chốt theo mốc thời gian để không quét nhầm khoản phát sinh sau lúc tạo phiếu rút.
const markSettled = async (ctvId, { payoutRequestId, until = new Date() }, options = {}) => {
  const transaction = options.transaction;
  const [affected] = await CollectionRecord.update(
    { settlement_status: 'settled', settled_payout_id: payoutRequestId, settled_at: new Date() },
    {
      where: {
        ctv_id: ctvId,
        settlement_status: 'pending_settlement',
        collected_at: { [Op.lte]: until },
      },
      transaction,
    }
  );
  return affected;
};

// Đảo trạng thái khi lệnh chi hộ THẤT BẠI: tiền chưa rời khỏi nền tảng nên các khoản
// đó phải quay lại diện còn nợ CTV, nếu không sẽ biến mất khỏi mọi báo cáo đối soát.
const unmarkSettled = async (payoutRequestId, options = {}) => {
  const transaction = options.transaction;
  const [affected] = await CollectionRecord.update(
    { settlement_status: 'pending_settlement', settled_payout_id: null, settled_at: null },
    { where: { settled_payout_id: payoutRequestId }, transaction }
  );
  return affected;
};

// Tổng hợp thu hộ theo 1 CTV (hoặc toàn hệ khi ctvId = null).
const summary = async (ctvId = null, { from, to } = {}) => {
  const where = {};
  if (ctvId) where.ctv_id = ctvId;
  if (from || to) {
    where.collected_at = {};
    if (from) where.collected_at[Op.gte] = new Date(from);
    if (to) where.collected_at[Op.lte] = new Date(to);
  }

  const rows = await CollectionRecord.findAll({
    where,
    attributes: [
      'settlement_status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'cnt'],
      [sequelize.fn('SUM', sequelize.col('gross_amount')), 'gross'],
      [sequelize.fn('SUM', sequelize.col('platform_amount')), 'platform'],
      [sequelize.fn('SUM', sequelize.col('ctv_amount')), 'ctv'],
    ],
    group: ['settlement_status'],
  });

  const out = {
    total_orders: 0,
    gross_collected: 0,
    platform_revenue: 0,
    ctv_collected_on_behalf: 0,
    pending_settlement: 0,
    settled: 0,
  };
  for (const r of rows) {
    const cnt = Number(r.get('cnt')) || 0;
    const ctvSum = roundVnd(r.get('ctv') || 0);
    out.total_orders += cnt;
    out.gross_collected = roundVnd(out.gross_collected + roundVnd(r.get('gross') || 0));
    out.platform_revenue = roundVnd(out.platform_revenue + roundVnd(r.get('platform') || 0));
    out.ctv_collected_on_behalf = roundVnd(out.ctv_collected_on_behalf + ctvSum);
    if (r.settlement_status === 'pending_settlement') {
      out.pending_settlement = roundVnd(out.pending_settlement + ctvSum);
    } else {
      out.settled = roundVnd(out.settled + ctvSum);
    }
  }
  // Bất biến: tổng thu = phần nền tảng + phần thu hộ CTV.
  out.balanced = out.gross_collected === roundVnd(out.platform_revenue + out.ctv_collected_on_behalf);
  return out;
};

const listForCtv = async (ctvId, { status, page = 1, limit = 30 } = {}) => {
  const where = { ctv_id: ctvId };
  if (status) where.settlement_status = status;
  const offset = (page - 1) * limit;
  const { count, rows } = await CollectionRecord.findAndCountAll({
    where, order: [['collected_at', 'DESC']], limit, offset,
    include: [{ model: Order, as: 'order', attributes: ['id', 'product_code', 'card_quantity', 'paid_at'] }],
  });
  return {
    items: rows.map((r) => ({
      id: r.id,
      order_id: r.order_id,
      product_code: r.order ? r.order.product_code : null,
      gross_amount: roundVnd(r.gross_amount),
      platform_amount: roundVnd(r.platform_amount),
      ctv_amount: roundVnd(r.ctv_amount),
      settlement_status: r.settlement_status,
      collected_at: r.collected_at,
      settled_at: r.settled_at,
    })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

// Đối soát toàn hệ: tổng thu hộ theo từng CTV, kèm số còn phải chi hộ.
const reconcileByCtv = async () => {
  const rows = await CollectionRecord.findAll({
    attributes: [
      'ctv_id',
      [sequelize.fn('SUM', sequelize.col('gross_amount')), 'gross'],
      [sequelize.fn('SUM', sequelize.col('platform_amount')), 'platform'],
      [sequelize.fn('SUM', sequelize.col('ctv_amount')), 'ctv'],
    ],
    where: { ctv_id: { [Op.ne]: null } },
    group: ['ctv_id'],
  });

  const pending = await CollectionRecord.findAll({
    attributes: ['ctv_id', [sequelize.fn('SUM', sequelize.col('ctv_amount')), 'p']],
    where: { ctv_id: { [Op.ne]: null }, settlement_status: 'pending_settlement' },
    group: ['ctv_id'],
  });
  const pendingMap = Object.fromEntries(pending.map((p) => [String(p.ctv_id), roundVnd(p.get('p') || 0)]));

  const profiles = await CtvProfile.findAll({ attributes: ['id', 'display_name'] });
  const nameMap = Object.fromEntries(profiles.map((p) => [String(p.id), p.display_name]));

  return rows.map((r) => ({
    ctv_id: r.ctv_id,
    ctv_name: nameMap[String(r.ctv_id)] || null,
    gross_collected: roundVnd(r.get('gross') || 0),
    platform_revenue: roundVnd(r.get('platform') || 0),
    ctv_collected_on_behalf: roundVnd(r.get('ctv') || 0),
    pending_disbursement: pendingMap[String(r.ctv_id)] || 0,
  }));
};

module.exports = {
  recordCollection,
  markSettled,
  unmarkSettled,
  summary,
  listForCtv,
  reconcileByCtv,
};
