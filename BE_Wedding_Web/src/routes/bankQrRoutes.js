const express = require('express');
const { authenticate } = require('../middlewares/auth');
const { imageUpload, verifyUpload } = require('../middlewares/uploadGuard');
const { uploadLimiter } = require('../middlewares/security');
const bankQrController = require('../controllers/bankQrController');

const router = express.Router();
const upload = imageUpload();

router.use(authenticate);
// verifyUpload('image'): chỉ nhận ảnh thật (magic bytes), không nhận SVG/HTML đổi đuôi.
router.post('/scan', uploadLimiter, upload.single('qr'), verifyUpload('image'), bankQrController.scan);

module.exports = router;
