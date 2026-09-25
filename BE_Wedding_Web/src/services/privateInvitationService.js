const { randomUUID } = require('crypto');
const { PrivateInvitation, Invitation } = require('../models');
const {
	pickFilters, pagination, assertUuid, isAdmin, forbidden, unauthorized, notFound,
} = require('../middlewares/ownership');

const resourceName = 'Link thiệp riêng';

const FILTERABLE = ['invitationns_id', 'guest_id'];

const getNowValue = (attribute) => {
	const now = new Date();
	const typeKey = attribute?.type?.key;
	return typeKey === 'STRING' || typeKey === 'TEXT' ? now.toISOString() : now;
};

// Link riêng gắn với 1 thiệp -> quyền với link = quyền với thiệp.
//
// Quan trọng: mỗi bản ghi chứa URL có kèm chuỗi mã hoá nhận diện khách mời. Trước
// đây GET /api/private-invitations trả về TẤT CẢ bản ghi của mọi đám cưới, nghĩa là
// bất kỳ tài khoản nào cũng lấy được link cá nhân hoá của toàn bộ khách mời trong hệ
// thống và mạo danh họ xác nhận tham dự.
const assertOwnsInvitation = async (invitationId, actor) => {
	if (isAdmin(actor)) return;
	if (!actor || !actor.id) throw unauthorized();
	assertUuid(invitationId, 'Thiệp');
	const inv = await Invitation.findByPk(invitationId, { attributes: ['id', 'users_id'] });
	if (!inv) throw notFound('Thiệp');
	if (String(inv.users_id) !== String(actor.id)) {
		throw forbidden('Bạn không có quyền với link thiệp riêng này');
	}
};

const ownedInvitationIds = async (actor) => {
	const rows = await Invitation.findAll({ where: { users_id: actor.id }, attributes: ['id'] });
	return rows.map((r) => r.id);
};

const getAll = async (query = {}, actor = null) => {
	const { page, limit, offset } = pagination(query);
	const where = pickFilters(query, FILTERABLE);

	if (!isAdmin(actor)) {
		if (!actor || !actor.id) throw unauthorized();
		const ids = await ownedInvitationIds(actor);
		if (where.invitationns_id) {
			assertUuid(where.invitationns_id, 'Thiệp');
			if (!ids.includes(where.invitationns_id)) {
				throw forbidden('Bạn không có quyền xem link thiệp riêng của thiệp này');
			}
		} else {
			// Chưa có thiệp nào -> danh sách rỗng, không phải "thấy hết".
			where.invitationns_id = ids.length ? ids : ['00000000-0000-0000-0000-000000000000'];
		}
	}

	const findOptions = { where, limit, offset };
	if (PrivateInvitation.rawAttributes.created_at) findOptions.order = [['created_at', 'DESC']];

	const { count, rows } = await PrivateInvitation.findAndCountAll(findOptions);
	return {
		items: rows,
		pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
	};
};

const findRaw = async (id) => {
	assertUuid(id, resourceName);
	const item = await PrivateInvitation.findByPk(id);
	if (!item) throw notFound(resourceName);
	return item;
};

const getById = async (id, actor) => {
	const item = await findRaw(id);
	await assertOwnsInvitation(item.invitationns_id, actor);
	return item;
};

const create = async (payload, actor) => {
	const invitationId = payload?.invitationns_id;
	await assertOwnsInvitation(invitationId, actor);

	const data = {
		id: randomUUID(),
		invitationns_id: invitationId,
		guest_id: payload.guest_id || null,
		url: String(payload.url || '').slice(0, 500),
	};
	if (data.guest_id) assertUuid(data.guest_id, 'Khách mời');

	if (PrivateInvitation.rawAttributes.created_at) data.created_at = getNowValue(PrivateInvitation.rawAttributes.created_at);
	if (PrivateInvitation.rawAttributes.updated_at) data.updated_at = getNowValue(PrivateInvitation.rawAttributes.updated_at);

	return PrivateInvitation.create(data);
};

const update = async (id, payload, actor) => {
	const item = await getById(id, actor);

	const data = {};
	if (payload.url !== undefined) data.url = String(payload.url).slice(0, 500);
	if (PrivateInvitation.rawAttributes.updated_at) data.updated_at = getNowValue(PrivateInvitation.rawAttributes.updated_at);

	await item.update(data);
	return item;
};

const remove = async (id, actor) => {
	const item = await getById(id, actor);
	await item.destroy();
	return true;
};

module.exports = { getAll, getById, create, update, remove };
