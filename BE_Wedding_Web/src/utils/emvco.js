// Parser tối giản cho chuỗi QR chuẩn EMVCo (VietQR / Napas dùng chuẩn này).
// Chuỗi gồm các trường dạng TLV: 2 ký tự ID + 2 ký tự độ dài + nội dung.
// Ví dụ: "0002010102110..." -> ID=00, len=02, value="01" ...

const parseTLV = (input) => {
	const out = {};
	let i = 0;
	const s = String(input || '');
	while (i + 4 <= s.length) {
		const id = s.slice(i, i + 2);
		const len = Number.parseInt(s.slice(i + 2, i + 4), 10);
		if (!/^\d{2}$/.test(id) || Number.isNaN(len) || len < 0) break;
		const value = s.slice(i + 4, i + 4 + len);
		if (value.length < len) break;
		out[id] = value;
		i += 4 + len;
	}
	return out;
};

// Bóc thông tin tài khoản nhận tiền từ QR VietQR.
// Trả về { valid, bankBin, accountNumber, accountName, serviceCode, amount, currency, content }.
const parseVietQr = (raw) => {
	const root = parseTLV(raw);

	// Tag 38 = Merchant Account Information (Napas). Bên trong lại là TLV.
	const merchant = parseTLV(root['38'] || '');
	const guid = merchant['00'] || '';
	// Tag 01 trong merchant = thông tin đơn vị thụ hưởng: 00 = mã BIN ngân hàng, 01 = số tài khoản
	const beneficiary = parseTLV(merchant['01'] || '');

	const bankBin = beneficiary['00'] || '';
	const accountNumber = beneficiary['01'] || '';
	const serviceCode = merchant['02'] || ''; // QRIBFTTA (chuyển khoản) | QRIBFTTC (thẻ)

	const amount = root['54'] || '';
	const currency = root['53'] || '';
	// Tag 59 = tên người/đơn vị thụ hưởng (có thể có hoặc không)
	const accountName = (root['59'] || '').trim();

	// Tag 62.08 = nội dung chuyển khoản gợi ý
	const additional = parseTLV(root['62'] || '');
	const content = (additional['08'] || '').trim();

	const isNapas = /^A000000727/i.test(guid);
	const valid = Boolean(isNapas && bankBin && accountNumber);

	return {
		valid,
		isNapas,
		bankBin,
		accountNumber,
		accountName,
		serviceCode,
		amount: amount ? Number(amount) : null,
		currency: currency === '704' ? 'VND' : currency,
		content,
		raw: String(raw || '')
	};
};

module.exports = { parseTLV, parseVietQr };
