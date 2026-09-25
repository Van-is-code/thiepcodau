const express = require('express');
const { authenticate, adminOnly } = require('../middlewares/auth');
const { audioUpload, verifyUpload } = require('../middlewares/uploadGuard');
const { uploadLimiter } = require('../middlewares/security');
const ctrl = require('../controllers/musicLibraryController');

const router = express.Router();
const upload = audioUpload();

// Khách đã đăng nhập: xem kho nhạc để chọn.
// Danh sách đã lọc sẵn theo quyền — bài đã TẮT và bài RIÊNG của khách khác không
// lọt ra ngoài.
router.get('/', authenticate, ctrl.list);

// ---- Quản trị ----
router.use(authenticate, adminOnly);

// Thấy hết, kể cả bài đã tắt.
router.get('/admin', ctrl.listAdmin);
// Thêm: multipart field "file" để tải tệp, hoặc JSON { url } để thêm link.
router.post('/', uploadLimiter, upload.single('file'), verifyUpload('audio', { required: false }), ctrl.add);
// Đổi tên / bật tắt / chuyển chung ↔ riêng.
router.patch('/:id', ctrl.update);
// Đếm số thiệp đang dùng, để hỏi trước khi xoá.
router.get('/:id/usage', ctrl.usage);
// Xoá. Đang có thiệp dùng thì trả 409; thêm ?force=true để xoá hẳn.
router.delete('/:id', ctrl.remove);

module.exports = router;
