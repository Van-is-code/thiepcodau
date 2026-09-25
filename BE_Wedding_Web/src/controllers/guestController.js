const guestService = require('../services/guestService');

const actorOf = (req) => (req.user ? { id: req.user.id, role: req.user.role } : null);

const getAll = async (req, res) => {
	try {
		const data = await guestService.getAll(req.query, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get guest list successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get guest list' });
	}
};

const getById = async (req, res) => {
	try {
		const data = await guestService.getById(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get guest successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get guest' });
	}
};

const create = async (req, res) => {
	try {
		const data = await guestService.create(req.body, actorOf(req));
		return res.status(201).json({ success: true, message: 'Create guest successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create guest' });
	}
};

const update = async (req, res) => {
	try {
		const data = await guestService.update(req.params.id, req.body, actorOf(req));
		return res.status(200).json({ success: true, message: 'Update guest successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to update guest' });
	}
};

const remove = async (req, res) => {
	try {
		await guestService.remove(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Delete guest successfully' });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete guest' });
	}
};

// Trang thiệp công khai chào tên khách: phải xuất trình chuỗi đã mã hoá nằm trong
// link riêng (?guest_name=...), không còn duyệt được theo id trần.
const getPublicByToken = async (req, res) => {
	try {
		const token = req.query.token || req.query.guest_name || req.params.token;
		const data = await guestService.getPublicByToken(token);
		return res.status(200).json({ success: true, message: 'Get guest successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get guest' });
	}
};

module.exports = { getAll, getById, getPublicByToken, create, update, remove };
