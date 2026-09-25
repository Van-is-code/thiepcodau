const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middlewares/auth');
const { paymentRefreshLimiter } = require('../middlewares/security');

const router = express.Router();

// ---------- payOS (luồng CTV) ----------
// Webhook payOS — KHÔNG auth, verify chữ ký trong service. Nguồn xác nhận duy nhất.
router.post('/payos/webhook', paymentController.handlePayosWebhook);
// Webhook CHI HỘ payOS — KHÔNG auth, verify chữ ký HMAC trong service.
// Đây là nguồn xác nhận cuối cùng cho việc tiền đã về tài khoản CTV hay chưa.
router.post('/payos/payout-webhook', paymentController.handlePayosPayoutWebhook);

// Trang thanh toán công khai theo token đơn.
router.get('/public/:token', paymentController.getPublicOrder);
// Mỗi lần làm mới gọi payOS tạo link mới -> endpoint công khai này phải siết chặt,
// nếu không ai cầm được order_token đều spam tạo link vô hạn.
router.post('/public/:token/refresh', paymentRefreshLimiter, paymentController.refreshPublicPayment);

// ---------- SePay (luồng cũ, vẫn khoá bằng ENABLE_SLOT_PURCHASE) ----------
// POST - Yêu cầu thanh toán (tạo QR code)
router.post('/request-payment', authenticate, paymentController.requestPayment);

// POST - Webhook callback từ Sepay
router.post('/webhook', paymentController.handleWebhook);

// POST - Kiểm tra trạng thái thanh toán (frontend poll khi đang chờ chuyển khoản).
// Bắt buộc đăng nhập: trước đây không auth nên userId luôn rỗng -> bộ lọc "chỉ đơn
// của chính mình" trong service không bao giờ được áp, ai cũng dò được trạng thái
// đơn hàng bất kỳ chỉ bằng cách đoán id.
router.post('/check-payment-status', authenticate, paymentController.checkPaymentStatus);

// GET - Lấy chi tiết đơn hàng
router.get('/orders/:orderId', authenticate, paymentController.getOrderDetails);

// GET - Lấy danh sách đơn hàng của user
router.get('/orders', authenticate, paymentController.getUserOrders);

// DELETE - Hủy đơn hàng
router.delete('/orders/:orderId', authenticate, paymentController.cancelOrder);

module.exports = router;
