const { randomUUID } = require('crypto');
const { Bride } = require('../models');
const { pickFilters, pagination, assertOwner, scopeToOwner, assertUuid, isAdmin } = require('../middlewares/ownership');

const resourceName = 'Bride';

const getNowValue = (attribute) => {
	const now = new Date();
	const typeKey = attribute?.type?.key;
	return typeKey === 'STRING' || typeKey === 'TEXT' ? now.toISOString() : now;
};

// Danh sách cột được phép lọc. Trước đây toàn bộ req.query bị đổ thẳng vào WHERE:
// cột lạ -> 500, và `?users_id=<người khác>` -> đọc được dữ liệu của người khác.
const FILTERABLE = ['name_bride', 'province', 'district', 'commune'];

const getAll = async (query = {}, actor = null) => {
	const { page, limit, offset } = pagination(query);
	// scopeToOwner ghi đè users_id sau cùng -> không tự lọc sang dữ liệu người khác được.
	const filters = scopeToOwner(pickFilters(query, FILTERABLE), actor);

	const orderField = Bride.rawAttributes.created_at
		? 'created_at'
		: (Bride.rawAttributes.create_at ? 'create_at' : null);

	const findOptions = { where: filters, limit, offset };
	if (orderField) {
		findOptions.order = [[orderField, 'DESC']];
	}

	const { count, rows } = await Bride.findAndCountAll(findOptions);
	return {
		items: rows,
		pagination: {
			total: count,
			page,
			limit,
			totalPages: Math.ceil(count / limit)
		}
	};
};

// actor = null: chỉ dùng cho lời gọi nội bộ tin cậy (không đi ra HTTP).
const getById = async (id, actor = undefined) => {
	assertUuid(id, resourceName);
	const item = await Bride.findByPk(id);
	if (!item) {
		const error = new Error(`${resourceName} not found`);
		error.status = 404;
		throw error;
	}
	if (actor !== undefined && actor !== null) assertOwner(item, actor);
	return item;
};

const create = async (payload, userId) => {
	if (!userId) {
		const error = new Error('Thiếu thông tin user từ token');
		error.status = 401;
		throw error;
	}

	const data = { ...payload };
	delete data.id;
	data.id = randomUUID();
	data.users_id = userId;

	if (Bride.rawAttributes.created_at) {
		data.created_at = getNowValue(Bride.rawAttributes.created_at);
	}
	if (Bride.rawAttributes.create_at) {
		data.create_at = getNowValue(Bride.rawAttributes.create_at);
	}
	if (Bride.rawAttributes.updated_at) {
		data.updated_at = getNowValue(Bride.rawAttributes.updated_at);
	}

	return Bride.create(data);
};

const update = async (id, payload, actor) => {
	const userId = actor && typeof actor === 'object' ? actor.id : actor;
	const role = actor && typeof actor === 'object' ? actor.role : undefined;
	if (!userId) {
		const error = new Error('Thiếu thông tin user từ token');
		error.status = 401;
		throw error;
	}

	const item = await getById(id);
	if (role !== 'admin' && (!item.users_id || String(item.users_id) !== String(userId))) {
		const error = new Error('Bạn không có quyền sửa thông tin này');
		error.status = 403;
		throw error;
	}
	const data = { ...payload };
	delete data.id;
	delete data.users_id;

	if (Bride.rawAttributes.updated_at) {
		data.updated_at = getNowValue(Bride.rawAttributes.updated_at);
	}

	await item.update(data);
	return item;
};

// Trước đây xoá không kiểm chủ sở hữu -> bất kỳ ai cũng xoá được dữ liệu người khác.
const remove = async (id, actor) => {
	const item = await getById(id, actor);
	await item.destroy();
	return true;
};

module.exports = { getAll, getById, create, update, remove };
