const groomService = require('../services/groomService');

// Ép mọi lời gọi phải kèm actor -> service tự giới hạn phạm vi theo chủ sở hữu.
const actorOf = (req) => (req.user ? { id: req.user.id, role: req.user.role } : null);

const getAll = async (req, res) => {
	try {
		const data = await groomService.getAll(req.query, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get groom list successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get groom list' });
	}
};

const getById = async (req, res) => {
	try {
		const data = await groomService.getById(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get groom successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get groom' });
	}
};

const create = async (req, res) => {
	try {
		const data = await groomService.create(req.body, req.user?.id);
		return res.status(201).json({ success: true, message: 'Create groom successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create groom' });
	}
};

const update = async (req, res) => {
	try {
		const data = await groomService.update(req.params.id, req.body, actorOf(req));
		return res.status(200).json({ success: true, message: 'Update groom successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to update groom' });
	}
};

const remove = async (req, res) => {
	try {
		await groomService.remove(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Delete groom successfully' });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete groom' });
	}
};

module.exports = { getAll, getById, create, update, remove };
