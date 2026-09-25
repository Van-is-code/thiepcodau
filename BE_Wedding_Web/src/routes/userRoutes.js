const express = require('express');
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/security');
const userController = require('../controllers/userController');

const router = express.Router();

// authLimiter: chặn dò mật khẩu. Đếm theo IP + username nên 1 IP không khoá được
// tài khoản của người khác, và 1 kẻ tấn công đổi IP cũng không dò nhanh hơn.
router.post('/register', authLimiter, userController.register);
router.post('/login', authLimiter, userController.login);
router.get('/profile', authenticate, userController.getProfile);
router.patch('/profile', authenticate, userController.updateProfile);
router.post('/change-password', authLimiter, authenticate, userController.changePassword);

module.exports = router;
