// Tiện ích tính tiền cho hệ CTV. VND luôn là số nguyên -> làm tròn về đồng.
// Tách khỏi Sequelize để test được không cần DB.

// Ép về number an toàn (chấp nhận string "200000", "200000.00", number, Decimal).
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : NaN;
};

// Làm tròn nửa lên về đồng (VND không có phần lẻ).
const roundVnd = (value) => Math.round((toNumber(value) + Number.EPSILON));

// Tính hoa hồng nền tảng + phần CTV hưởng từ giá bán thực tế của CTV.
//   platform_amount = round(selling_price * commission_rate)
//   ctv_amount      = selling_price - platform_amount
const computeCommission = (sellingPrice, commissionRate) => {
  const price = roundVnd(sellingPrice);
  const rate = toNumber(commissionRate);
  if (!Number.isFinite(price) || price < 0) {
    const e = new Error('selling_price không hợp lệ');
    e.status = 400;
    throw e;
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    const e = new Error('commission_rate phải trong khoảng 0..1');
    e.status = 400;
    throw e;
  }
  const commissionAmount = roundVnd(price * rate);
  const ctvEarningAmount = price - commissionAmount;
  return { sellingPrice: price, commissionRate: rate, commissionAmount, ctvEarningAmount };
};

// Kiểm tra giá CTV không được thấp hơn giá sàn admin.
const assertAboveFloor = (ctvPrice, floorPrice, label = 'Giá') => {
  const p = roundVnd(ctvPrice);
  const floor = roundVnd(floorPrice);
  if (!Number.isFinite(p) || p <= 0) {
    const e = new Error(`${label} phải là số dương`);
    e.status = 400;
    throw e;
  }
  if (p < floor) {
    const e = new Error(`${label} (${p.toLocaleString('vi-VN')}đ) không được thấp hơn giá sàn (${floor.toLocaleString('vi-VN')}đ)`);
    e.status = 400;
    throw e;
  }
  return p;
};

module.exports = { toNumber, roundVnd, computeCommission, assertAboveFloor };
