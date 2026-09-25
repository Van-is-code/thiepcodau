const adminService = require('../services/adminService');

const wrap = (fn, okMsg, okCode = 200) => async (req, res) => {
	try {
		const data = await fn(req);
		return res.status(okCode).json({ success: true, message: okMsg, data });
	} catch (error) {
		return res.status(error.status || 500).json({ success: false, message: error.message || 'Lỗi máy chủ' });
	}
};

const toInt = (v, d) => Number.parseInt(v, 10) || d;

module.exports = {
	stats: wrap((req) => adminService.stats(), 'OK'),

	// Users
	listUsers: wrap((req) => adminService.listUsers({
		search: req.query.search || '',
		page: toInt(req.query.page, 1),
		limit: toInt(req.query.limit, 30)
	}), 'OK'),
	createUser: wrap((req) => adminService.createUser(req.body), 'Đã tạo tài khoản', 201),
	updateUser: wrap((req) => adminService.updateUser(req.params.id, req.body), 'Đã cập nhật tài khoản'),
	addSlots: wrap((req) => adminService.addSlots(req.params.id, req.body.delta), 'Đã cập nhật số lượt'),
	deleteUser: wrap((req) => adminService.deleteUser(req.params.id, req.user?.id), 'Đã xoá tài khoản'),
	getUserDetail: wrap((req) => adminService.getUserDetail(req.params.id), 'OK'),
	createUserInvitation: wrap(
		(req) => adminService.createInvitationForUser(req.params.id, req.body.template_id || req.body.templateId),
		'Đã tạo thiệp cho khách', 201
	),

	// Invitations
	listInvitations: wrap((req) => adminService.listInvitations({
		search: req.query.search || '',
		page: toInt(req.query.page, 1),
		limit: toInt(req.query.limit, 30),
		users_id: req.query.users_id
	}), 'OK'),
	getInvitation: wrap((req) => adminService.getInvitation(req.params.id), 'OK'),
	unlockInvitation: wrap((req) => adminService.unlockInvitation(req.params.id, req.body || {}), 'Đã mở khoá sửa'),
	lockInvitation: wrap((req) => adminService.lockInvitation(req.params.id), 'Đã khoá sửa'),
	setEditDeadline: wrap((req) => adminService.setEditDeadline(req.params.id, req.body.ceremony_date), 'Đã đặt hạn sửa'),
	deleteInvitation: wrap((req) => adminService.deleteInvitation(req.params.id), 'Đã xoá thiệp'),

	// Templates
	listTemplates: wrap((req) => adminService.listTemplates(), 'OK'),
	updateTemplate: wrap((req) => adminService.updateTemplate(req.params.id, req.body), 'Đã cập nhật mẫu'),
	deleteTemplate: wrap((req) => adminService.deleteTemplate(req.params.id), 'Đã xoá mẫu')
};
