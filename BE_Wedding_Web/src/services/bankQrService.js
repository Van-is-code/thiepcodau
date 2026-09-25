const jsQR = require('jsqr');
const { Jimp } = require('jimp');
const sharp = require('sharp');
const QRCode = require('qrcode');
const { parseVietQr } = require('../utils/emvco');
const { lookupBank } = require('../config/vietqrBanks');

// Trần số điểm ảnh được phép giải nén. Ảnh chụp mã QR bằng điện thoại thường dưới
// 12 megapixel; 40MP là đã rất rộng rãi.
const MAX_PIXELS = Number.parseInt(process.env.MAX_QR_IMAGE_PIXELS, 10) || 40_000_000;
const MAX_SIDE = 1000; // jsQR chạy chậm và kém chính xác trên ảnh quá lớn

// Đọc chuỗi QR từ buffer ảnh (png/jpg/webp...). Trả về null nếu không thấy mã QR.
const decodeQrFromImage = async (buffer) => {
	// BƯỚC 1 — đọc kích thước TRƯỚC khi giải nén toàn bộ.
	//
	// Chống "ảnh bom nén": một tệp PNG 436KB màu đặc có thể là 12000x12000 = 144 triệu
	// điểm ảnh, ngốn ~550MB RAM và 6 giây CPU chỉ để giải nén. Vài request đồng thời
	// là đủ làm nghẽn server. sharp đọc header rất rẻ, không giải nén ảnh.
	let meta;
	try {
		meta = await sharp(buffer, { limitInputPixels: false }).metadata();
	} catch (_e) {
		const err = new Error('Không đọc được file ảnh'); err.status = 422; throw err;
	}
	const pixels = (meta.width || 0) * (meta.height || 0);
	if (!pixels) {
		const err = new Error('Không đọc được kích thước ảnh'); err.status = 422; throw err;
	}
	if (pixels > MAX_PIXELS) {
		const err = new Error(
			`Ảnh quá lớn (${meta.width}x${meta.height}). Vui lòng chụp/crop lại phần mã QR rồi tải lên.`
		);
		err.status = 413;
		throw err;
	}

	// BƯỚC 2 — thu nhỏ bằng sharp (nhanh hơn Jimp nhiều), rồi mới đưa vào jsQR.
	// Nhờ vậy Jimp không bao giờ phải dựng bitmap lớn hơn MAX_SIDE.
	const resized = await sharp(buffer, { limitInputPixels: MAX_PIXELS })
		.rotate()
		.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
		.png()
		.toBuffer();

	const image = await Jimp.read(resized);
	const { data, width, height } = image.bitmap;
	const result = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height);
	return result ? result.data : null;
};

// Nhận buffer ảnh QR ngân hàng -> bóc BIN / số tài khoản / tên / QR đã chuẩn hoá.
const scanBankQr = async (buffer) => {
	if (!buffer || !buffer.length) {
		const err = new Error('Không nhận được ảnh QR');
		err.status = 400;
		throw err;
	}

	let content;
	try {
		content = await decodeQrFromImage(buffer);
	} catch (error) {
		// Giữ nguyên lỗi đã có thông điệp rõ ràng (vd. ảnh quá lớn), chỉ bọc lại lỗi lạ.
		if (error && error.status) throw error;
		const err = new Error('Không xử lý được file ảnh (định dạng không hỗ trợ?)');
		err.status = 422;
		throw err;
	}

	if (!content) {
		const err = new Error('Không tìm thấy mã QR trong ảnh. Hãy chụp/crop rõ phần mã QR hơn.');
		err.status = 422;
		throw err;
	}

	const parsed = parseVietQr(content);

	if (!parsed.valid) {
		const err = new Error('Mã QR không phải QR chuyển khoản ngân hàng (VietQR/Napas).');
		err.status = 422;
		err.details = { content };
		throw err;
	}

	const bank = lookupBank(parsed.bankBin);

	// Tạo lại QR "sạch" từ đúng chuỗi đã kiểm chứng — hệ thống tự sinh, không dùng
	// ảnh gốc người dùng tải lên.
	const qrImage = await QRCode.toDataURL(content, {
		errorCorrectionLevel: 'M',
		margin: 2,
		width: 480,
		color: { dark: '#1f1a17', light: '#ffffff' }
	});

	return {
		bankBin: parsed.bankBin,
		bankName: bank.name,
		bankShortName: bank.shortName,
		accountNumber: parsed.accountNumber,
		accountName: parsed.accountName || null,
		serviceCode: parsed.serviceCode || null,
		amount: parsed.amount,
		content: parsed.content || null,
		qrContent: content,
		qrImage
	};
};

module.exports = { scanBankQr, decodeQrFromImage };
