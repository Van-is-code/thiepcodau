const invitationService = require('../services/invitationService');

const actorOf = (req) => (req.user ? { id: req.user.id, role: req.user.role } : null);

const getAll = async (req, res) => {
	try {
		const data = await invitationService.getAll(req.query, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get invitation list successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get invitation list' });
	}
};

const getById = async (req, res) => {
	try {
		const data = await invitationService.getById(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get invitation successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get invitation' });
	}
};

const getBySlug = async (req, res) => {
	try {
		const data = await invitationService.getBySlug(req.params.invitation_slug);
		return res.status(200).json({ success: true, message: 'Get invitation successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get invitation' });
	}
};

const create = async (req, res) => {
	try {
		const data = await invitationService.create(req.body, req.user?.id);
		return res.status(201).json({ success: true, message: 'Create invitation successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create invitation' });
	}
};

const update = async (req, res) => {
	try {
		const data = await invitationService.update(req.params.id, req.body, actorOf(req));
		return res.status(200).json({ success: true, message: 'Update invitation successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Failed to update invitation',
			lockState: error.lockState
		});
	}
};

// Lưu 1 lượt từ trình sửa (gộp invitation + groom + bride) — tính 1 lượt sửa.
const editorSave = async (req, res) => {
	try {
		const data = await invitationService.editorSave(req.params.id, req.body, actorOf(req));
		return res.status(200).json({
			success: true,
			message: 'Đã lưu thiệp',
			data,
			lockState: data.lock_state
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Lưu thiệp thất bại',
			lockState: error.lockState
		});
	}
};

// Cập nhật nhạc nền (nhiều link / kho nhạc) — không tính vào hạn mức sửa.
const setMusic = async (req, res) => {
	try {
		const data = await invitationService.setMusic(req.params.id, req.body, actorOf(req));
		return res.status(200).json({ success: true, message: 'Đã cập nhật nhạc nền', data });
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Cập nhật nhạc thất bại',
			lockState: error.lockState
		});
	}
};

// Lưu tài khoản ngân hàng mừng cưới — không tính vào hạn mức sửa.
const setBank = async (req, res) => {
	try {
		const data = await invitationService.setBank(req.params.id, req.body, actorOf(req));
		return res.status(200).json({ success: true, message: 'Đã lưu tài khoản ngân hàng', data });
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Lưu tài khoản ngân hàng thất bại',
			lockState: error.lockState
		});
	}
};

// Đổi mẫu — không tính vào hạn mức sửa.
const changeTemplate = async (req, res) => {
	try {
		const templateId = req.body.template_id || req.body.templateId;
		const data = await invitationService.changeTemplate(req.params.id, templateId, actorOf(req));
		return res.status(200).json({ success: true, message: 'Đã đổi mẫu thiệp', data });
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Đổi mẫu thất bại',
			lockState: error.lockState
		});
	}
};

const remove = async (req, res) => {
	try {
		await invitationService.remove(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Delete invitation successfully' });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete invitation' });
	}
};

const createDraft = async (req, res) => {
	try {
		const data = await invitationService.createDraft(req.body.template_id, req.user?.id);
		return res.status(201).json({ success: true, message: 'Create draft invitation successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create draft invitation' });
	}
};

module.exports = { getAll, getById, getBySlug, create, update, editorSave, changeTemplate, setMusic, setBank, remove, createDraft };
