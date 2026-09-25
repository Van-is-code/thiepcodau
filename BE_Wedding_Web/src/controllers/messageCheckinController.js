const messageCheckinService = require('../services/messageCheckinService');

const actorOf = (req) => (req.user ? { id: req.user.id, role: req.user.role } : null);

const getAll = async (req, res) => {
	try {
		const data = await messageCheckinService.getAll(req.query, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get message_checkin list successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get message_checkin list' });
	}
};

const getAllByInvitationId = async (req, res) => {
	try {
		const data = await messageCheckinService.getAllByInvitationId(
			req.params.invitation_id,
			req.query,
			actorOf(req)
		);
		return res.status(200).json({
			success: true,
			message: 'Get message_checkin list by invitation_id successfully',
			data
		});
	} catch (error) {
		return res.status(error.status || 500).json({
			success: false,
			message: error.message || 'Failed to get message_checkin list by invitation_id'
		});
	}
};

const getById = async (req, res) => {
	try {
		const data = await messageCheckinService.getById(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Get message_checkin successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to get message_checkin' });
	}
};

const create = async (req, res) => {
	try {
		const data = await messageCheckinService.create(req.body);
		return res.status(201).json({ success: true, message: 'Create message_checkin successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to create message_checkin' });
	}
};

const update = async (req, res) => {
	try {
		const data = await messageCheckinService.update(req.params.id, req.body, actorOf(req));
		return res.status(200).json({ success: true, message: 'Update message_checkin successfully', data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to update message_checkin' });
	}
};

const remove = async (req, res) => {
	try {
		await messageCheckinService.remove(req.params.id, actorOf(req));
		return res.status(200).json({ success: true, message: 'Delete message_checkin successfully' });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to delete message_checkin' });
	}
};

module.exports = { getAll, getAllByInvitationId, getById, create, update, remove };
