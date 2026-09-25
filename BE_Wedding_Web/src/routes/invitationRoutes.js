const express = require('express');
const { authenticate } = require('../middlewares/auth');
const invitationController = require('../controllers/invitationController');

const router = express.Router();

// Route công khai: trang thiệp mà khách mời xem không cần đăng nhập.
// Phải khai báo TRƯỚC router.use(authenticate) bên dưới.
router.get('/slug/:invitation_slug', invitationController.getBySlug);

router.use(authenticate);

router.get('/', invitationController.getAll);
router.post('/draft', invitationController.createDraft);
router.get('/:id', invitationController.getById);
router.post('/', invitationController.create);
// Trình sửa: lưu 1 lượt (gộp invitation + groom + bride). Tính vào hạn mức "5 lượt".
router.post('/:id/editor-save', invitationController.editorSave);
// Đổi mẫu: không tính vào hạn mức.
router.patch('/:id/template', invitationController.changeTemplate);
// Nhạc nền (1 hoặc nhiều link / kho nhạc): không tính vào hạn mức.
router.patch('/:id/music', invitationController.setMusic);
router.patch('/:id/bank', invitationController.setBank);
router.put('/:id', invitationController.update);
router.patch('/:id', invitationController.update);
router.delete('/:id', invitationController.remove);

module.exports = router;
