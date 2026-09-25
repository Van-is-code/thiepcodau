const privateInvitationService = require('../services/privateInvitationService');

// Mọi lời gọi kèm actor -> service giới hạn phạm vi theo thiệp mà actor sở hữu.
const actorOf = (req) => (req.user ? { id: req.user.id, role: req.user.role } : null);

const getAll = async (req, res) => {
	try {
		const data = await privateInvitationService.getAll(req.query, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get private_invitation list successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get private_invitation list' });
	}
};

const getById = async (req, res) => {
	try {
		const data = await privateInvitationService.getById(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get private_invitation successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get private_invitation' });
	}
};

const create = async (req, res) => {
	try {
		const data = await privateInvitationService.create(req.body, actorOf(req));
		return res.status(201).json({ success: true, message: 'Create private_invitation successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create private_invitation' });
	}
};

const update = async (req, res) => {
	try {
		const data = await privateInvitationService.update(req.params.id, req.body, actorOf(req));
		return res.status(200).json({ success: true, message: 'Update private_invitation successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to update private_invitation' });
	}
};

const remove = async (req, res) => {
	try {
		await privateInvitationService.remove(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Delete private_invitation successfully' });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete private_invitation' });
	}
};

module.exports = { getAll, getById, create, update, remove };
