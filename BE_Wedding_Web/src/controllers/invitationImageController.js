const invitationImageService = require('../services/invitationImageService');
const storageService = require('../services/storageService');
const { assertUuid } = require('../middlewares/ownership');

// Mọi lời gọi đều kèm actor -> service tự giới hạn phạm vi theo chủ sở hữu thiệp.
const actorOf = (req) => (req.user ? { id: req.user.id, role: req.user.role } : null);

const fail = (res, error, fallback) => res.status(error.status || 500).json({
	success: false,
	message: error.message || fallback,
});

const getAll = async (req, res) => {
	try {
		const data = await invitationImageService.getAll(req.query, actorOf(req));
		return res.status(200).json({ success: true, message: 'Lấy danh sách ảnh thành công', data });
	} catch (error) {
		return fail(res, error, 'Lấy danh sách ảnh thất bại');
	}
};

const getById = async (req, res) => {
	try {
		const data = await invitationImageService.getById(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Lấy ảnh thành công', data });
	} catch (error) {
		return fail(res, error, 'Lấy ảnh thất bại');
	}
};

const create = async (req, res) => {
	try {
		const data = await invitationImageService.create(req.body, actorOf(req), req.file);
		return res.status(201).json({ success: true, message: 'Tải ảnh lên thành công', data });
	} catch (error) {
		return fail(res, error, 'Tải ảnh lên thất bại');
	}
};

const update = async (req, res) => {
	try {
		const data = await invitationImageService.update(req.params.id, req.body, actorOf(req), req.file);
		return res.status(200).json({ success: true, message: 'Cập nhật ảnh thành công', data });
	} catch (error) {
		return fail(res, error, 'Cập nhật ảnh thất bại');
	}
};

const remove = async (req, res) => {
	try {
		await invitationImageService.remove(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Xoá ảnh thành công' });
	} catch (error) {
		return fail(res, error, 'Xoá ảnh thất bại');
	}
};

// Tải ảnh THẲNG lên Cloudflare R2 bằng URL ký sẵn.
// Dùng cho album cưới nhiều ảnh nặng: tệp không đi qua backend nên không tốn RAM,
// băng thông và thời gian chờ của server. Sau khi trình duyệt PUT xong, FE gọi
// POST /api/invitation-images/attach để ghi nhận vào DB.
const presignUpload = async (req, res) => {
	try {
		const actor = actorOf(req);
		const invitationId = req.body.invitation_id;
		await invitationImageService.assertCanUseInvitation(invitationId, actor);

		const contentType = String(req.body.content_type || '').toLowerCase();
		const ALLOWED = {
			'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
			'image/avif': '.avif', 'image/heic': '.heic',
		};
		if (!ALLOWED[contentType]) {
			return res.status(400).json({
				success: false,
				message: 'Chỉ nhận ảnh JPEG, PNG, WebP, AVIF hoặc HEIC',
			});
		}

		// Khoá do SERVER sinh, không lấy từ client -> không thể ghi đè tệp của người khác.
		const key = storageService.assertSafeKey(
			'invitations/' + invitationId + '/original/' + Date.now() + '-' + require('crypto').randomUUID() + ALLOWED[contentType]
		);
		const data = await storageService.presignUpload(key, { contentType });
		return res.status(200).json({ success: true, message: 'Tạo link tải lên thành công', data });
	} catch (error) {
		return fail(res, error, 'Tạo link tải lên thất bại');
	}
};

// Hoàn tất sau khi trình duyệt đã PUT xong lên R2: server kéo bản gốc về, chạy
// dây chuyền xử lý ảnh, xoá bản gốc, rồi ghi nhận vào CSDL.
const attachUploaded = async (req, res) => {
	try {
		const data = await invitationImageService.attachFromStorage(req.body || {}, actorOf(req));
		return res.status(201).json({ success: true, message: 'Đã lưu ảnh', data });
	} catch (error) {
		return fail(res, error, 'Lưu ảnh thất bại');
	}
};

module.exports = { getAll, getById, create, update, remove, presignUpload, attachUploaded };
