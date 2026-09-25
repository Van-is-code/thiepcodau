const express = require('express');
const { authenticate } = require('../middlewares/auth');
const { publicWriteLimiter } = require('../middlewares/security');
const messageCheckinController = require('../controllers/messageCheckinController');

const router = express.Router();

// Công khai: khách mời gửi xác nhận tham dự / lời chúc (không cần đăng nhập).
// publicWriteLimiter: chặn spam flood — endpoint này ai cũng gọi được.
router.post('/', publicWriteLimiter, messageCheckinController.create);

// Từ đây trở xuống: cần đăng nhập + chỉ chủ thiệp (hoặc admin) mới xem/sửa được.
router.use(authenticate);
router.get('/', messageCheckinController.getAll);
router.get('/invitation/:invitation_id', messageCheckinController.getAllByInvitationId);
router.get('/:id', messageCheckinController.getById);
router.put('/:id', messageCheckinController.update);
router.patch('/:id', messageCheckinController.update);
router.delete('/:id', messageCheckinController.remove);

module.exports = router;
