const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { assertCredentials, assertPassword, BCRYPT_ROUNDS } = require('../utils/credentials');
const {
	sequelize, User, Invitation, InvitationTemplate, Groom, Bride, Guest, MessageCheckin
} = require('../models');
const { getLockState, computeEditDeadline } = require('../utils/editLock');
const invitationService = require('./invitationService');

const sanitizeUser = (u) => ({
	id: u.id,
	username: u.username,
	role: u.role,
	slot: u.slot || 0,
	created_at: u.created_at,
	updated_at: u.updated_at,
	invitation_count: u.get ? u.get('invitation_count') : u.invitation_count
});

const stats = async () => {
	const [totalUsers, totalInvitations, totalGuests, totalCheckins, invitations] = await Promise.all([
		User.count(),
		Invitation.count(),
		Guest.count(),
		MessageCheckin.count(),
		Invitation.findAll({ attributes: ['id', 'edit_count', 'edit_deadline'] })
	]);

	const locked = invitations.filter((i) => getLockState(i).locked).length;

	const recent = await Invitation.findAll({
		order: [['created_at', 'DESC']],
		limit: 8,
		include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
	});

	return {
		totalUsers,
		totalInvitations,
		lockedInvitations: locked,
		activeInvitations: totalInvitations - locked,
		totalGuests,
		totalCheckins,
		recentInvitations: recent.map((r) => ({
			id: r.id,
			title_vi: r.title_vi,
			slug: r.invitation_slug,
			owner: r.user ? r.user.username : null,
			created_at: r.created_at,
			lock_state: getLockState(r)
		}))
	};
};

// ---- Users ----
const listUsers = async ({ search = '', page = 1, limit = 30 } = {}) => {
	const where = {};
	if (search) where.username = { [Op.iLike]: `%${search}%` };
	const offset = (page - 1) * limit;

	const { count, rows } = await User.findAndCountAll({
		where,
		order: [['created_at', 'DESC']],
		limit,
		offset
	});

	// đếm số thiệp mỗi user
	const ids = rows.map((r) => r.id);
	const counts = ids.length
		? await Invitation.findAll({
			attributes: ['users_id', [sequelize.fn('COUNT', sequelize.col('id')), 'c']],
			where: { users_id: { [Op.in]: ids } },
			group: ['users_id']
		})
		: [];
	const countMap = Object.fromEntries(counts.map((c) => [String(c.users_id), Number(c.get('c'))]));

	return {
		items: rows.map((u) => ({ ...sanitizeUser(u), invitation_count: countMap[String(u.id)] || 0 })),
		pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
	};
};

const createUser = async ({ username: rawUsername, password: rawPassword, role = 'user', slot = 0 }) => {
	// Tài khoản admin cấp cho khách cũng phải theo đúng chính sách như tự đăng ký —
	// đây mới là đường tạo tài khoản CHÍNH của hệ thống.
	const { username, password } = assertCredentials(rawUsername, rawPassword);
	const existed = await User.findOne({ where: { username } });
	if (existed) { const e = new Error('username đã tồn tại'); e.status = 409; throw e; }

	const user = await User.create({
		id: randomUUID(),
		username: String(username).trim(),
		password: await bcrypt.hash(password, BCRYPT_ROUNDS),
		role: role === 'admin' ? 'admin' : 'user',
		slot: Math.max(Number.parseInt(slot, 10) || 0, 0),
		created_at: new Date(),
		updated_at: new Date()
	});
	return sanitizeUser(user);
};

const updateUser = async (id, { username, role, slot, password }) => {
	const user = await User.findByPk(id);
	if (!user) { const e = new Error('Không tìm thấy user'); e.status = 404; throw e; }

	if (username && username !== user.username) {
		const existed = await User.findOne({ where: { username, id: { [Op.ne]: id } } });
		if (existed) { const e = new Error('username đã tồn tại'); e.status = 409; throw e; }
		user.username = String(username).trim();
	}
	if (role === 'admin' || role === 'user') user.role = role;
	if (slot !== undefined && slot !== null && slot !== '') {
		user.slot = Math.max(Number.parseInt(slot, 10) || 0, 0);
	}
	// Admin đặt lại mật khẩu hộ khách: vẫn phải đủ mạnh.
	if (password) {
		assertPassword(password, { username: user.username });
		user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
	}

	user.updated_at = new Date();
	await user.save();
	return sanitizeUser(user);
};

const addSlots = async (id, delta) => {
	const user = await User.findByPk(id);
	if (!user) { const e = new Error('Không tìm thấy user'); e.status = 404; throw e; }
	const n = Number.parseInt(delta, 10);
	if (!Number.isInteger(n) || n === 0) { const e = new Error('delta phải là số nguyên khác 0'); e.status = 400; throw e; }
	user.slot = Math.max((user.slot || 0) + n, 0);
	user.updated_at = new Date();
	await user.save();
	return sanitizeUser(user);
};

const deleteUser = async (id, actingUserId) => {
	if (String(id) === String(actingUserId)) {
		const e = new Error('Không thể tự xoá tài khoản đang đăng nhập'); e.status = 400; throw e;
	}
	const user = await User.findByPk(id);
	if (!user) { const e = new Error('Không tìm thấy user'); e.status = 404; throw e; }
	if (user.role === 'admin') {
		const admins = await User.count({ where: { role: 'admin' } });
		if (admins <= 1) { const e = new Error('Không thể xoá admin cuối cùng'); e.status = 400; throw e; }
	}
	await user.destroy();
	return true;
};

// Chi tiết 1 khách: hồ sơ + danh sách thiệp của khách + số khách mời / phản hồi mỗi thiệp.
const getUserDetail = async (id) => {
	const user = await User.findByPk(id);
	if (!user) { const e = new Error('Không tìm thấy user'); e.status = 404; throw e; }

	const invitations = await Invitation.findAll({
		where: { users_id: id },
		order: [['created_at', 'DESC']],
		include: [
			{ model: Groom, as: 'groom', attributes: ['id', 'name_groom'] },
			{ model: Bride, as: 'bride', attributes: ['id', 'name_bride'] }
		]
	});

	const invIds = invitations.map((i) => i.id);
	const [guestCounts, checkinCounts] = await Promise.all([
		invIds.length ? MessageCheckin.findAll({
			attributes: ['invitation_id', [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('guest_id'))), 'c']],
			where: { invitation_id: { [Op.in]: invIds } }, group: ['invitation_id']
		}) : [],
		invIds.length ? MessageCheckin.findAll({
			attributes: ['invitation_id', [sequelize.fn('COUNT', sequelize.col('id')), 'c']],
			where: { invitation_id: { [Op.in]: invIds } }, group: ['invitation_id']
		}) : []
	]);
	const gMap = Object.fromEntries(guestCounts.map((x) => [String(x.invitation_id), Number(x.get('c'))]));
	const cMap = Object.fromEntries(checkinCounts.map((x) => [String(x.invitation_id), Number(x.get('c'))]));

	return {
		user: sanitizeUser(user),
		invitations: invitations.map((i) => {
			const p = i.toJSON();
			p.lock_state = getLockState(p);
			p.guest_count = gMap[String(i.id)] || 0;
			p.checkin_count = cMap[String(i.id)] || 0;
			return p;
		})
	};
};

// Admin tạo thiệp HỘ khách — thiệp thuộc về tài khoản khách, KHÔNG trừ lượt của khách.
const createInvitationForUser = async (userId, templateId) => {
	const user = await User.findByPk(userId);
	if (!user) { const e = new Error('Không tìm thấy tài khoản khách'); e.status = 404; throw e; }
	return invitationService.createDraft(templateId, userId, { chargeSlot: false });
};

// ---- Invitations ----
const listInvitations = async ({ search = '', page = 1, limit = 30, users_id } = {}) => {
	const where = {};
	if (users_id) where.users_id = users_id;
	if (search) {
		where[Op.or] = [
			{ title_vi: { [Op.iLike]: `%${search}%` } },
			{ invitation_slug: { [Op.iLike]: `%${search}%` } }
		];
	}
	const offset = (page - 1) * limit;
	const { count, rows } = await Invitation.findAndCountAll({
		where,
		order: [['created_at', 'DESC']],
		limit,
		offset,
		include: [
			{ model: User, as: 'user', attributes: ['id', 'username', 'role'] },
			{ model: Groom, as: 'groom', attributes: ['id', 'name_groom'] },
			{ model: Bride, as: 'bride', attributes: ['id', 'name_bride'] }
		]
	});
	return {
		items: rows.map((r) => {
			const p = r.toJSON();
			p.lock_state = getLockState(p);
			return p;
		}),
		pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
	};
};

const getInvitation = async (id) => {
	const item = await Invitation.findByPk(id, {
		include: [
			{ model: User, as: 'user', attributes: ['id', 'username', 'role'] },
			{ model: Groom, as: 'groom' },
			{ model: Bride, as: 'bride' },
			{ model: InvitationTemplate, as: 'template' }
		]
	});
	if (!item) { const e = new Error('Không tìm thấy thiệp'); e.status = 404; throw e; }
	const p = item.toJSON();
	p.lock_state = getLockState(p);
	return p;
};

// Mở khoá: reset lượt sửa + bỏ hạn ngày cưới (hoặc gia hạn thêm N ngày).
const unlockInvitation = async (id, { extendDays } = {}) => {
	const item = await Invitation.findByPk(id);
	if (!item) { const e = new Error('Không tìm thấy thiệp'); e.status = 404; throw e; }
	item.edit_count = 0;
	if (extendDays) {
		const base = item.edit_deadline ? new Date(item.edit_deadline) : new Date();
		base.setUTCDate(base.getUTCDate() + Number.parseInt(extendDays, 10));
		item.edit_deadline = base;
	} else {
		item.edit_deadline = null;
	}
	item.updated_at = new Date();
	await item.save();
	const p = item.toJSON();
	p.lock_state = getLockState(p);
	return p;
};

// Khoá thủ công ngay.
const lockInvitation = async (id) => {
	const item = await Invitation.findByPk(id);
	if (!item) { const e = new Error('Không tìm thấy thiệp'); e.status = 404; throw e; }
	const past = new Date(); past.setUTCFullYear(past.getUTCFullYear() - 1);
	item.edit_deadline = past;
	item.updated_at = new Date();
	await item.save();
	const p = item.toJSON();
	p.lock_state = getLockState(p);
	return p;
};

const setEditDeadline = async (id, ceremonyDate) => {
	const item = await Invitation.findByPk(id);
	if (!item) { const e = new Error('Không tìm thấy thiệp'); e.status = 404; throw e; }
	item.edit_deadline = computeEditDeadline(ceremonyDate || item.ceremony_date);
	item.updated_at = new Date();
	await item.save();
	return getInvitation(id);
};

const deleteInvitation = async (id) => {
	const item = await Invitation.findByPk(id);
	if (!item) { const e = new Error('Không tìm thấy thiệp'); e.status = 404; throw e; }
	await item.destroy();
	return true;
};

// ---- Templates ----
const listTemplates = async () => {
	const rows = await InvitationTemplate.findAll({ order: [['created_at', 'DESC']] });
	const ids = rows.map((r) => r.id);
	const counts = ids.length
		? await Invitation.findAll({
			attributes: ['template_id', [sequelize.fn('COUNT', sequelize.col('id')), 'c']],
			where: { template_id: { [Op.in]: ids } },
			group: ['template_id']
		})
		: [];
	const map = Object.fromEntries(counts.map((c) => [String(c.template_id), Number(c.get('c'))]));
	return rows.map((r) => ({ ...r.toJSON(), invitation_count: map[String(r.id)] || 0 }));
};

const updateTemplate = async (id, { template_name, status }) => {
	const item = await InvitationTemplate.findByPk(id);
	if (!item) { const e = new Error('Không tìm thấy mẫu'); e.status = 404; throw e; }
	if (template_name) item.template_name = template_name;
	if (status) item.status = status;
	await item.save();
	return item.toJSON();
};

const deleteTemplate = async (id) => {
	const used = await Invitation.count({ where: { template_id: id } });
	if (used > 0) {
		const e = new Error(`Mẫu đang được ${used} thiệp dùng, không thể xoá`); e.status = 400; throw e;
	}
	const item = await InvitationTemplate.findByPk(id);
	if (!item) { const e = new Error('Không tìm thấy mẫu'); e.status = 404; throw e; }
	await item.destroy();
	return true;
};

module.exports = {
	stats,
	listUsers, createUser, updateUser, addSlots, deleteUser, getUserDetail, createInvitationForUser,
	listInvitations, getInvitation, unlockInvitation, lockInvitation, setEditDeadline, deleteInvitation,
	listTemplates, updateTemplate, deleteTemplate
};
