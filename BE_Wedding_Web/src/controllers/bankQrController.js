const bankQrService = require('../services/bankQrService');

// POST /api/bank-qr/scan  (multipart, field "qr")
// Nhận ảnh QR ngân hàng -> trả về BIN / tên NH / số TK / tên chủ TK + QR đã chuẩn hoá.
const scan = async (req, res) => {
	try {
		const file = req.file;
		if (!file) {
			return res.status(400).json({ success: false, message: 'Vui lòng tải lên ảnh mã QR (field "qr")' });
		}

		const data = await bankQrService.scanBankQr(file.buffer);
		return res.status(200).json({
			success: true,
			message: 'Quét mã QR thành công',
			data
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Quét mã QR thất bại',
			details: error.details
		});
	}
};

module.exports = { scan };
