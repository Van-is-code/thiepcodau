const express = require('express');
const { authenticate } = require('../middlewares/auth');
const { imageUpload, verifyUpload } = require('../middlewares/uploadGuard');
const { uploadLimiter } = require('../middlewares/security');
const invitationImageController = require('../controllers/invitationImageController');

const router = express.Router();
const upload = imageUpload();

router.use(authenticate);

router.get('/', invitationImageController.getAll);

// Xin URL ký sẵn để tải ảnh THẲNG lên Cloudflare R2 (không qua backend).
// Khai báo trước '/:id' để "presign" không bị nuốt thành tham số id.
router.post('/presign', uploadLimiter, invitationImageController.presignUpload);

// Báo cho server biết đã PUT xong, để nó xử lý ảnh và ghi nhận. Cũng khai trước '/:id'.
router.post('/attach', uploadLimiter, invitationImageController.attachUploaded);

router.get('/:id', invitationImageController.getById);

// verifyUpload chạy sau multer: chặn tệp giả danh ảnh (html/svg/php đổi đuôi).
router.post('/', uploadLimiter, upload.single('image'), verifyUpload('image'), invitationImageController.create);
router.put('/:id', uploadLimiter, upload.single('image'), verifyUpload('image', { required: false }), invitationImageController.update);
router.patch('/:id', uploadLimiter, upload.single('image'), verifyUpload('image', { required: false }), invitationImageController.update);
router.delete('/:id', invitationImageController.remove);

module.exports = router;
