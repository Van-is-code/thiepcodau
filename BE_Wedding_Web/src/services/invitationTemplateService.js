const { randomUUID } = require('crypto');
const { InvitationTemplate } = require('../models');
const { isUuid } = require('../utils/isUuid');
const templateAccess = require('./templateAccessService');
const { Op } = require('sequelize');
const { pickFilters, pagination } = require('../middlewares/ownership');

const resourceName = 'InvitationTemplate';

const getNowValue = (attribute) => {
	const now = new Date();
	const typeKey = attribute?.type?.key;
	return typeKey === 'STRING' || typeKey === 'TEXT' ? now.toISOString() : now;
};

const FILTERABLE = ['template_code', 'status', 'visibility'];

// Danh sách mẫu mà NGƯỜI ĐANG XEM được phép dùng.
//
// Lọc ngay ở truy vấn chứ không lọc sau khi lấy hết: mẫu độc quyền của khách này
// không được lọt vào kết quả đếm/phân trang của khách khác.
const getAll = async (query = {}, actor = null) => {
	const { page, limit, offset } = pagination(query);
	const filters = pickFilters(query, FILTERABLE);

	const identity = await templateAccess.resolveIdentity(actor);
	const visibilityWhere = await templateAccess.buildVisibilityWhere(identity);

	// Người dùng thường chỉ thấy mẫu đã xuất bản.
	if (identity.role !== 'admin') filters.status = 'published';

	// Reflect.ownKeys chứ KHÔNG dùng Object.keys: điều kiện của Sequelize dùng khoá
	// Symbol (Op.or), mà Object.keys bỏ qua Symbol -> trả về mảng rỗng -> toàn bộ bộ
	// lọc quyền bị âm thầm loại bỏ và mọi người thấy cả mẫu độc quyền của khách khác.
	const where = Reflect.ownKeys(visibilityWhere).length
		? { [Op.and]: [filters, visibilityWhere] }
		: filters;

	const findOptions = {
		where,
		limit,
		offset,
		order: [['sort_order', 'ASC'], ['created_at', 'DESC']],
	};

	const { count, rows } = await InvitationTemplate.findAndCountAll(findOptions);

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

const getById = async (id, actor = undefined) => {
	if (!isUuid(id)) {
		const error = new Error(`${resourceName} not found`);
		error.status = 404;
		throw error;
	}
	// actor === undefined: lời gọi nội bộ tin cậy (không đi ra HTTP).
	if (actor !== undefined) {
		// assertCanUseTemplate trả 404 cho mẫu giới hạn/độc quyền -> không tiết lộ
		// là mẫu có tồn tại hay không.
		return templateAccess.assertCanUseTemplate(id, actor)
			.then(() => InvitationTemplate.findByPk(id));
	}
	const item = await InvitationTemplate.findByPk(id);
	if (!item) {
		const error = new Error(`${resourceName} not found`);
		error.status = 404;
		throw error;
	}
	return item;
};

const create = async (payload) => {
	const data = { ...payload };
	delete data.id;
	data.id = randomUUID();

	if (InvitationTemplate.rawAttributes.created_at) {
		data.created_at = getNowValue(InvitationTemplate.rawAttributes.created_at);
	}
	if (InvitationTemplate.rawAttributes.create_at) {
		data.create_at = getNowValue(InvitationTemplate.rawAttributes.create_at);
	}
	if (InvitationTemplate.rawAttributes.updated_at) {
		data.updated_at = getNowValue(InvitationTemplate.rawAttributes.updated_at);
	}

	return InvitationTemplate.create(data);
};

const update = async (id, payload) => {
	const item = await getById(id);
	const data = { ...payload };
	delete data.id;

	if (InvitationTemplate.rawAttributes.updated_at) {
		data.updated_at = getNowValue(InvitationTemplate.rawAttributes.updated_at);
	}

	await item.update(data);
	return item;
};

const remove = async (id) => {
	const item = await getById(id);
	await item.destroy();
	return true;
};

module.exports = {
	getAll,
	getById,
	create,
	update,
	remove
};
