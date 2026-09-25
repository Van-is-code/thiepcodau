const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { MessageCheckin, Invitation, Guest } = require('../models');
const {
	pickFilters, pagination, assertUuid, isAdmin, forbidden, unauthorized, notFound,
} = require('../middlewares/ownership');

const resourceName = 'Phản hồi khách mời';

const NO_MATCH = '00000000-0000-0000-0000-000000000000';
const FILTERABLE = ['invitation_id', 'guest_id', 'confirm_attendance', 'guests_type'];

// Giới hạn độ dài: route tạo là CÔNG KHAI nên phải chặn việc nhồi hàng trăm KB vào DB.
const MAX_NAME = 120;
const MAX_MESSAGE = 1000;
// Số phản hồi tối đa lưu cho 1 thiệp — chốt chặn cuối nếu rate limit bị vượt qua.
const MAX_CHECKINS_PER_INVITATION = Number.parseInt(process.env.MAX_CHECKINS_PER_INVITATION, 10) || 2000;

// Chuẩn hoá "có tham dự không" về 3 giá trị cố định, không lưu chuỗi tự do của client.
const ATTENDANCE = new Set(['yes', 'no', 'maybe']);
const normalizeAttendance = (value) => {
	const raw = String(value ?? '').trim().toLowerCase();
	if (['yes', 'true', '1', 'attending', 'join', 'co', 'có', 'tham_du', 'tham du'].includes(raw)) return 'yes';
	if (['no', 'false', '0', 'absent', 'reject', 'khong', 'không', 'khong_tham_du'].includes(raw)) return 'no';
	if (ATTENDANCE.has(raw)) return raw;
	return 'maybe';
};

// Nhà trai / nhà gái — cũng cố định, không nhận chuỗi tuỳ ý.
const GUEST_TYPES = new Set(['nha_trai', 'nha_gai', 'ca_hai']);
const normalizeGuestType = (value) => {
	const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
	return GUEST_TYPES.has(raw) ? raw : 'ca_hai';
};

// Chỉ chủ thiệp (hoặc admin) mới được xem/sửa phản hồi của thiệp đó.
const assertInvitationOwner = async (invitationId, actor) => {
	if (isAdmin(actor)) return;
	if (!actor || !actor.id) throw unauthorized();
	assertUuid(invitationId, 'Thiệp');
	const inv = await Invitation.findByPk(invitationId, { attributes: ['id', 'users_id'] });
	if (!inv) throw notFound('Thiệp');
	if (String(inv.users_id) !== String(actor.id)) {
		throw forbidden('Bạn không có quyền xem phản hồi của thiệp này');
	}
};

const ownedInvitationIds = async (actor) => {
	if (isAdmin(actor)) return null; // null = không giới hạn
	const rows = await Invitation.findAll({ where: { users_id: actor.id }, attributes: ['id'] });
	return rows.map((r) => r.id);
};

// Tên cột trong DB là name_guest / messages / confirm_attendance / number_of_attendees,
// nhưng màn hình "Phản hồi" trên FE lại đọc name / content / status / count. Trả kèm
// cả hai để FE hiển thị đúng mà không cần đổi schema.
const publicCheckin = (row) => {
	const item = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
	return {
		...item,
		name: item.name_guest,
		content: item.messages,
		attending_status: item.confirm_attendance,
		count: item.number_of_attendees,
		date: item.created_at,
	};
};

const getAll = async (query = {}, actor = null) => {
	const { page, limit, offset } = pagination(query);
	const filters = pickFilters(query, FILTERABLE);
	if (filters.invitation_id) assertUuid(filters.invitation_id, 'Thiệp');

	// Không phải admin: chỉ thấy phản hồi của thiệp mình sở hữu.
	if (actor !== null && !isAdmin(actor)) {
		if (!actor || !actor.id) throw unauthorized();
		const ids = await ownedInvitationIds(actor);
		filters.invitation_id = filters.invitation_id
			? (ids.includes(filters.invitation_id) ? filters.invitation_id : NO_MATCH)
			: { [Op.in]: ids.length ? ids : [NO_MATCH] };
	}

	const findOptions = { where: filters, limit, offset };
	if (MessageCheckin.rawAttributes.created_at) findOptions.order = [['created_at', 'DESC']];

	const { count, rows } = await MessageCheckin.findAndCountAll(findOptions);
	return {
		items: rows.map(publicCheckin),
		pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
	};
};

const getAllByInvitationId = async (invitationId, query = {}, actor = null) => {
	if (!invitationId) {
		const error = new Error('invitation_id là bắt buộc'); error.status = 400; throw error;
	}
	await assertInvitationOwner(invitationId, actor);
	// actor = null ở đây là CỐ Ý: quyền đã kiểm xong ngay bên trên, tránh kiểm hai lần.
	return getAll({ ...query, invitation_id: invitationId }, null);
};

const findRaw = async (id) => {
	assertUuid(id, resourceName);
	const item = await MessageCheckin.findByPk(id);
	if (!item) throw notFound(resourceName);
	return item;
};

// Đọc 1 phản hồi: phải là chủ của thiệp chứa phản hồi đó.
// Trước đây không kiểm gì -> đoán id là đọc được lời chúc của đám cưới bất kỳ (IDOR).
const getById = async (id, actor) => {
	const item = await findRaw(id);
	await assertInvitationOwner(item.invitation_id, actor);
	return publicCheckin(item);
};

// Route CÔNG KHAI: khách mời gửi lời chúc / xác nhận tham dự, không cần đăng nhập.
// Vì mở nên phải tự bảo vệ: chỉ nhận đúng các trường cần thiết, cắt độ dài, bắt buộc
// thiệp có thật, và chặn khi 1 thiệp đã nhận quá nhiều phản hồi.
//
// Trước đây hàm này nhận nguyên req.body: thiếu invitation_id thì lỗi 500, và khách
// gửi được cột tuỳ ý. Nay dùng danh sách trắng.
const create = async (payload) => {
	const invitationId = payload?.invitation_id;
	if (!invitationId) {
		const e = new Error('invitation_id là bắt buộc'); e.status = 400; throw e;
	}
	assertUuid(invitationId, 'Thiệp');

	const invitation = await Invitation.findByPk(invitationId, { attributes: ['id'] });
	if (!invitation) {
		const e = new Error('Thiệp không tồn tại'); e.status = 400; throw e;
	}

	const used = await MessageCheckin.count({ where: { invitation_id: invitationId } });
	if (used >= MAX_CHECKINS_PER_INVITATION) {
		const e = new Error('Thiệp này đã nhận quá nhiều phản hồi. Vui lòng liên hệ chủ thiệp.');
		e.status = 429; throw e;
	}

	const nameGuest = String(payload.name_guest ?? payload.name ?? '').trim().slice(0, MAX_NAME);
	if (!nameGuest) {
		const e = new Error('Vui lòng nhập tên của bạn'); e.status = 400; throw e;
	}

	const attendees = Number.parseInt(payload.number_of_attendees ?? payload.count, 10);

	const data = {
		id: randomUUID(),
		invitation_id: invitationId,
		name_guest: nameGuest,
		messages: String(payload.messages ?? payload.message ?? payload.content ?? '').trim().slice(0, MAX_MESSAGE),
		confirm_attendance: normalizeAttendance(payload.confirm_attendance ?? payload.attending_status ?? payload.attending),
		number_of_attendees: Number.isFinite(attendees) ? Math.min(Math.max(attendees, 0), 50) : 1,
		guests_type: normalizeGuestType(payload.guests_type),
		created_at: new Date(),
	};

	if (payload.guest_id) {
		assertUuid(payload.guest_id, 'Khách mời');
		const guest = await Guest.findByPk(payload.guest_id, { attributes: ['id'] });
		if (guest) data.guest_id = guest.id;
	}

	return publicCheckin(await MessageCheckin.create(data));
};

const update = async (id, payload, actor) => {
	const item = await findRaw(id);
	await assertInvitationOwner(item.invitation_id, actor);

	const data = {};
	if (payload.name_guest !== undefined || payload.name !== undefined) {
		data.name_guest = String(payload.name_guest ?? payload.name).trim().slice(0, MAX_NAME);
	}
	if (payload.messages !== undefined || payload.content !== undefined) {
		data.messages = String(payload.messages ?? payload.content).trim().slice(0, MAX_MESSAGE);
	}
	if (payload.confirm_attendance !== undefined || payload.attending_status !== undefined) {
		data.confirm_attendance = normalizeAttendance(payload.confirm_attendance ?? payload.attending_status);
	}
	if (payload.number_of_attendees !== undefined || payload.count !== undefined) {
		const n = Number.parseInt(payload.number_of_attendees ?? payload.count, 10);
		data.number_of_attendees = Number.isFinite(n) ? Math.min(Math.max(n, 0), 50) : 0;
	}
	if (payload.guests_type !== undefined) data.guests_type = normalizeGuestType(payload.guests_type);

	await item.update(data);
	return publicCheckin(item);
};

const remove = async (id, actor) => {
	const item = await findRaw(id);
	await assertInvitationOwner(item.invitation_id, actor);
	await item.destroy();
	return true;
};

module.exports = {
	getAll, getAllByInvitationId, getById, create, update, remove,
	publicCheckin, normalizeAttendance, normalizeGuestType,
	MAX_CHECKINS_PER_INVITATION,
};
