const { Product, CtvProfile } = require('../models');
const { roundVnd, computeCommission, assertAboveFloor } = require('../utils/money');

const PRODUCT_CODES = ['single', 'combo'];

const getProductByCode = async (code, options = {}) => {
  if (!PRODUCT_CODES.includes(code)) {
    const e = new Error('Sản phẩm không hợp lệ. Chỉ nhận "single" hoặc "combo".');
    e.status = 400;
    throw e;
  }
  const product = await Product.findOne({ where: { code }, ...options });
  if (!product) {
    const e = new Error(`Không tìm thấy sản phẩm "${code}"`);
    e.status = 404;
    throw e;
  }
  return product;
};

const getFloors = async (options = {}) => {
  const products = await Product.findAll({ ...options });
  const map = {};
  for (const p of products) map[p.code] = roundVnd(p.base_price);
  return map;
};

// Kiểm tra bộ giá của 1 CTV so với giá sàn admin. Ném lỗi nếu vi phạm.
// Dùng ở cả lúc admin tạo/sửa CTV (backend là nguồn chân lý).
const validateCtvPrices = async ({ singlePrice, comboPrice }, options = {}) => {
  const floors = await getFloors(options);
  const single = assertAboveFloor(singlePrice, floors.single, 'Giá thiệp lẻ');
  const combo = assertAboveFloor(comboPrice, floors.combo, 'Giá combo');
  return { singlePrice: single, comboPrice: combo, floors };
};

// Snapshot giá + hoa hồng cho 1 đơn CTV tại thời điểm tạo đơn.
// KHÔNG dùng lại về sau — đơn giữ nguyên giá trị này kể cả khi admin đổi giá/%.
const quoteForOrder = async ({ ctvProfile, productCode }, options = {}) => {
  const product = await getProductByCode(productCode, options);
  if (!product.active) {
    const e = new Error(`Sản phẩm "${productCode}" đang tạm ngưng`);
    e.status = 400;
    throw e;
  }

  const adminBasePrice = roundVnd(product.base_price);
  const sellingPrice = roundVnd(productCode === 'combo' ? ctvProfile.combo_price : ctvProfile.single_price);

  // Chốt chặn cuối: giá CTV không bao giờ được thấp hơn sàn, kể cả nếu DB bị sửa tay.
  assertAboveFloor(sellingPrice, adminBasePrice, productCode === 'combo' ? 'Giá combo' : 'Giá thiệp lẻ');

  const { commissionRate, commissionAmount, ctvEarningAmount } = computeCommission(
    sellingPrice,
    ctvProfile.commission_rate
  );

  return {
    product,
    productId: product.id,
    productCode,
    cardQuantity: product.card_quantity,
    adminBasePrice,
    sellingPrice,
    commissionRate,
    commissionAmount,
    ctvEarningAmount
  };
};

module.exports = {
  PRODUCT_CODES,
  getProductByCode,
  getFloors,
  validateCtvPrices,
  quoteForOrder
};
