const brideService = require('../services/brideService');

// Ép mọi lời gọi phải kèm actor -> service tự giới hạn phạm vi theo chủ sở hữu.
const actorOf = (req) => (req.user ? { id: req.user.id, role: req.user.role } : null);

const getAll = async (req, res) => {
	try {
		const data = await brideService.getAll(req.query, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get bride list successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get bride list' });
	}
};

const getById = async (req, res) => {
	try {
		const data = await brideService.getById(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get bride successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get bride' });
	}
};

const create = async (req, res) => {
	try {
		const data = await brideService.create(req.body, req.user?.id);
		return res.status(201).json({ success: true, message: 'Create bride successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create bride' });
	}
};

const update = async (req, res) => {
	try {
		const data = await brideService.update(req.params.id, req.body, actorOf(req));
		return res.status(200).json({ success: true, message: 'Update bride successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to update bride' });
	}
};

const remove = async (req, res) => {
	try {
		await brideService.remove(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Delete bride successfully' });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete bride' });
	}
};

module.exports = { getAll, getById, create, update, remove };
