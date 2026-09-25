const { randomUUID } = require('crypto');
const crypto = require('crypto');
const { sequelize, Guest, Invitation, PrivateInvitation } = require('../models');
const {
	pickFilters, pagination, assertUuid, isAdmin, forbidden, unauthorized, notFound,
} = require('../middlewares/ownership');

const resourceName = 'Khách mời';

// Chỉ các cột này được phép lọc từ query. Trước đây cả req.query bị đổ vào WHERE.
const FILTERABLE = ['name', 'description'];

const getNowValue = (attribute) => {
	const now = new Date();
	const typeKey = attribute?.type?.key;
	return typeKey === 'STRING' || typeKey === 'TEXT' ? now.toISOString() : now;
};

const buildGuestEncryptedQueryValue = (guest, invitationId) => {
	const secret = process.env.GUEST_LINK_SECRET || process.env.JWT_SECRET || 'guest_link_secret';
	const key = crypto.createHash('sha256').update(secret).digest();
	const iv = crypto.randomBytes(12);

	const payload = JSON.stringify({
		id: guest.id,
		name: guest.name,
		description: guest.description || null,
		invitation_id: invitationId,
		ts: Date.now()
	});

	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();

	return Buffer.concat([iv, tag, encrypted]).toString('base64url');
};

// Giải mã tham số guest_name trên link riêng. Chuỗi có gắn thẻ xác thực (GCM) nên
// không thể sửa nội dung hay tự chế ra một chuỗi hợp lệ mà không biết khoá.
const decodeGuestToken = (token) => {
	const secret = process.env.GUEST_LINK_SECRET || process.env.JWT_SECRET || 'guest_link_secret';
	const key = crypto.createHash('sha256').update(secret).digest();
	let raw;
	try {
		raw = Buffer.from(String(token || ''), 'base64url');
	} catch (_e) {
		throw notFound(resourceName);
	}
	if (raw.length < 29) throw notFound(resourceName);

	try {
		const iv = raw.subarray(0, 12);
		const tag = raw.subarray(12, 28);
		const data = raw.subarray(28);
		const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(tag);
		const out = Buffer.concat([decipher.update(data), decipher.final()]);
		return JSON.parse(out.toString('utf8'));
	} catch (_e) {
		throw notFound(resourceName);
	}
};

// Chủ thiệp (hoặc admin) mới được gắn khách vào thiệp.
const assertOwnsInvitation = async (invitationId, actor) => {
	if (!invitationId) {
		const e = new Error('invitation_id là bắt buộc khi tạo khách mời'); e.status = 400; throw e;
	}
	assertUuid(invitationId, 'Thiệp');
	const invitation = await Invitation.findByPk(invitationId, { attributes: ['id', 'users_id', 'invitation_slug'] });
	if (!invitation) {
		const e = new Error('invitation_id không tồn tại'); e.status = 400; throw e;
	}
	if (isAdmin(actor)) return invitation;
	if (!actor || !actor.id) throw unauthorized();
	if (String(invitation.users_id) !== String(actor.id)) {
		throw forbidden('Bạn không có quyền thêm khách mời cho thiệp này');
	}
	return invitation;
};

const getAll = async (query = {}, actor = null) => {
	const { page, limit, offset } = pagination(query);
	const filters = pickFilters(query, FILTERABLE);

	// Người dùng thường chỉ thấy khách của mình; ghi đè sau cùng nên không lách được.
	if (!isAdmin(actor)) {
		if (!actor || !actor.id) throw unauthorized();
		filters.users_id = actor.id;
	}

	// Lọc theo thiệp: khách nối với thiệp qua private_invitation.invitationns_id
	const invitationId = query.invitation_id || query.invitationId;
	const privateInclude = {
		model: PrivateInvitation,
		as: 'privateInvitation',
		required: Boolean(invitationId),
		attributes: ['id', 'url', 'invitationns_id']
	};
	if (invitationId) {
		assertUuid(invitationId, 'Thiệp');
		privateInclude.where = { invitationns_id: invitationId };
	}

	const findOptions = { where: filters, limit, offset, include: [privateInclude], distinct: true };
	if (Guest.rawAttributes.created_at) findOptions.order = [['created_at', 'DESC']];

	const { count, rows } = await Guest.findAndCountAll(findOptions);
	return {
		items: rows,
		pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
	};
};

const findRaw = async (id) => {
	assertUuid(id, resourceName);
	const item = await Guest.findOne({
		where: { id },
		include: [{
			model: PrivateInvitation,
			as: 'privateInvitation',
			required: false,
			attributes: ['id', 'url', 'invitationns_id']
		}]
	});
	if (!item) throw notFound(resourceName);
	return item;
};

// Đọc có kiểm quyền. actor === undefined chỉ dùng cho lời gọi nội bộ tin cậy.
const getById = async (id, actor = undefined) => {
	const item = await findRaw(id);
	if (actor === undefined) return item;
	if (isAdmin(actor)) return item;
	if (!actor || !actor.id) throw unauthorized();
	if (!item.users_id || String(item.users_id) !== String(actor.id)) {
		throw forbidden('Bạn không có quyền xem khách mời này');
	}
	return item;
};

// Dùng cho trang thiệp công khai: khách mời mở link riêng có tham số guest_name đã mã hoá.
//
// TRƯỚC ĐÂY: GET /api/guests/:id là route CÔNG KHAI và trả về bản ghi đầy đủ chỉ với
// id -> ai cũng duyệt được toàn bộ danh sách khách mời của mọi đám cưới. Nay muốn đọc
// tên khách thì phải xuất trình đúng chuỗi đã mã hoá nằm trong link riêng của khách đó.
const getPublicByToken = async (token) => {
	const payload = decodeGuestToken(token);
	const item = await Guest.findByPk(payload.id, { attributes: ['id', 'name', 'description'] });
	if (!item) throw notFound(resourceName);
	// Chỉ trả đúng phần thiệp cần để chào tên khách, không lộ gì thêm.
	return {
		id: item.id,
		name: item.name,
		description: item.description || null,
		invitation_id: payload.invitation_id || null,
	};
};

const create = async (payload, actor) => {
	if (!actor || !actor.id) throw unauthorized('Thiếu thông tin user từ token');

	const data = { ...payload };
	const invitationId = data.invitation_id;
	delete data.id;
	delete data.invitation_id;
	delete data.users_id;
	data.id = randomUUID();
	data.users_id = actor.id;

	// Kiểm quyền với thiệp: trước đây chỉ kiểm "thiệp có tồn tại không", nên bất kỳ
	// ai cũng nhét được khách lạ vào đám cưới của người khác.
	const invitation = await assertOwnsInvitation(invitationId, actor);

	data.name = String(data.name || '').trim().slice(0, 255);
	if (!data.name) {
		const e = new Error('Tên khách mời là bắt buộc'); e.status = 400; throw e;
	}
	if (data.description !== undefined) data.description = String(data.description || '').slice(0, 1000);

	if (Guest.rawAttributes.created_at) data.created_at = getNowValue(Guest.rawAttributes.created_at);
	if (Guest.rawAttributes.updated_at) data.updated_at = getNowValue(Guest.rawAttributes.updated_at);

	return sequelize.transaction(async (transaction) => {
		const guest = await Guest.create(data, { transaction });
		const encryptedGuestValue = buildGuestEncryptedQueryValue(guest, invitationId);

		await PrivateInvitation.create(
			{
				id: randomUUID(),
				guest_id: guest.id,
				invitationns_id: invitationId,
				url: `/invitation/${invitation.invitation_slug}?guest_name=${encodeURIComponent(encryptedGuestValue)}`,
				created_at: getNowValue(PrivateInvitation.rawAttributes.created_at),
				updated_at: getNowValue(PrivateInvitation.rawAttributes.updated_at)
			},
			{ transaction }
		);

		return guest;
	});
};

const update = async (id, payload, actor) => {
	const item = await getById(id, actor);

	const data = { ...payload };
	delete data.id;
	delete data.users_id;
	delete data.invitation_id;
	if (data.name !== undefined) data.name = String(data.name).trim().slice(0, 255);
	if (data.description !== undefined) data.description = String(data.description || '').slice(0, 1000);

	if (Guest.rawAttributes.updated_at) data.updated_at = getNowValue(Guest.rawAttributes.updated_at);

	await item.update(data);
	return item;
};

// Trước đây xoá không kiểm chủ sở hữu -> bất kỳ ai cũng xoá được khách của người khác.
const remove = async (id, actor) => {
	const item = await getById(id, actor);
	await item.destroy();
	return true;
};

module.exports = { getAll, getById, getPublicByToken, create, update, remove, decodeGuestToken };
