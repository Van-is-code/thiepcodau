const express = require('express');
const { authenticate } = require('../middlewares/auth');
const { publicWriteLimiter, uploadLimiter } = require('../middlewares/security');
const mailController = require('../controllers/mailController');

const router = express.Router();

// Xem trước mẫu email mời cưới (render placeholder, không gửi). Công khai nhưng
// vẫn giới hạn tần suất để không bị dùng làm công cụ dò/ép tải.
router.get('/invitation/preview', publicWriteLimiter, mailController.previewInvitationEmail);

// Gửi email mời cưới cho 1 khách — cần đăng nhập.
router.use(authenticate);
// Mỗi email gửi đi mang danh hộp thư của nền tảng -> siết tần suất để một tài khoản
// không biến hệ thống thành máy gửi thư hàng loạt.
router.post('/invitation', uploadLimiter, mailController.sendInvitationEmail);

module.exports = router;
