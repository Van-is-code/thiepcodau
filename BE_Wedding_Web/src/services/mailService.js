const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Mẫu email mời cưới (giữ lại từ backend cũ ở /src, nay dùng chung cho mọi thiệp).
const TEMPLATE_PATH = path.join(__dirname, '..', 'emails', 'invitation-email.html');

const readTemplate = () => {
	try {
		return fs.readFileSync(TEMPLATE_PATH, 'utf-8');
	} catch (error) {
		const err = new Error('Không đọc được mẫu email mời cưới');
		err.status = 500;
		throw err;
	}
};

// Thay các placeholder {{KEY}} bằng giá trị tương ứng (rỗng nếu thiếu).
const renderTemplate = (values = {}) => {
	const html = readTemplate();
	return html.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (_match, key) => {
		const value = values[key];
		return value === undefined || value === null ? '' : String(value);
	});
};

const buildValues = ({ guestName, invitationUrl, groomName, brideName }) => ({
	GUEST_NAME: guestName || 'Quý khách',
	INVITATION_URL: invitationUrl || '',
	GROOM_NAME: groomName || 'Chú rể',
	BRIDE_NAME: brideName || 'Cô dâu'
});

let cachedTransporter = null;

const getTransporter = () => {
	if (cachedTransporter) return cachedTransporter;

	const user = process.env.GMAIL_USER || '';
	const pass = process.env.GMAIL_PASSWORD || '';

	if (!user || !pass) {
		const error = new Error('Thiếu cấu hình GMAIL_USER / GMAIL_PASSWORD để gửi email');
		error.status = 500;
		throw error;
	}

	cachedTransporter = nodemailer.createTransport({
		service: 'gmail',
		auth: { user, pass },
		tls: { rejectUnauthorized: false }
	});

	return cachedTransporter;
};

// Trả về HTML email đã render (dùng cho preview / lấy mẫu, không gửi).
const previewInvitationEmail = (params = {}) => renderTemplate(buildValues(params));

// Các origin được phép xuất hiện trong link thiệp gửi qua email.
// Lấy từ chính cấu hình của hệ thống, không tự bịa.
const allowedLinkOrigins = () => {
	const list = [process.env.FRONTEND_URL, process.env.PUBLIC_INVITATION_BASE_URL, process.env.API_PUBLIC_URL]
		.concat(String(process.env.CORS_ORIGINS || '').split(','))
		.map((u) => String(u || '').trim())
		.filter(Boolean);
	const origins = new Set();
	for (const u of list) {
		try { origins.add(new URL(u).origin); } catch (_e) { /* bỏ giá trị hỏng */ }
	}
	return origins;
};

// Link trong email PHẢI trỏ về chính hệ thống này.
//
// Vì sao: endpoint gửi email nhận cả địa chỉ người nhận lẫn link, và thư đi từ hộp
// Gmail của nền tảng. Không ràng buộc thì bất kỳ tài khoản nào cũng biến hệ thống
// thành công cụ phát tán lừa đảo: gửi "thiệp mời cưới" tới địa chỉ bất kỳ, kèm link
// dẫn tới trang giả mạo, mà thư lại mang danh và uy tín tên miền của nền tảng.
const assertSafeInvitationUrl = (invitationUrl) => {
	let url;
	try {
		url = new URL(String(invitationUrl));
	} catch (_e) {
		const error = new Error('invitationUrl không phải đường dẫn hợp lệ');
		error.status = 400;
		throw error;
	}
	if (!['http:', 'https:'].includes(url.protocol)) {
		const error = new Error('invitationUrl chỉ chấp nhận http hoặc https');
		error.status = 400;
		throw error;
	}
	const allowed = allowedLinkOrigins();
	// Chưa cấu hình origin nào (môi trường dev) -> không chặn, nhưng cảnh báo trong log.
	if (allowed.size === 0) {
		console.warn('[mail] Chưa đặt FRONTEND_URL — không kiểm được nguồn gốc link thiệp.');
		return url.href;
	}
	if (!allowed.has(url.origin)) {
		const error = new Error('Link thiệp phải thuộc hệ thống thiệp cưới, không nhận link ngoài.');
		error.status = 400;
		throw error;
	}
	return url.href;
};

// Gửi email mời cưới tới 1 khách.
const sendInvitationEmail = async ({ recipientEmail, guestName, invitationUrl, groomName, brideName }) => {
	if (!recipientEmail || !guestName || !invitationUrl) {
		const error = new Error('recipientEmail, guestName và invitationUrl là bắt buộc');
		error.status = 400;
		throw error;
	}

	const email = String(recipientEmail).trim();
	if (!/^[^\s@]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(email) || email.length > 254) {
		const error = new Error('Địa chỉ email người nhận không hợp lệ');
		error.status = 400;
		throw error;
	}

	invitationUrl = assertSafeInvitationUrl(invitationUrl);
	// Cắt độ dài để không nhồi nội dung lạ vào tiêu đề/thân thư.
	const oneLine = (v, max) => String(v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
	guestName = oneLine(guestName, 120);
	groomName = groomName ? oneLine(groomName, 120) : groomName;
	brideName = brideName ? oneLine(brideName, 120) : brideName;

	const html = renderTemplate(buildValues({ guestName, invitationUrl, groomName, brideName }));
	const transporter = getTransporter();
	const from = process.env.GMAIL_USER;

	await transporter.sendMail({
		from,
		to: email,
		replyTo: from,
		subject: `💍 Thiệp mời cưới - ${guestName}`,
		html
	});

	return { recipientEmail: email, guestName };
};

module.exports = {
	previewInvitationEmail,
	sendInvitationEmail
};
