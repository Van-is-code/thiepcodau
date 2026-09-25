const paymentService = require('../services/paymentService');
const orderService = require('../services/orderService');
const payoutService = require('../services/payoutService');
const { actorFromReq } = require('../services/auditService');

const requestPayment = async (req, res) => {
  try {
    // Mua gói/slot qua SePay tạm TẮT — admin cấp slot khi khách liên hệ.
    // Bật lại: đặt ENABLE_SLOT_PURCHASE=true trong .env
    if (String(process.env.ENABLE_SLOT_PURCHASE || 'false').toLowerCase() !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Tính năng mua gói đang tạm đóng. Vui lòng liên hệ admin để được cấp thêm lượt tạo thiệp.'
      });
    }

    const { slotQuantity = 1, amount = null } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập'
      });
    }

    const data = await paymentService.requestPayment(userId, slotQuantity, amount);
    return res.status(201).json({
      success: true,
      message: 'Tạo đơn thanh toán thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Tạo đơn thanh toán thất bại'
    });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    const result = await paymentService.handleWebhook(webhookData);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Xử lý webhook thất bại'
    });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    const data = await paymentService.getOrderDetails(orderId, userId);
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin đơn hàng thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lấy thông tin đơn hàng thất bại'
    });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.id;
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 20;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập'
      });
    }

    const data = await paymentService.getUserOrders(userId, page, limit);
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn hàng thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Lấy danh sách đơn hàng thất bại'
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập'
      });
    }

    const data = await paymentService.cancelOrder(orderId, userId);
    return res.status(200).json({
      success: true,
      message: 'Hủy đơn hàng thành công',
      data
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Hủy đơn hàng thất bại'
    });
  }
};

/**
 * Kiểm tra trạng thái thanh toán của đơn hàng
 * Dùng cho AJAX endpoint từ frontend (checkout page)
 * Frontend sẽ định kỳ poll endpoint này để kiểm tra xem thanh toán có thành công chưa
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const orderId = req.body?.orderId || req.body?.order_id;
    const userId = req.user?.id; // Có thể optional tùy setup security

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu orderId'
      });
    }

    const data = await paymentService.checkPaymentStatus(orderId, userId);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Kiểm tra trạng thái thanh toán thất bại'
    });
  }
};

// ================= payOS (luồng CTV) =================

// Webhook payOS — nguồn xác nhận thanh toán DUY NHẤT. Không auth. Idempotent.
const handlePayosWebhook = async (req, res) => {
  try {
    const result = await orderService.handlePayosWebhook(req.body);
    // Luôn trả 200 để payOS không spam retry; chi tiết nằm trong body.
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[payos webhook] lỗi:', error);
    // Vẫn 200 — tránh payOS retry vô hạn khi lỗi nội bộ; đã log để soát tay.
    return res.status(200).json({ success: false, message: error.message });
  }
};

// Webhook CHI HỘ payOS — báo kết quả chuyển tiền về tài khoản CTV.
// Luôn trả 200 để payOS không retry vô hạn; chi tiết nằm trong body.
const handlePayosPayoutWebhook = async (req, res) => {
  try {
    const result = await payoutService.handlePayoutWebhook(req.body);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[payos payout webhook] lỗi:', error);
    return res.status(200).json({ success: false, message: error.message });
  }
};

// Trang thanh toán công khai /pay/:token — khách mở lại nhiều lần.
const getPublicOrder = async (req, res) => {
  try {
    const data = await orderService.getPublicOrder(req.params.token);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Không tải được đơn' });
  }
};

// Tạo lại link/QR khi HẾT HẠN — cho chính Order đó, không tạo Customer/Order mới.
const refreshPublicPayment = async (req, res) => {
  try {
    const a = actorFromReq(req);
    const data = await orderService.refreshPublicPayment(req.params.token, { ip: a.ip });
    return res.status(200).json({ success: true, message: 'Đã làm mới mã thanh toán', data });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Làm mới thất bại' });
  }
};

module.exports = {
  requestPayment,
  handleWebhook,
  getOrderDetails,
  getUserOrders,
  cancelOrder,
  checkPaymentStatus,
  handlePayosWebhook,
  handlePayosPayoutWebhook,
  getPublicOrder,
  refreshPublicPayment
};
