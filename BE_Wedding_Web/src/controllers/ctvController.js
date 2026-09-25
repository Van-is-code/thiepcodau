const ctvService = require('../services/ctvService');
const customerService = require('../services/customerService');
const orderService = require('../services/orderService');
const walletService = require('../services/walletService');
const payoutService = require('../services/payoutService');
const collectionService = require('../services/collectionService');
const { actorFromReq } = require('../services/auditService');

const ctxOf = (req) => {
  const a = actorFromReq(req);
  return { actorId: a.actorId, ip: a.ip };
};

const ok = (res, data, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });
const fail = (res, error) =>
  res.status(error.status || 500).json({ success: false, message: error.message || 'Lỗi máy chủ' });

// Nạp hồ sơ CTV vào req.ctv (dùng chung cho mọi route CTV).
const loadCtv = async (req, res, next) => {
  try {
    req.ctv = await ctvService.resolveCtv(req.user.id);
    next();
  } catch (error) {
    fail(res, error);
  }
};

// ---- Hồ sơ & dashboard ----
const getMe = async (req, res) => {
  try { ok(res, await ctvService.getMe(req.user.id), 'Hồ sơ CTV'); }
  catch (e) { fail(res, e); }
};

const getDashboard = async (req, res) => {
  try { ok(res, await ctvService.getDashboard(req.ctv), 'Dashboard CTV'); }
  catch (e) { fail(res, e); }
};

const updatePayoutSettings = async (req, res) => {
  try { ok(res, await ctvService.updatePayoutSettings(req.ctv, req.body || {}, ctxOf(req)), 'Đã cập nhật cấu hình rút tiền'); }
  catch (e) { fail(res, e); }
};

// ---- Khách hàng ----
const listCustomers = async (req, res) => {
  try {
    const { search, status } = req.query;
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 30;
    ok(res, await customerService.listCustomers(req.ctv, { search, status, page, limit }), 'Danh sách khách');
  } catch (e) { fail(res, e); }
};

const createCustomer = async (req, res) => {
  try {
    const data = await customerService.createCustomer(req.ctv, req.body || {}, ctxOf(req));
    ok(res, data, 'Đã tạo tài khoản khách', 201);
  } catch (e) { fail(res, e); }
};

const getCustomer = async (req, res) => {
  try { ok(res, await customerService.getCustomerDetail(req.params.id, req.ctv), 'Chi tiết khách'); }
  catch (e) { fail(res, e); }
};

const updateCustomer = async (req, res) => {
  try { ok(res, await customerService.updateCustomer(req.params.id, req.ctv, req.body || {}, ctxOf(req)), 'Đã cập nhật khách'); }
  catch (e) { fail(res, e); }
};

const getCustomerOrders = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    ok(res, await orderService.listOrdersForCtv(req.ctv.id, { customerId: req.params.id, page, limit }), 'Đơn của khách');
  } catch (e) { fail(res, e); }
};

const getCustomerCards = async (req, res) => {
  try { ok(res, await customerService.getCustomerCards(req.params.id, req.ctv), 'Thiệp của khách'); }
  catch (e) { fail(res, e); }
};

const createCustomerInvitation = async (req, res) => {
  try {
    const templateId = req.body.template_id || req.body.templateId;
    const data = await customerService.createInvitationForCustomer(req.params.id, req.ctv, templateId, ctxOf(req));
    ok(res, data, 'Đã tạo thiệp cho khách', 201);
  } catch (e) { fail(res, e); }
};

const deleteCustomer = async (req, res) => {
  try {
    ok(res, await customerService.deleteCustomer(req.params.id, req.ctv, ctxOf(req)), 'Đã xoá khách hàng');
  } catch (e) { fail(res, e); }
};

const listInvitations = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 30, customerId } = req.query;
    ok(res, await customerService.listInvitationsForCtv(req.ctv, { search, page, limit, customerId }), 'Danh sách thiệp');
  } catch (e) { fail(res, e); }
};

const lockInvitation = async (req, res) => {
  try {
    ok(res, await customerService.lockInvitationForCtv(req.params.id, req.ctv), 'Đã khoá sửa thiệp');
  } catch (e) { fail(res, e); }
};

const unlockInvitation = async (req, res) => {
  try {
    ok(res, await customerService.unlockInvitationForCtv(req.params.id, req.ctv, req.body || {}), 'Đã mở khoá sửa thiệp');
  } catch (e) { fail(res, e); }
};

// ---- Đơn hàng ----
const createOrder = async (req, res) => {
  try {
    const { customerId, productCode } = req.body || {};
    if (!customerId || !productCode) {
      return res.status(400).json({ success: false, message: 'Thiếu customerId hoặc productCode' });
    }
    const ctx = ctxOf(req);
    const data = await orderService.createCtvOrder({ ctvId: req.ctv.id, customerId, productCode }, ctx);
    ok(res, data, 'Đã tạo đơn & mã thanh toán', 201);
  } catch (e) { fail(res, e); }
};

const listOrders = async (req, res) => {
  try {
    const { status, customerId } = req.query;
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    ok(res, await orderService.listOrdersForCtv(req.ctv.id, { status, customerId, page, limit }), 'Danh sách đơn');
  } catch (e) { fail(res, e); }
};

const getOrder = async (req, res) => {
  try { ok(res, await orderService.getOrderForCtv(req.params.id, req.ctv.id), 'Chi tiết đơn'); }
  catch (e) { fail(res, e); }
};

const getOrderPayment = async (req, res) => {
  try { ok(res, await orderService.getPaymentInfoForCtv(req.params.id, req.ctv.id), 'Thông tin thanh toán'); }
  catch (e) { fail(res, e); }
};

const cancelOrder = async (req, res) => {
  try { ok(res, await orderService.cancelCtvOrder(req.params.id, req.ctv.id, ctxOf(req)), 'Đã huỷ đơn'); }
  catch (e) { fail(res, e); }
};

// ---- Ví & rút tiền ----
// Sổ THU HỘ của chính CTV: từng đơn nền tảng đã thu hộ bao nhiêu, đã chi lại chưa.
// Minh bạch dòng tiền -> CTV tự đối chiếu được, giảm tranh chấp hoa hồng.
const getCollections = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 30, 100);
    const [summary, items] = await Promise.all([
      collectionService.summary(req.ctv.id),
      collectionService.listForCtv(req.ctv.id, { status: req.query.status, page, limit }),
    ]);
    ok(res, { summary, ...items }, 'Sổ thu hộ');
  } catch (e) { fail(res, e); }
};

const getWallet = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 30;
    const [summary, ledger] = await Promise.all([
      walletService.getSummary(req.ctv.id),
      walletService.listLedger(req.ctv.id, { page, limit })
    ]);
    ok(res, { summary, ledger }, 'Ví CTV');
  } catch (e) { fail(res, e); }
};

const listPayouts = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    ok(res, await payoutService.listForCtv(req.ctv.id, { status: req.query.status, page, limit }), 'Phiếu rút');
  } catch (e) { fail(res, e); }
};

const createPayout = async (req, res) => {
  try {
    const { amount, note } = req.body || {};
    const data = await payoutService.createRequest(req.ctv, { amount, note }, ctxOf(req));
    ok(res, data, 'Đã tạo phiếu rút, chờ admin duyệt', 201);
  } catch (e) { fail(res, e); }
};

const cancelPayout = async (req, res) => {
  try { ok(res, await payoutService.cancelByCtv(req.params.id, req.ctv, ctxOf(req)), 'Đã huỷ phiếu rút'); }
  catch (e) { fail(res, e); }
};

module.exports = {
  loadCtv,
  getMe,
  getDashboard,
  updatePayoutSettings,
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerOrders,
  getCustomerCards,
  createCustomerInvitation,
  listInvitations,
  lockInvitation,
  unlockInvitation,
  createOrder,
  listOrders,
  getOrder,
  getOrderPayment,
  cancelOrder,
  getWallet,
  getCollections,
  listPayouts,
  createPayout,
  cancelPayout
};
