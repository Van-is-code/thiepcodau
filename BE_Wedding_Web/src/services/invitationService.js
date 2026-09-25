const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const sequelize = require('../config/db');
const { Invitation, InvitationTemplate, Groom, Bride, InvitationImage, User, Customer, CtvProfile } = require('../models');
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
				attributes: ['id', 'template_code', 'template_name', 'html_path', 'schema', 'has_music_box', 'manifest']
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
			}
		],
		order: [[{ model: InvitationImage, as: 'images' }, 'sort_order', 'ASC']]
	});

	if (!item) {
		const error = new Error(`${resourceName} not found`);
		error.status = 404;
		throw error;
	}

	return item;
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
const consumeSlot = async ({ customer, userId, invitationId }, transaction) => {
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

	await validateForeignKeys(data, { id: userId, role: 'user' });

	if (Invitation.rawAttributes.created_at) {
		data.created_at = getNowValue(Invitation.rawAttributes.created_at);
	}
	if (Invitation.rawAttributes.updated_at) {
		data.updated_at = getNowValue(Invitation.rawAttributes.updated_at);
	}

	return sequelize.transaction(async (transaction) => {
		const invitation = await Invitation.create(data, { transaction });
		await consumeSlot({ customer, userId, invitationId: invitation.id }, transaction);
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

	let playlist = Array.isArray(body?.music_playlist) ? body.music_playlist : [];
	playlist = playlist
		.map((u) => String(u || '').trim())
		.filter((u) => /^(https?:\/\/|\/media\/|\/uploads\/)/i.test(u));

	assertOwnMusic(playlist, item.users_id);

	// Không có link nào -> dùng kho nhạc của hệ thống (1 bài ngẫu nhiên).
	//
	// Chỉ gán nhạc mặc định khi mẫu thiệp THỰC SỰ có hộp nhạc. Mẫu không có thẻ
	// <audio> mà vẫn gán thì chỉ là dữ liệu thừa, và nếu thư mục nhạc rỗng thì
	// hàm kia còn ném lỗi 500 làm hỏng cả thao tác lưu.
	const mau = item.template_id
		? await InvitationTemplate.findByPk(item.template_id, { attributes: ['has_music_box', 'manifest'] })
		: null;
	const coHopNhac = mau
		? (mau.has_music_box != null ? Boolean(mau.has_music_box) : Boolean(mau.manifest && mau.manifest.has_music_box))
		: true;

	let primary = playlist[0] || null;
	if (!primary && coHopNhac) {
		try { primary = getRandomDefaultMusicUrl(); } catch (_e) { primary = null; }
	}

	const extra = { ...(item.extra_data || {}), music_playlist: playlist };
	item.extra_data = extra;
	item.music_url = primary;
	if (Invitation.rawAttributes.updated_at) item.updated_at = new Date();
	await item.save();
	return withLockState(await findRaw(id));
};

// Lưu thông tin tài khoản ngân hàng mừng cưới (1 QR chung cho cả thiệp).
// Không tính vào hạn mức sửa; vẫn chặn khi thiệp đã khoá.
const setBank = async (id, body, actor) => {
	const item = await findRaw(id);
	await ensureCanAccess(item, actor);
	await ensureCustomerActivated(item.users_id, actor);
	ensureNotLocked(item, actor);

	const bank = {
		bank_name: String(body?.bank_name || '').trim(),
		bank_short_name: String(body?.bank_short_name || '').trim(),
		bank_account_number: String(body?.bank_account_number || '').trim(),
		bank_account_name: String(body?.bank_account_name || '').trim(),
		qr_content: String(body?.qr_content || '').trim()
	};

	item.extra_data = { ...(item.extra_data || {}), bank };
	if (Invitation.rawAttributes.updated_at) item.updated_at = new Date();
	await item.save();
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

	const invitation = await Invitation.create({
		id: randomUUID(),
		users_id: userId,
		template_id: templateId,
		invitation_slug: generateSlug(),
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
		extra_data: {},
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

module.exports = {
	getAll, getById, getBySlug, create, update, editorSave, changeTemplate, setMusic, setBank, remove, createDraft,
	assertOwnMusic
};
