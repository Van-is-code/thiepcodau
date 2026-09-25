const express = require('express');
const { authenticate, adminOnly } = require('../middlewares/auth');
const { zipUpload, verifyUpload } = require('../middlewares/uploadGuard');
const invitationTemplateController = require('../controllers/invitationTemplateController');

const router = express.Router();

// Gói mẫu (html+css+js+ảnh) có thể vài chục MB. verifyUpload('zip') đảm bảo đúng là
// tệp nén thật, không phải thứ gì khác đổi đuôi .zip.
const upload = zipUpload();

router.use(authenticate);

// Đọc danh sách/mẫu: mọi user đã đăng nhập (khách hàng chọn mẫu trong "Kho Mẫu")
router.get('/', invitationTemplateController.getAll);
router.get('/:id', invitationTemplateController.getById);

// Quản trị mẫu: chỉ admin mới được thêm/sửa/xoá mẫu
router.post('/upload', adminOnly, upload.single('package'), verifyUpload('zip'), invitationTemplateController.uploadPackage);
router.post('/', adminOnly, invitationTemplateController.create);
router.put('/:id', adminOnly, invitationTemplateController.update);
router.patch('/:id', adminOnly, invitationTemplateController.update);
router.delete('/:id', adminOnly, invitationTemplateController.remove);

module.exports = router;
