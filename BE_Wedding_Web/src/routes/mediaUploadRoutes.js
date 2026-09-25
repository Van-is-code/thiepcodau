const express = require('express');
const { authenticate, adminOnly } = require('../middlewares/auth');
const { imageUpload, audioUpload, verifyUpload } = require('../middlewares/uploadGuard');
const { uploadLimiter } = require('../middlewares/security');
const mediaUploadController = require('../controllers/mediaUploadController');

const router = express.Router();
const image = imageUpload();
const audio = audioUpload();

// TRƯỚC ĐÂY TOÀN BỘ ROUTER NÀY KHÔNG CÓ AUTH.
// Bất kỳ ai trên internet cũng có thể: liệt kê toàn bộ media trong tài khoản
// Cloudinary, tải tệp tuỳ ý lên (đốt quota + lưu trữ nội dung vi phạm dưới tên
// chủ tài khoản), đổi tên và XOÁ ảnh cưới của mọi khách hàng.
//
// Nay: bắt buộc đăng nhập cho mọi thao tác; các thao tác động tới media dùng chung
// (liệt kê / sửa / xoá theo publicId) chỉ dành cho admin, vì Cloudinary không có
// khái niệm chủ sở hữu nên không thể kiểm quyền ở mức từng tệp.
router.use(authenticate);

router.get('/', adminOnly, mediaUploadController.listMedia);
router.get('/one', adminOnly, mediaUploadController.getMediaByPublicId);
router.put('/one', adminOnly, uploadLimiter, image.single('file'), verifyUpload('image', { required: false }), mediaUploadController.updateMedia);
router.patch('/one', adminOnly, uploadLimiter, image.single('file'), verifyUpload('image', { required: false }), mediaUploadController.updateMedia);
router.delete('/one', adminOnly, mediaUploadController.deleteMedia);

// Tải lên: người dùng đã đăng nhập được phép, nhưng có giới hạn tần suất và
// bắt buộc nội dung đúng định dạng.
router.post('/', uploadLimiter, image.single('file'), verifyUpload('image'), mediaUploadController.createMedia);
router.post('/image', uploadLimiter, image.single('image'), verifyUpload('image'), mediaUploadController.uploadImage);
router.post('/music', uploadLimiter, audio.single('music'), verifyUpload('audio'), mediaUploadController.uploadMusic);
router.post('/music/local', uploadLimiter, audio.single('music'), verifyUpload('audio'), mediaUploadController.uploadMusicLocal);

module.exports = router;
