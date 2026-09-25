const mailService = require('../services/mailService');

// GET /api/mail/invitation/preview?guestName=...&invitationUrl=...&groomName=...&brideName=...
// Trả HTML email đã render để xem trước (không gửi).
const previewInvitationEmail = (req, res) => {
	try {
		const html = mailService.previewInvitationEmail({
			guestName: req.query.guestName || req.query.name,
			invitationUrl: req.query.invitationUrl || req.query.url,
			groomName: req.query.groomName,
			brideName: req.query.brideName
		});
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		return res.status(200).send(html);
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Không tạo được bản xem trước email'
		});
	}
};

// POST /api/mail/invitation
// Body: { recipientEmail, guestName, invitationUrl, groomName?, brideName? }
const sendInvitationEmail = async (req, res) => {
	try {
		const data = await mailService.sendInvitationEmail({
			recipientEmail: req.body.recipientEmail || req.body.recipient_email,
			guestName: req.body.guestName || req.body.guest_name,
			invitationUrl: req.body.invitationUrl || req.body.invitation_url,
			groomName: req.body.groomName || req.body.groom_name,
			brideName: req.body.brideName || req.body.bride_name
		});
		return res.status(200).json({
			success: true,
			message: `Đã gửi email tới ${data.recipientEmail}`,
			data
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Gửi email thất bại'
		});
	}
};

module.exports = { previewInvitationEmail, sendInvitationEmail };
