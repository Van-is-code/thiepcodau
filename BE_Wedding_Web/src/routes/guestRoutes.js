const express = require('express');
const { authenticate } = require('../middlewares/auth');
const guestController = require('../controllers/guestController');

const router = express.Router();

// Route CÔNG KHAI duy nhất: trang thiệp cá nhân hoá đọc tên khách qua chuỗi đã mã
// hoá trong link riêng (?guest_name=...). Phải khai báo TRƯỚC router.use(authenticate).
//
// Trước đây route công khai là GET /:id và trả bản ghi đầy đủ chỉ với 1 UUID, nên
// bất kỳ ai cũng dò được toàn bộ danh sách khách mời của mọi đám cưới.
router.get('/public', guestController.getPublicByToken);

router.use(authenticate);

router.get('/', guestController.getAll);
router.get('/:id', guestController.getById);
router.post('/', guestController.create);
router.put('/:id', guestController.update);
router.patch('/:id', guestController.update);
router.delete('/:id', guestController.remove);

module.exports = router;
