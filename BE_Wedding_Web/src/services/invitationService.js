const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const { Invitation, InvitationTemplate, Groom, Bride, InvitationImage, MessageCheckin, User, Customer, CtvProfile, PrivateInvitation, Guest } = require('../models');
const { isUuid } = require('../utils/isUuid');
const { computeEditDeadline, getLockState, lockMessage } = require('../utils/editLock');
const entitlementService = require('./entitlementService');
const templateAccess = require('./templateAccessService');
const catalog = require('./themeConverter/fieldCatalog');
const { pickFilters, pagination } = require('../middlewares/ownership');

const resourceName = 'Invitation';

// Cache nhẹ: user_id -> customer (null nếu không phải khách của CTV). Sống trong 1 request.
const findCustomerByUserId = (userId) => Customer.findOne({ where: { user_id: userId } });

// CTV được thao tác thiệp của khách thuộc quyền quản lý của mình.
const ctvOwnsInvitationOwner = async (actor, ownerUserId) => {
  if (!actor || actor.role !== 'ctv' || !actor.id) return false;
  const [ctvProfile, customer] = await Promise.all([
    CtvProfile.findOne({ where: { user_id: actor.id } }),
    findCustomerByUserId(ownerUserId)
  ]);
  if (!ctvProfile || ctvProfile.status !== 'active') return false;
  return Boolean(customer && String(customer.ctv_id) === String(ctvProfile.id));
};

// Quyền xem/sửa 1 thiệp: admin | chủ thiệp | CTV sở hữu khách.
const ensureCanAccess = async (invitation, actor) => {
  if (isAdmin(actor)) return;
  if (actor && actor.id && String(invitation.users_id) === String(actor.id)) return;
  if (await ctvOwnsInvitationOwner(actor, invitation.users_id)) return;
  const error = new Error('Bạn không có quyền với thiệp này');
  error.status = 403;
  throw error;
};

// Khách của CTV phải ở trạng thái ACTIVE (đã thanh toán) mới được tạo/sửa thiệp.
// Áp cho cả chủ thiệp lẫn CTV; admin bỏ qua.
const ensureCustomerActivated = async (ownerUserId, actor) => {
  if (isAdmin(actor)) return;
  const customer = await findCustomerByUserId(ownerUserId);
  if (!customer) return; // tài khoản tự phục vụ (legacy) — không ràng buộc
  if (customer.status !== 'active') {
    const error = new Error('Tài khoản khách chưa kích hoạt. Vui lòng hoàn tất thanh toán để dùng dịch vụ.');
    error.status = 403;
    error.customerStatus = customer.status;
    throw error;
  }
};

const getNowValue = (attribute) => {
	const now = new Date();
	const typeKey = attribute?.type?.key;
	return typeKey === 'STRING' || typeKey === 'TEXT' ? now.toISOString() : now;
};

const isAdmin = (actor) => actor && actor.role === 'admin';

// Gắn thêm trạng thái khoá vào 1 bản ghi thiệp (dạng plain object trả cho FE).
const withLockState = (invitation) => {
	if (!invitation) return invitation;
	const plain = typeof invitation.toJSON === 'function' ? invitation.toJSON() : invitation;
	plain.lock_state = getLockState(plain);
	return plain;
};

const ensureOwnerOrAdmin = (invitation, actor) => {
	if (isAdmin(actor)) return;
	if (!actor || !actor.id || String(invitation.users_id) !== String(actor.id)) {
		const error = new Error('Bạn không có quyền với thiệp này');
		error.status = 403;
		throw error;
	}
};

const ensureNotLocked = (invitation, actor) => {
	if (isAdmin(actor)) return; // admin sửa được cả thiệp đã khoá
	const state = getLockState(invitation);
	if (state.locked) {
		const error = new Error(lockMessage(state));
		error.status = 423; // Locked
		error.lockState = state;
		throw error;
	}
};

// Cột được phép lọc từ query. Cột lạ bị loại thay vì đổ thẳng vào WHERE —
// trước đây `?cot_la=1` làm Postgres ném lỗi và request trả 500.
const INVITATION_FILTERABLE = ['invitation_slug', 'template_id', 'groom_id', 'bride_id'];

const getAll = async (query = {}, actor = null) => {
	// pagination() chặn `?limit=999999` (trần 100) — trước đây kéo được cả bảng
	// trong 1 request.
	const { page, limit, offset } = pagination(query);

	const filters = pickFilters(query, INVITATION_FILTERABLE);

	// Người dùng thường chỉ thấy thiệp của mình. Admin thấy tất cả (có thể lọc users_id).
	if (!isAdmin(actor)) {
		if (!actor || !actor.id) {
			const error = new Error('Thiếu thông tin user từ token');
			error.status = 401;
			throw error;
		}
		// Ghi đè sau cùng -> client không tự lọc sang dữ liệu người khác được.
		filters.users_id = actor.id;
	} else if (query.users_id) {
		filters.users_id = query.users_id;
	}

	const orderField = Invitation.rawAttributes.created_at ? 'created_at' : null;

	const findOptions = { where: filters, limit, offset };
	findOptions.include = [
		{ model: InvitationImage, as: 'images', required: false },
		{ model: Groom, as: 'groom', required: false },
		{ model: Bride, as: 'bride', required: false }
	];
	if (isAdmin(actor)) {
		findOptions.include.push({ model: User, as: 'user', attributes: ['id', 'username', 'role'], required: false });
	}
	findOptions.distinct = true;
	if (orderField) {
		findOptions.order = [[orderField, 'DESC']];
	}

	const { count, rows } = await Invitation.findAndCountAll(findOptions);
	return {
		items: rows.map(withLockState),
		pagination: {
			total: count,
			page,
			limit,
			totalPages: Math.ceil(count / limit)
		}
	};
};

const findRaw = async (id) => {
	if (!isUuid(id)) {
		const error = new Error(`${resourceName} not found`);
		error.status = 404;
		throw error;
	}
	const item = await Invitation.findOne({
		where: { id },
		include: [
			// Kèm cấu hình quyền sửa để trình soạn thiệp biết ô nào cho bấm.
			{
				model: InvitationTemplate, as: 'template', required: false,
				attributes: ['id', 'template_code', 'template_name', 'html_path', 'schema',
					'editable_fields', 'image_slot_rules', 'has_music_box', 'manifest'],
			},
			{ model: Groom, as: 'groom', required: false },
			{ model: Bride, as: 'bride', required: false },
			{ model: InvitationImage, as: 'images', required: false }
		]
	});
	if (!item) {
		const error = new Error(`${resourceName} not found`);
		error.status = 404;
		throw error;
	}
	return item;
};

// Giữ chữ ký cũ (chỉ id) cho các chỗ gọi nội bộ; thêm actor để kiểm quyền khi có.
const getById = async (id, actor = null) => {
	const item = await findRaw(id);
	if (actor !== null) await ensureCanAccess(item, actor);
	return actor === null ? item : withLockState(item);
};

// Cột của groom/bride mà TRANG CÔNG KHAI được phép thấy.
// Cố ý BỎ users_id, created_at/updated_at và mọi khoá nội bộ. Thông tin ngân hàng
// VẪN giữ vì thiệp có tính năng "mừng cưới" cần hiện số tài khoản cho khách.
const PUBLIC_PERSON_FIELDS = [
	'id', 'name_groom', 'name_bride', 'father_grom', 'father_bride',
	'mother_groom', 'mother_bride', 'province', 'district', 'commune', 'address',
	'bank_name', 'bank_account_name', 'bank_account_number'
];

// Lọc theo cột thật sự tồn tại trên model (groom và bride không cùng bộ cột).
const publicPersonAttrs = (model) => PUBLIC_PERSON_FIELDS.filter((f) => model.rawAttributes[f]);

// Cột của chính thiệp mà khách mời được thấy. Không trả users_id, edit_count,
// edit_deadline — đó là dữ liệu vận hành nội bộ, lộ ra chỉ giúp dò tài khoản chủ thiệp.
const PUBLIC_INVITATION_FIELDS = [
	'id', 'template_id', 'invitation_slug', 'title_vi', 'title_en',
	'groom_id', 'bride_id', 'ceremony_date', 'ceremony_lunar_text',
	'reception_date', 'reception_lunar_text', 'venue_address', 'map_url',
	'reception_venue_address', 'reception_map_url', 'thank_you_message',
	'extra_notes', 'music_url', 'extra_data'
];

const getBySlug = async (invitationSlug) => {
	// Route CÔNG KHAI — ai cũng gọi được, nên chỉ trả đúng những cột cần để dựng thiệp.
	// Trước đây trả về nguyên bản ghi kèm users_id, edit_count, edit_deadline...
	const item = await Invitation.findOne({
		where: { invitation_slug: String(invitationSlug || '').slice(0, 120) },
		attributes: PUBLIC_INVITATION_FIELDS.filter((f) => Invitation.rawAttributes[f]),
		include: [
			{
				model: InvitationTemplate, as: 'template', required: false,
				attributes: ['id', 'template_code', 'template_name', 'html_path', 'schema', 'has_music_box', 'manifest', 'thumbnail_url']
			},
			{ model: Groom, as: 'groom', required: false, attributes: publicPersonAttrs(Groom) },
			{ model: Bride, as: 'bride', required: false, attributes: publicPersonAttrs(Bride) },
			{
				model: InvitationImage, as: 'images', required: false,
				// Kèm đủ dữ liệu để FE dựng <picture> (nhiều cỡ + ảnh nhoè) mà không cần
				// gọi thêm API nào — xem invitationImageService.publicImage().
				attributes: [
					'id', 'image_url', 'image_alt', 'image_type', 'sort_order', 'is_cover',
					'width', 'height', 'blur_data_url', 'dominant_color', 'variants'
				]
			},
			{
				model: MessageCheckin, as: 'messagesCheckins', required: false,
				attributes: ['id', 'name_guest', 'messages', 'created_at', 'confirm_attendance']
			}
		],
		order: [
			[{ model: InvitationImage, as: 'images' }, 'sort_order', 'ASC'],
			[{ model: MessageCheckin, as: 'messagesCheckins' }, 'created_at', 'DESC']
		]
	});

	if (!item) {
		const error = new Error(`${resourceName} not found`);
		error.status = 404;
		throw error;
	}

	const resObj = typeof item.toJSON === 'function' ? item.toJSON() : { ...item };
	if (resObj.messagesCheckins) {
		resObj.wishes = resObj.messagesCheckins
			.filter((m) => m.messages && String(m.messages).trim())
			.map((m) => ({
				id: m.id,
				name: m.name_guest,
				message: m.messages,
				attending: m.confirm_attendance,
				date: m.created_at
			}))
			.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
	} else {
		resObj.wishes = [];
	}

	return resObj;
};

const validateForeignKeys = async (payload, actor) => {
	if (payload.template_id) {
		// actor được truyền xuống để kiểm cả QUYỀN dùng mẫu, không chỉ sự tồn tại.
		if (actor !== undefined) {
			await templateAccess.assertCanUseTemplate(payload.template_id, actor);
		} else {
			const template = await InvitationTemplate.findByPk(payload.template_id);
			if (!template) {
				const error = new Error('template_id không tồn tại');
				error.status = 400;
				throw error;
			}
		}
	}
	if (payload.groom_id) {
		const groom = await Groom.findByPk(payload.groom_id);
		if (!groom) {
			const error = new Error('groom_id không tồn tại');
			error.status = 400;
			throw error;
		}
	}
	if (payload.bride_id) {
		const bride = await Bride.findByPk(payload.bride_id);
		if (!bride) {
			const error = new Error('bride_id không tồn tại');
			error.status = 400;
			throw error;
		}
	}
};

const getRandomDefaultMusicUrl = () => {
	const musicFolder = path.join(process.cwd(), 'media', 'music');
	if (!fs.existsSync(musicFolder)) {
		const error = new Error('Không tìm thấy thư mục media/music cho nhạc mặc định');
		error.status = 500;
		throw error;
	}

	const allowedExt = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac']);
	const files = fs
		.readdirSync(musicFolder)
		.filter((name) => {
			const fullPath = path.join(musicFolder, name);
			const ext = path.extname(name).toLowerCase();
			return fs.statSync(fullPath).isFile() && allowedExt.has(ext);
		});

	if (files.length === 0) {
		const error = new Error('Không có file nhạc mặc định trong media/music');
		error.status = 500;
		throw error;
	}

	const randomIndex = Math.floor(Math.random() * files.length);
	return `/media/music/${files[randomIndex]}`;
};

// Trừ ĐÚNG 1 lượt tạo thiệp, nguyên tử, trong cùng transaction với việc tạo thiệp.
//
// Lỗi cũ (đã đo được bằng thử nghiệm thật): việc kiểm "còn lượt không" nằm ở một
// truy vấn riêng, tạo thiệp ở truy vấn thứ hai, trừ lượt ở truy vấn thứ ba — cả ba
// đều KHÔNG nằm trong transaction. Bắn 12 request tạo thiệp song song với tài khoản
// còn 5 lượt thì cả 12 đều đọc thấy "còn lượt" trước khi có ai kịp trừ, kết quả là
// 12 thiệp được tạo và users.slot tụt xuống -7.
//
// Nay: tạo thiệp và trừ lượt nằm chung 1 transaction, việc trừ dùng khoá dòng
// (khách của CTV) hoặc UPDATE có điều kiện slot > 0 (tài khoản tự phục vụ). Hết lượt
// -> ném lỗi -> transaction rollback -> thiệp vừa tạo cũng biến mất.
const consumeSlot = async ({ customer, userId, userRole, invitationId }, transaction) => {
	if (userRole === 'admin') return;
	if (customer) {
		await entitlementService.debitForCardCreation(
			customer.id,
			{ invitationId },
			{ transaction }
		);
		return;
	}
	await entitlementService.debitUserSlot(userId, { transaction });
};

const create = async (payload, userId) => {
	if (!userId) {
		const error = new Error('Thiếu thông tin user từ token');
		error.status = 401;
		throw error;
	}

	const user = await User.findByPk(userId);
	if (!user) {
		const error = new Error('User không tồn tại');
		error.status = 404;
		throw error;
	}

	// Khách của CTV: phải ACTIVE. Kiểm tra "còn lượt" KHÔNG làm ở đây nữa — xem ghi chú
	// về điều kiện tranh chấp trong consumeSlot() bên dưới.
	const customer = await findCustomerByUserId(userId);
	if (customer && customer.status !== 'active') {
		const error = new Error('Tài khoản khách chưa kích hoạt. Vui lòng hoàn tất thanh toán để dùng dịch vụ.');
		error.status = 403;
		throw error;
	}

	const data = { ...payload };
	delete data.id;
	data.id = randomUUID();
	data.users_id = userId;
	data.music_url = getRandomDefaultMusicUrl();

	await validateForeignKeys(data, { id: userId, role: user.role || 'user' });

	if (Invitation.rawAttributes.created_at) {
		data.created_at = getNowValue(Invitation.rawAttributes.created_at);
	}
	if (Invitation.rawAttributes.updated_at) {
		data.updated_at = getNowValue(Invitation.rawAttributes.updated_at);
	}

	return sequelize.transaction(async (transaction) => {
		const invitation = await Invitation.create(data, { transaction });
		await consumeSlot({ customer, userId, userRole: user.role, invitationId: invitation.id }, transaction);
		return invitation;
	});
};

// Lọc bỏ những trường mà MẪU không cho khách sửa.
//
// Giao diện đã chặn không cho bấm, nhưng đó chỉ là lớp tiện dụng — người dùng vẫn
// gửi thẳng payload qua API được. Đây mới là chốt chặn thật.
//
// Trả về { data, blocked } để còn báo lại cho người dùng biết vì sao có ô không lưu.
const stripLockedFields = async (invitation, data, actor) => {
  if (isAdmin(actor)) return { data, blocked: [] }; // admin sửa được mọi thứ

  const template = invitation.template_id
    ? await InvitationTemplate.findByPk(invitation.template_id, { attributes: ['editable_fields'] })
    : null;
  const allowed = new Set(catalog.resolveEditable(template ? template.editable_fields : null));

  const out = { ...data };
  const blocked = [];

  // Cột thật của bảng invitations
  for (const key of Object.keys(out)) {
    if (key === 'extra_data') continue;
    if (!catalog.isKnownField(key)) continue; // cột nội bộ, không phải ô hiển thị
    if (!allowed.has(key)) { delete out[key]; blocked.push(key); }
  }

  // Trường riêng của mẫu nằm trong extra_data
  if (out.extra_data && typeof out.extra_data === 'object') {
    const extra = { ...out.extra_data };
    for (const key of Object.keys(extra)) {
      // Khoá không có trong danh mục (vd. bank, music_playlist) là dữ liệu hệ thống,
      // đi qua đường riêng — không đụng vào.
      if (!catalog.isKnownField(key)) continue;
      if (!allowed.has(key)) { delete extra[key]; blocked.push(key); }
    }
    out.extra_data = extra;
  }

  return { data: out, blocked };
};

const KEY_IGNORE = new Set(['id', 'updated_at', 'created_at', 'users_id', 'edit_count', 'edit_deadline', 'lock_state']);

// Cập nhật thiệp. options.countAsEdit = có tính vào hạn mức "5 lượt sửa" không.
const update = async (id, payload, actor, options = {}) => {
	const { countAsEdit = true } = options;
	const item = await findRaw(id);
	await ensureCanAccess(item, actor);
	await ensureCustomerActivated(item.users_id, actor);
	ensureNotLocked(item, actor);

	let data = { ...payload };
	KEY_IGNORE.forEach((k) => delete data[k]);

	// Bỏ những ô mẫu không cho khách sửa (chốt chặn thật, không dựa vào giao diện).
	const filtered = await stripLockedFields(item, data, actor);
	data = filtered.data;

	await validateForeignKeys(data, actor);

	// Neo hạn sửa vào ngày cưới GỐC: chỉ set 1 lần, khi user đổi ngày cưới lần đầu.
	if (!item.edit_deadline && data.ceremony_date) {
		const changed = new Date(data.ceremony_date).getTime() !== new Date(item.ceremony_date).getTime();
		if (changed) {
			item.edit_deadline = computeEditDeadline(data.ceremony_date);
		}
	}

	if (countAsEdit && !isAdmin(actor)) {
		item.edit_count = (item.edit_count || 0) + 1;
	}

	if (Invitation.rawAttributes.updated_at) {
		data.updated_at = getNowValue(Invitation.rawAttributes.updated_at);
	}

	Object.assign(item, data);
	await item.save();

	const result = withLockState(await findRaw(id));
	if (filtered.blocked.length) result.blocked_fields = filtered.blocked;
	return result;
};

// Lưu 1 lượt từ trình sửa: gộp invitation + groom + bride, tính 1 lượt sửa.
const editorSave = async (id, body, actor) => {
	const { invitation: invPatch = {}, groom: groomPatch = {}, bride: bridePatch = {} } = body || {};
	const item = await findRaw(id);
	await ensureCanAccess(item, actor);
	await ensureCustomerActivated(item.users_id, actor);
	ensureNotLocked(item, actor);

	let invData = { ...invPatch };
	KEY_IGNORE.forEach((k) => delete invData[k]);
	delete invData.template_id; // đổi mẫu đi đường riêng, không qua đây

	const filtered = await stripLockedFields(item, invData, actor);
	invData = filtered.data;

	await validateForeignKeys(invData, actor);

	if (!item.edit_deadline && invData.ceremony_date) {
		const changed = new Date(invData.ceremony_date).getTime() !== new Date(item.ceremony_date).getTime();
		if (changed) item.edit_deadline = computeEditDeadline(invData.ceremony_date);
	}

	if (!isAdmin(actor)) {
		item.edit_count = (item.edit_count || 0) + 1;
	}
	if (Invitation.rawAttributes.updated_at) {
		invData.updated_at = getNowValue(Invitation.rawAttributes.updated_at);
	}
	Object.assign(item, invData);

	// Gộp 3 bản ghi vào 1 transaction: nếu groom/bride lỗi thì KHÔNG trừ lượt sửa.
	await sequelize.transaction(async (transaction) => {
		await item.save({ transaction });

		if (groomPatch && Object.keys(groomPatch).length && item.groom_id) {
			const groom = await Groom.findByPk(item.groom_id, { transaction });
			if (groom) {
				const g = { ...groomPatch };
				delete g.id; delete g.users_id; delete g.created_at; delete g.create_at; delete g.updated_at;
				// getNowValue: cột updated_at của groom là DATE -> trả Date; nếu là STRING -> trả ISO string.
				if (Groom.rawAttributes.updated_at) g.updated_at = getNowValue(Groom.rawAttributes.updated_at);
				await groom.update(g, { transaction });
			}
		}
		if (bridePatch && Object.keys(bridePatch).length && item.bride_id) {
			const bride = await Bride.findByPk(item.bride_id, { transaction });
			if (bride) {
				const b = { ...bridePatch };
				delete b.id; delete b.users_id; delete b.created_at; delete b.create_at; delete b.updated_at;
				// bride.updated_at là cột VARCHAR -> phải ghi chuỗi ISO, không ghi Date object.
				if (Bride.rawAttributes.updated_at) b.updated_at = getNowValue(Bride.rawAttributes.updated_at);
				await bride.update(b, { transaction });
			}
		}
	});

	const saved = withLockState(await findRaw(id));
	if (filtered.blocked.length) saved.blocked_fields = filtered.blocked;
	return saved;
};

// Cập nhật nhạc nền: 1 hoặc nhiều link. Không tính vào hạn mức sửa, vẫn chặn khi khoá.
// Nhạc do NGƯỜI DÙNG tải lên nằm ở /uploads/music/<user_id>/. Bộ lọc phía trên
// chỉ xem đường dẫn có bắt đầu bằng /uploads/ hay không, nên nếu dừng ở đó thì
// dán thẳng đường dẫn nhạc của người khác vào là nghe được — nhạc riêng của họ
// bị lộ. Ở đây chốt lại: chỉ nhận thư mục nhạc của CHÍNH chủ thiệp.
//
// Nhạc kho chung (/media/music/...) và link ngoài không đi qua luật này.
const assertOwnMusic = (playlist, usersId) => {
	const thuMucCuaChu = '/uploads/music/' + usersId + '/';
	const lac = (playlist || []).filter(
		(u) => /^\/uploads\/music\//i.test(String(u)) && !String(u).startsWith(thuMucCuaChu)
	);
	if (lac.length) {
		const e = new Error('Có bản nhạc không thuộc tài khoản này'); e.status = 403; throw e;
	}
	return playlist;
};

const setMusic = async (id, body, actor) => {
	const item = await findRaw(id);
	await ensureCanAccess(item, actor);
	await ensureCustomerActivated(item.users_id, actor);
	ensureNotLocked(item, actor);

	// Nhận cả dạng payload phẳng lẫn payload lồng nhau do client truyền
	const nested = (body?.music_playlist && typeof body.music_playlist === 'object' && !Array.isArray(body.music_playlist))
		? body.music_playlist
		: null;
	const rawPayload = nested ? { ...body, ...nested } : (body || {});

	let rawList = null;
	if (Array.isArray(rawPayload.music_playlist)) {
		rawList = rawPayload.music_playlist;
	} else if (Array.isArray(rawPayload.playlist)) {
		rawList = rawPayload.playlist;
	} else if (Array.isArray(body?.music_playlist)) {
		rawList = body.music_playlist;
	} else if (Array.isArray(body?.playlist)) {
		rawList = body.playlist;
	}

	let playlist = [];
	if (rawList !== null) {
		playlist = rawList
			.map((u) => String(u || '').trim())
			.filter((u) => /^(https?:\/\/|\/media\/|\/uploads\/)/i.test(u));
	} else {
		const currentPlaylist = Array.isArray(item.extra_data?.music_playlist) ? item.extra_data.music_playlist : [];
		playlist = currentPlaylist.length ? currentPlaylist : (item.music_url ? [item.music_url] : []);
	}

	assertOwnMusic(playlist, item.users_id);

	// Mẫu thiệp có hộp nhạc không
	const mau = item.template_id
		? await InvitationTemplate.findByPk(item.template_id, { attributes: ['has_music_box', 'manifest'] })
		: null;
	const coHopNhac = mau
		? (mau.has_music_box != null ? Boolean(mau.has_music_box) : Boolean(mau.manifest && mau.manifest.has_music_box))
		: true;

	let primary = '';
	if (playlist.length > 0) {
		primary = playlist[0];
	} else if (rawList === null) {
		primary = item.music_url || '';
	} else if (coHopNhac) {
		try { primary = getRandomDefaultMusicUrl(); } catch (_e) { primary = ''; }
		if (primary) playlist = [primary];
	}

	let voiceUrl = rawPayload.voice_url !== undefined
		? (rawPayload.voice_url ? String(rawPayload.voice_url).trim() : null)
		: (item.extra_data?.music_settings?.voice_url || null);
	if (voiceUrl && /^\/uploads\/music\//i.test(voiceUrl)) {
		assertOwnMusic([voiceUrl], item.users_id);
	}

	const musicSettings = {
		music_volume: typeof rawPayload.music_volume === 'number' ? Math.max(0, Math.min(100, Math.round(rawPayload.music_volume))) : (item.extra_data?.music_settings?.music_volume ?? 80),
		voice_url: voiceUrl || null,
		voice_volume: typeof rawPayload.voice_volume === 'number' ? Math.max(0, Math.min(100, Math.round(rawPayload.voice_volume))) : (item.extra_data?.music_settings?.voice_volume ?? 100),
		duck_music: rawPayload.duck_music !== undefined ? Boolean(rawPayload.duck_music) : (item.extra_data?.music_settings?.duck_music ?? true),
	};

	const extra = {
		...(item.extra_data || {}),
		music_playlist: playlist,
		music_settings: musicSettings,
	};
	item.extra_data = extra;
	item.music_url = primary || '';
	if (Invitation.rawAttributes.updated_at) item.updated_at = new Date();
	await item.save();
	return withLockState(await findRaw(id));
};

// Lưu thông tin tài khoản ngân hàng mừng cưới (hỗ trợ cả 2 bên cô dâu - chú rể và chọn chế độ hiển thị).
// Không tính vào hạn mức sửa; vẫn chặn khi thiệp đã khoá.
const setBank = async (id, body, actor) => {
	const item = await findRaw(id);
	await ensureCanAccess(item, actor);
	await ensureCustomerActivated(item.users_id, actor);
	ensureNotLocked(item, actor);

	const bank = {
		display_mode: body?.display_mode || 'both',
		groom: body?.groom ? {
			bank_name: String(body.groom.bank_name || '').trim(),
			bank_short_name: String(body.groom.bank_short_name || '').trim(),
			bank_account_number: String(body.groom.bank_account_number || '').trim(),
			bank_account_name: String(body.groom.bank_account_name || '').trim(),
			qr_content: String(body.groom.qr_content || '').trim(),
			qr_image: String(body.groom.qr_image || ''),
		} : null,
		bride: body?.bride ? {
			bank_name: String(body.bride.bank_name || '').trim(),
			bank_short_name: String(body.bride.bank_short_name || '').trim(),
			bank_account_number: String(body.bride.bank_account_number || '').trim(),
			bank_account_name: String(body.bride.bank_account_name || '').trim(),
			qr_content: String(body.bride.qr_content || '').trim(),
			qr_image: String(body.bride.qr_image || ''),
		} : null,
		bank_name: String(body?.bank_name || '').trim(),
		bank_short_name: String(body?.bank_short_name || '').trim(),
		bank_account_number: String(body?.bank_account_number || '').trim(),
		bank_account_name: String(body?.bank_account_name || '').trim(),
		qr_content: String(body?.qr_content || '').trim()
	};

	item.extra_data = { ...(item.extra_data || {}), bank };
	if (Invitation.rawAttributes.updated_at) item.updated_at = new Date();
	await item.save();

	// Đồng bộ thông tin ngân hàng sang bảng Groom / Bride nếu có
	if (item.groom_id && bank.groom) {
		const groom = await Groom.findByPk(item.groom_id);
		if (groom) {
			if (bank.groom.bank_name) groom.bank_name = bank.groom.bank_name;
			if (bank.groom.bank_account_name) groom.bank_account_name = bank.groom.bank_account_name;
			if (bank.groom.bank_account_number) groom.bank_account_number = bank.groom.bank_account_number;
			await groom.save();
		}
	}
	if (item.bride_id && bank.bride) {
		const bride = await Bride.findByPk(item.bride_id);
		if (bride) {
			if (bank.bride.bank_name) bride.bank_name = bank.bride.bank_name;
			if (bank.bride.bank_account_name) bride.bank_account_name = bank.bride.bank_account_name;
			if (bank.bride.bank_account_number) bride.bank_account_number = bank.bride.bank_account_number;
			await bride.save();
		}
	}

	return withLockState(await findRaw(id));
};

// Đổi mẫu: không giới hạn số lần, nhưng vẫn chặn khi thiệp đã khoá.
const changeTemplate = async (id, templateId, actor) => {
	if (!templateId || !isUuid(templateId)) {
		const error = new Error('template_id không hợp lệ');
		error.status = 400;
		throw error;
	}
	const item = await findRaw(id);
	await ensureCanAccess(item, actor);
	await ensureCustomerActivated(item.users_id, actor);
	ensureNotLocked(item, actor);

	// CHỐT CHẶN: chỉ lọc ở danh sách là chưa đủ — người dùng vẫn gửi thẳng id của
	// mẫu độc quyền/giới hạn để gán vào thiệp mình. Phải kiểm ở đúng chỗ GÁN.
	await templateAccess.assertCanUseTemplate(templateId, actor);

	item.template_id = templateId;
	if (Invitation.rawAttributes.updated_at) item.updated_at = new Date();
	await item.save();
	return withLockState(await findRaw(id));
};

const remove = async (id, actor) => {
	const item = await findRaw(id);
	await ensureCanAccess(item, actor);
	await item.destroy();
	return true;
};

const generateSlug = () => `thiep-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// opts.chargeSlot = false khi admin tạo thiệp HỘ khách (không trừ lượt của khách).
const createDraft = async (templateId, userId, opts = {}) => {
	const { chargeSlot = true } = opts;
	if (!userId) {
		const error = new Error('Thiếu thông tin user');
		error.status = 401;
		throw error;
	}

	if (!templateId || !isUuid(templateId)) {
		const error = new Error('template_id không hợp lệ');
		error.status = 400;
		throw error;
	}

	const user = await User.findByPk(userId);
	if (!user) {
		const error = new Error('User không tồn tại');
		error.status = 404;
		throw error;
	}

	// chargeSlot=false: admin tạo hộ khách — không trừ lượt của khách.
	const customer = chargeSlot ? await findCustomerByUserId(userId) : null;
	if (chargeSlot && customer && customer.status !== 'active') {
		const error = new Error('Tài khoản khách chưa kích hoạt. Vui lòng hoàn tất thanh toán để dùng dịch vụ.');
		error.status = 403;
		throw error;
	}

	// Cùng chốt chặn như changeTemplate. opts.actor có thì dùng, không thì suy từ userId
	// (admin tạo hộ khách -> truyền actor admin vào).
	await templateAccess.assertCanUseTemplate(templateId, opts.actor || { id: userId, role: opts.actorRole || 'user' });

	const now = new Date();

	// Toàn bộ (groom + bride + invitation + trừ lượt) nằm trong 1 transaction: bất kỳ
	// bước nào hỏng thì không còn bản ghi mồ côi, và hết lượt thì không tạo được thiệp.
	const invitationId = await sequelize.transaction(async (transaction) => {
	const groom = await Groom.create({
		id: randomUUID(),
		users_id: userId,
		name_groom: 'Chú rể',
		father_grom: '', mother_groom: '',
		province: '', district: '', commune: '', address: '',
		bank_name: '', bank_account_name: '', bank_account_number: '',
		create_at: now
	}, { transaction });

	const bride = await Bride.create({
		id: randomUUID(),
		users_id: userId,
		name_bride: 'Cô dâu',
		father_bride: '', mother_bride: '',
		province: '', district: '', commune: '', address: '',
		bank_name: '', bank_account_name: '', bank_account_number: '',
		created_at: now
	}, { transaction });

	const ceremonyDate = new Date(now);
	ceremonyDate.setDate(ceremonyDate.getDate() + 30);
	const receptionDate = new Date(now);
	receptionDate.setDate(receptionDate.getDate() + 30);

	let initialSlug = generateSlug();
	let isCustomSlug = false;
	if (opts.slug || opts.desiredSlug) {
		const rawSlug = String(opts.slug || opts.desiredSlug).trim();
		const formatCheck = validateSlugFormat(rawSlug);
		if (formatCheck.valid) {
			const collision = await Invitation.findOne({ where: { invitation_slug: formatCheck.slug }, attributes: ['id'] });
			if (!collision && !RESERVED_SLUGS.has(formatCheck.slug)) {
				initialSlug = formatCheck.slug;
				isCustomSlug = true;
			}
		}
	}

	const invitation = await Invitation.create({
		id: randomUUID(),
		users_id: userId,
		template_id: templateId,
		invitation_slug: initialSlug,
		title_vi: 'Thiệp cưới của chúng tôi',
		title_en: 'Our Wedding',
		groom_id: groom.id,
		bride_id: bride.id,
		ceremony_date: ceremonyDate,
		ceremony_lunar_text: '',
		reception_date: receptionDate.toISOString().slice(0, 10),
		reception_lunar_text: '',
		venue_address: '',
		map_url: '',
		reception_venue_address: '',
		reception_map_url: '',
		thank_you_message: 'Sự hiện diện của quý khách là niềm hạnh phúc của chúng tôi. Xin chân thành cảm ơn!',
		extra_notes: '',
		music_url: getRandomDefaultMusicUrl(),
		extra_data: isCustomSlug ? { slug_customized: true } : {},
		edit_count: 0,
		edit_deadline: null,
		created_at: getNowValue(Invitation.rawAttributes.created_at),
		updated_at: getNowValue(Invitation.rawAttributes.updated_at)
	}, { transaction });

	if (chargeSlot) {
		await consumeSlot({ customer, userId, invitationId: invitation.id }, transaction);
	}

		return invitation.id;
	});

	return withLockState(await findRaw(invitationId));
};


const RESERVED_SLUGS = new Set(['login', 'register', 'dashboard', 'admin', 'api', 'editor', 'templates', 'assets', 'uploads', 'favicon.ico', 'g', 'm', 'k', 'invite', 'invitations', 'auth']);

const validateSlugFormat = (rawInput) => {
	const str = String(rawInput ?? '').trim();
	if (!str) {
		return { valid: false, error: 'Đường dẫn không được để trống' };
	}

	// 1. Kiểm tra ký tự có dấu tiếng Việt
	const vietnameseAccentsRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
	if (vietnameseAccentsRegex.test(str)) {
		return {
			valid: false,
			error: 'Đường dẫn không được chứa ký tự có dấu tiếng Việt (ví dụ: "đ", "á", "ê"...). Vui lòng nhập không dấu (VD: dangchien-minhhang).'
		};
	}

	// 2. Kiểm tra khoảng trắng
	if (/\s/.test(str)) {
		return {
			valid: false,
			error: 'Đường dẫn không được chứa khoảng trắng. Vui lòng dùng dấu gạch ngang (-) để phân cách.'
		};
	}

	// 3. Kiểm tra chữ hoa
	if (/[A-Z]/.test(str)) {
		return {
			valid: false,
			error: 'Đường dẫn không được chứa chữ hoa. Vui lòng chỉ dùng chữ thường (a-z).'
		};
	}

	// 4. Kiểm tra ký tự đặc biệt (chỉ cho phép a-z, 0-9, -)
	if (/[^a-z0-9-]/.test(str)) {
		return {
			valid: false,
			error: 'Đường dẫn chỉ được chứa chữ thường không dấu (a-z), số (0-9) và dấu gạch ngang (-). Không dùng ký tự đặc biệt (@, _, ., /,...).'
		};
	}

	// 5. Độ dài
	if (str.length < 3) {
		return {
			valid: false,
			error: 'Đường dẫn phải có ít nhất 3 ký tự.'
		};
	}
	if (str.length > 60) {
		return {
			valid: false,
			error: 'Đường dẫn không được vượt quá 60 ký tự.'
		};
	}

	// 6. Gạch ngang đầu hoặc cuối
	if (str.startsWith('-') || str.endsWith('-')) {
		return {
			valid: false,
			error: 'Đường dẫn không được bắt đầu hoặc kết thúc bằng dấu gạch ngang (-).'
		};
	}

	// 7. Gạch ngang liên tiếp --
	if (/--+/.test(str)) {
		return {
			valid: false,
			error: 'Đường dẫn không được chứa các dấu gạch ngang liền nhau (--).'
		};
	}

	return { valid: true, error: null, slug: str };
};

const removeDiacriticsVi = (str) => {
	return String(str || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D');
};

const cleanSlug = (str) => {
	return removeDiacriticsVi(str)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 100);
};

const checkSlugAvailability = async (invitationId, desiredSlug, actor) => {
	if (invitationId && invitationId !== 'new') {
		const item = await findRaw(invitationId);
		await ensureCanAccess(item, actor);
	}

	// Kiểm tra định dạng trước
	const formatCheck = validateSlugFormat(desiredSlug);
	if (!formatCheck.valid) {
		return {
			available: false,
			format_error: true,
			slug: desiredSlug,
			suggested: null,
			message: formatCheck.error
		};
	}

	const slug = formatCheck.slug;

	// Kiểm tra nếu trùng từ khoá hệ thống
	const isReserved = RESERVED_SLUGS.has(slug);

	// Kiểm tra trùng trong DB với thiệp khác
	const whereCond = { invitation_slug: slug };
	if (invitationId && invitationId !== 'new') {
		whereCond.id = { [Op.ne]: invitationId };
	}
	const existing = await Invitation.findOne({
		where: whereCond,
		attributes: ['id', 'invitation_slug']
	});

	if (!existing && !isReserved) {
		return {
			available: true,
			format_error: false,
			slug,
			suggested: null,
			message: 'Đường dẫn hợp lệ và có thể sử dụng!'
		};
	}

	// Đã bị trùng -> Tự động tìm đuôi phân biệt khả dụng
	const currentYear = new Date().getFullYear();
	const candidates = [
		`${slug}-${currentYear}`,
		`${slug}-wedding`,
		`${slug}-1`,
		`${slug}-2`,
		`${slug}-88`
	];

	let suggested = null;
	for (const candidate of candidates) {
		const candidateWhere = { invitation_slug: candidate };
		if (invitationId && invitationId !== 'new') {
			candidateWhere.id = { [Op.ne]: invitationId };
		}
		const match = await Invitation.findOne({
			where: candidateWhere,
			attributes: ['id']
		});
		if (!match && !RESERVED_SLUGS.has(candidate)) {
			suggested = candidate;
			break;
		}
	}

	if (!suggested) {
		suggested = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
	}

	return {
		available: false,
		format_error: false,
		slug,
		suggested,
		message: `Đường dẫn "${slug}" đã có người sử dụng. Hệ thống gợi ý thêm đuôi: "${suggested}"`
	};
};

const updateSlug = async (invitationId, desiredSlug, actor) => {
	const item = await findRaw(invitationId);
	await ensureCanAccess(item, actor);

	// Tuỳ chỉnh chỉ được 1 lần duy nhất ngay từ đầu (trừ admin)
	const isCustomized = Boolean(item.extra_data?.slug_customized);
	if (isCustomized && !isAdmin(actor)) {
		const err = new Error('Đường dẫn thiệp chỉ được thiết lập 1 lần duy nhất và đã được cố định vĩnh viễn.');
		err.status = 400;
		throw err;
	}

	const formatCheck = validateSlugFormat(desiredSlug);
	if (!formatCheck.valid) {
		const err = new Error(formatCheck.error);
		err.status = 400;
		throw err;
	}

	const slug = formatCheck.slug;
	const check = await checkSlugAvailability(invitationId, slug, actor);
	let finalSlug = slug;
	if (!check.available) {
		if (check.suggested) {
			finalSlug = check.suggested;
		} else {
			const err = new Error(check.message);
			err.status = 400;
			throw err;
		}
	}

	item.invitation_slug = finalSlug;
	const currentExtra = (typeof item.extra_data === 'object' && item.extra_data !== null) ? item.extra_data : {};
	item.extra_data = {
		...currentExtra,
		slug_customized: true
	};

	if (Invitation.rawAttributes.updated_at) {
		item.updated_at = getNowValue(Invitation.rawAttributes.updated_at);
	}
	await item.save();

	// Cập nhật lại các PrivateInvitation của thiệp này sang slug mới
	try {
		const pInvs = await PrivateInvitation.findAll({
			where: { invitationns_id: invitationId },
			include: [{ model: Guest, as: 'guest', attributes: ['id'] }]
		});
		for (const p of pInvs) {
			if (p.guest && p.guest.id) {
				const sc = p.guest.id.replace(/-/g, '').slice(0, 8);
				p.url = `/${finalSlug}?g=${sc}`;
				if (PrivateInvitation.rawAttributes.updated_at) {
					p.updated_at = getNowValue(PrivateInvitation.rawAttributes.updated_at);
				}
				await p.save();
			}
		}
	} catch (_e) {}

	return {
		success: true,
		invitation_slug: finalSlug,
		slug_customized: true,
		was_adjusted: finalSlug !== slug,
		original_slug: slug
	};
};

const updateTitle = async (invitationId, titleVi, actor) => {
	const item = await findRaw(invitationId);
	await ensureCanAccess(item, actor);

	const cleanTitle = String(titleVi ?? '').trim();
	if (!cleanTitle) {
		const err = new Error('Tiêu đề thiệp không được để trống.');
		err.status = 400;
		throw err;
	}

	item.title_vi = cleanTitle;
	if (Invitation.rawAttributes.updated_at) {
		item.updated_at = getNowValue(Invitation.rawAttributes.updated_at);
	}
	await item.save();

	return withLockState(await findRaw(invitationId));
};

// Tiêu đề này dùng cho thẻ xem trước khi gửi link qua Zalo/Messenger/Facebook.
// Lưu trong extra_data để không phải thay đổi schema invitation đang dùng ổn định.
const updateShareSettings = async (invitationId, payload, actor) => {
	const item = await findRaw(invitationId);
	await ensureCanAccess(item, actor);

	const clean = (value, fallback) => String(value ?? fallback).trim().replace(/\s+/g, ' ').slice(0, 160);
	const publicTitle = clean(payload?.public_title ?? payload?.share_title_public, item.title_vi || 'Thiệp cưới');
	const privateTitle = clean(
		payload?.private_title ?? payload?.share_title_private,
		'Mời {guest_name} đến chung vui cùng chúng tớ'
	);
	const currentExtra = (typeof item.extra_data === 'object' && item.extra_data !== null) ? item.extra_data : {};
	const cleanDescription = (value, fallback) => String(value ?? fallback).trim().replace(/\s+/g, ' ').slice(0, 300);
	const hasPublicDescription = Object.prototype.hasOwnProperty.call(payload || {}, 'public_description') || Object.prototype.hasOwnProperty.call(payload || {}, 'share_description_public');
	const hasPrivateDescription = Object.prototype.hasOwnProperty.call(payload || {}, 'private_description') || Object.prototype.hasOwnProperty.call(payload || {}, 'share_description_private');
	const publicDescription = hasPublicDescription
		? cleanDescription(payload?.public_description ?? payload?.share_description_public, '')
		: cleanDescription(currentExtra.share_description_public, '');
	const privateDescription = hasPrivateDescription
		? cleanDescription(payload?.private_description ?? payload?.share_description_private, '')
		: cleanDescription(currentExtra.share_description_private, '');
	if (!publicTitle || !privateTitle || (hasPublicDescription && !publicDescription) || (hasPrivateDescription && !privateDescription)) {
		const err = new Error('Tiêu đề và mô tả chia sẻ không được để trống.');
		err.status = 400;
		throw err;
	}

	item.extra_data = {
		...currentExtra,
		share_title_public: publicTitle,
		share_title_private: privateTitle,
		...(publicDescription ? { share_description_public: publicDescription } : {}),
		...(privateDescription ? { share_description_private: privateDescription } : {})
	};
	if (Invitation.rawAttributes.updated_at) item.updated_at = getNowValue(Invitation.rawAttributes.updated_at);
	await item.save();

	return withLockState(await findRaw(invitationId));
};

module.exports = {
	getAll, getById, getBySlug, create, update, editorSave, changeTemplate, setMusic, setBank, remove, createDraft,
	assertOwnMusic, checkSlugAvailability, updateSlug, cleanSlug, generateSlug, validateSlugFormat, updateTitle, updateShareSettings
};
