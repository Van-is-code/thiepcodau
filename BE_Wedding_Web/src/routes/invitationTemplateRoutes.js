const express = require('express');
const { authenticate, optionalAuth, adminOnly } = require('../middlewares/auth');
const { zipUpload, verifyUpload } = require('../middlewares/uploadGuard');
const invitationTemplateController = require('../controllers/invitationTemplateController');

const router = express.Router();

// Gói mẫu (html+css+js+ảnh) có thể vài chục MB. verifyUpload('zip') đảm bảo đúng là
// tệp nén thật, không phải thứ gì khác đổi đuôi .zip.
const upload = zipUpload();

// Đọc danh sách/mẫu: công khai không cần đăng nhập (khách vãng lai xem preview mẫu,
// nếu đã đăng nhập thì tự động mở rộng theo quyền của tài khoản).
router.get('/', optionalAuth, invitationTemplateController.getAll);
router.get('/:id', optionalAuth, invitationTemplateController.getById);

// Quản trị mẫu: chỉ admin mới được thêm/sửa/xoá mẫu
router.post('/upload', authenticate, adminOnly, upload.single('package'), verifyUpload('zip'), invitationTemplateController.uploadPackage);
router.post('/', authenticate, adminOnly, invitationTemplateController.create);
router.put('/:id', authenticate, adminOnly, invitationTemplateController.update);
router.patch('/:id', authenticate, adminOnly, invitationTemplateController.update);
router.delete('/:id', authenticate, adminOnly, invitationTemplateController.remove);

module.exports = router;
