const { randomUUID } = require('crypto');
const { InvitationImage, Invitation, Customer, CtvProfile } = require('../models');
const storageService = require('./storageService');
const imagePipeline = require('./imagePipelineService');
const env = require('../config/env');
const {
  pickFilters, pagination, assertUuid, isAdmin, forbidden, unauthorized, notFound,
} = require('../middlewares/ownership');

const resourceName = 'Ảnh thiệp';

// Số ảnh tối đa mỗi thiệp — chặn việc nhồi hàng nghìn ảnh làm cạn quota kho.
const MAX_IMAGES_PER_INVITATION = Number.parseInt(process.env.MAX_IMAGES_PER_INVITATION, 10) || 60;

// Chỉ các loại ô ảnh mà mẫu thiệp thật sự dùng. Không cho tự đặt tên tuỳ ý.
const IMAGE_TYPES = new Set(['gallery', 'cover', 'groom', 'bride', 'bank_qr', 'thumbnail', 'banner', 'story']);

const FILTERABLE = ['invitation_id', 'image_type', 'is_cover'];

// ---------------------------------------------------------------------------
// Quyền: ảnh thuộc về THIỆP, nên quyền với ảnh = quyền với thiệp đó.
// Trước đây getById/update/remove không kiểm gì cả -> ai cũng đọc/xoá được ảnh cưới
// của người khác chỉ bằng cách đoán id (IDOR).
// ---------------------------------------------------------------------------
const ctvOwnsInvitationOwner = async (actor, ownerUserId) => {
  if (!actor || actor.role !== 'ctv' || !actor.id) return false;
  const [ctvProfile, customer] = await Promise.all([
    CtvProfile.findOne({ where: { user_id: actor.id } }),
    Customer.findOne({ where: { user_id: ownerUserId } }),
  ]);
  if (!ctvProfile || ctvProfile.status !== 'active') return false;
  return Boolean(customer && String(customer.ctv_id) === String(ctvProfile.id));
};

// Trả về thiệp nếu actor được phép thao tác trên nó, ngược lại ném 403/404.
const assertCanUseInvitation = async (invitationId, actor) => {
  if (!invitationId) {
    const e = new Error('invitation_id là bắt buộc'); e.status = 400; throw e;
  }
  assertUuid(invitationId, 'Thiệp');
  const invitation = await Invitation.findByPk(invitationId, { attributes: ['id', 'users_id'] });
  if (!invitation) {
    const e = new Error('invitation_id không tồn tại'); e.status = 400; throw e;
  }
  if (isAdmin(actor)) return invitation;
  if (!actor || !actor.id) throw unauthorized();
  if (String(invitation.users_id) === String(actor.id)) return invitation;
  if (await ctvOwnsInvitationOwner(actor, invitation.users_id)) return invitation;
  throw forbidden('Bạn không có quyền thêm/sửa ảnh cho thiệp này');
};

// Dạng trả về cho FE: kèm sẵn srcset để dựng thẻ <picture> mà không phải tính lại.
const publicImage = (row) => {
  const item = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  const variants = item.variants || null;
  const srcset = (list) => (Array.isArray(list) && list.length
    ? list.map((v) => v.url + ' ' + v.width + 'w').join(', ')
    : null);
  return {
    ...item,
    // FE chỉ cần đọc 3 chuỗi này là dựng được <picture> đầy đủ.
    srcset_avif: variants ? srcset(variants.avif) : null,
    srcset_webp: variants ? srcset(variants.webp) : null,
    srcset_jpeg: variants ? srcset(variants.jpeg) : null,
    aspect_ratio: item.width && item.height ? Number((item.width / item.height).toFixed(4)) : null,
  };
};

// ---------------------------------------------------------------------------
const getAll = async (query = {}, actor = null) => {
  const { page, limit, offset } = pagination(query);
  const where = pickFilters(query, FILTERABLE);

  if (!isAdmin(actor)) {
    if (!actor || !actor.id) throw unauthorized();
    if (where.invitation_id) {
      // Lọc theo 1 thiệp cụ thể: kiểm quyền với chính thiệp đó (cho phép cả CTV).
      await assertCanUseInvitation(where.invitation_id, actor);
    } else {
      // Không chỉ định thiệp: chỉ trả ảnh của chính mình.
      where.users_id = actor.id;
    }
  }

  const { count, rows } = await InvitationImage.findAndCountAll({
    where, limit, offset, order: [['sort_order', 'ASC'], ['created_at', 'DESC']],
  });

  return {
    items: rows.map(publicImage),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

const findRaw = async (id) => {
  assertUuid(id, resourceName);
  const item = await InvitationImage.findByPk(id);
  if (!item) throw notFound(resourceName);
  return item;
};

const getById = async (id, actor) => {
  const item = await findRaw(id);
  await assertCanUseInvitation(item.invitation_id, actor);
  return publicImage(item);
};

// Đẩy 1 tệp qua dây chuyền xử lý ảnh rồi lưu vào kho (R2 hoặc local).
const storeFile = async (file, invitationId) => {
  if (!file || !file.buffer || !file.buffer.length) {
    const e = new Error('Vui lòng tải lên ảnh'); e.status = 400; throw e;
  }
  // keyPrefix chỉ gồm UUID đã kiểm -> không thể chứa ".." để thoát thư mục.
  return imagePipeline.processAndStore(file.buffer, 'invitations/' + invitationId);
};

const create = async (payload, actor, file) => {
  if (!actor || !actor.id) throw unauthorized('Thiếu thông tin user từ token');

  const invitationId = payload.invitation_id;
  const invitation = await assertCanUseInvitation(invitationId, actor);

  const used = await InvitationImage.count({ where: { invitation_id: invitationId } });
  if (used >= MAX_IMAGES_PER_INVITATION) {
    const e = new Error('Mỗi thiệp chỉ lưu tối đa ' + MAX_IMAGES_PER_INVITATION + ' ảnh. Vui lòng xoá bớt ảnh cũ.');
    e.status = 400; throw e;
  }

  const imageType = IMAGE_TYPES.has(payload.image_type) ? payload.image_type : 'gallery';
  const stored = await storeFile(file, invitationId);

  try {
    const row = await InvitationImage.create({
      id: randomUUID(),
      // Ảnh luôn thuộc về CHỦ THIỆP, không phải người thao tác: CTV tải hộ khách
      // thì ảnh vẫn thuộc tài khoản khách.
      users_id: invitation.users_id,
      invitation_id: invitationId,
      image_url: stored.url,
      image_alt: String(payload.image_alt || '').slice(0, 255) || 'Ảnh thiệp cưới',
      image_type: imageType,
      sort_order: Number.parseInt(payload.sort_order, 10) || 0,
      is_cover: String(payload.is_cover) === 'true' || payload.is_cover === true,
      storage_driver: stored.storage_driver,
      storage_key: stored.key,
      width: stored.width,
      height: stored.height,
      bytes: stored.bytes,
      blur_data_url: stored.blur_data_url,
      dominant_color: stored.dominant_color,
      variants: stored.variants,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return publicImage(row);
  } catch (error) {
    // Ghi DB hỏng -> dọn sạch tệp vừa đẩy lên, không để rác trong kho.
    await storageService.removeMany(imagePipeline.allKeysOf(stored.variants)).catch(() => {});
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Trình duyệt đẩy THẲNG lên R2, xong gọi hàm này để hoàn tất.
//
// Vì sao không dừng ở bước PUT: tệp nằm trên R2 lúc đó vẫn là ẢNH GỐC — chưa
// kiểm có đúng là ảnh không, chưa xoá toạ độ GPS trong EXIF, chưa có bản nhỏ cho
// điện thoại. Dùng thẳng bản đó là bắt khách mời tải 20MB mỗi tấm.
//
// Nên server kéo bản gốc về, chạy đúng dây chuyền như lúc tải qua backend, rồi
// XOÁ bản gốc đi. Cái lợi vẫn còn nguyên: đoạn truyền nặng nhất (máy khách ->
// Cloudflare) không đi qua đường mạng nhà, và server tải về từ Cloudflare thì
// nhanh hơn nhận từ máy khách nhiều.
//
// Chống lạm dụng — key do CLIENT gửi lên nên phải tự kiểm lại từ đầu:
//   - key bắt buộc nằm đúng trong thư mục của thiệp này, không mượn được của thiệp khác
//   - phải nằm trong nhánh original/ (chỗ duy nhất presign cho ghi)
//   - xem kích thước TRƯỚC khi tải về, quá hạn mức thì xoá luôn, không kéo về
const attachFromStorage = async (payload, actor) => {
  if (!actor || !actor.id) throw unauthorized('Thiếu thông tin user từ token');

  const invitationId = payload.invitation_id;

  // Kiểm hình dạng khoá TRƯỚC khi hỏi CSDL: khoá bậy thì chặn ngay, khỏi tốn một
  // vòng truy vấn, và cũng để chốt chặn này không phụ thuộc vào CSDL.
  assertUuid(invitationId, 'invitation_id');
  const key = storageService.assertSafeKey(String(payload.key || ''));
  const prefixHopLe = 'invitations/' + invitationId + '/original/';
  if (!key.startsWith(prefixHopLe)) {
    const e = new Error('Khoá tệp không thuộc thiệp này'); e.status = 400; throw e;
  }

  const invitation = await assertCanUseInvitation(invitationId, actor);

  const replaceId = payload.replace_id || null;
  let item = null;
  if (replaceId) {
    item = await findRaw(replaceId);
    await assertCanUseInvitation(item.invitation_id, actor);
  } else {
    const used = await InvitationImage.count({ where: { invitation_id: invitationId } });
    if (used >= MAX_IMAGES_PER_INVITATION) {
      await storageService.remove(key).catch(() => {});
      const e = new Error('Mỗi thiệp chỉ lưu tối đa ' + MAX_IMAGES_PER_INVITATION + ' ảnh. Vui lòng xoá bớt ảnh cũ.');
      e.status = 400; throw e;
    }
  }

  const info = await storageService.head(key);
  if (!info.exists) {
    const e = new Error('Chưa thấy tệp trên kho. Có thể lần tải lên đã hỏng, vui lòng thử lại.');
    e.status = 404; throw e;
  }
  if (info.size > env.maxImageBytes) {
    await storageService.remove(key).catch(() => {});
    const e = new Error('Ảnh vượt quá ' + Math.round(env.maxImageBytes / 1024 / 1024) + 'MB');
    e.status = 413; throw e;
  }

  const buffer = await storageService.getObject(key);
  let stored;
  try {
    // processAndStore tự kiểm magic bytes -> tệp giả danh ảnh bị chặn ở đây,
    // dù client đã khai content_type là image/jpeg lúc xin link.
    stored = await imagePipeline.processAndStore(buffer, 'invitations/' + invitationId);
  } finally {
    // Bản gốc xong việc thì bỏ, kể cả khi xử lý hỏng — không để rác tốn tiền kho.
    await storageService.remove(key).catch(() => {});
  }

  const chung = {
    image_url: stored.url,
    storage_driver: stored.storage_driver,
    storage_key: stored.key,
    width: stored.width,
    height: stored.height,
    bytes: stored.bytes,
    blur_data_url: stored.blur_data_url,
    dominant_color: stored.dominant_color,
    variants: stored.variants,
    updated_at: new Date(),
  };

  try {
    if (item) {
      const khoaCu = imagePipeline.allKeysOf(item.variants);
      await item.update({
        ...chung,
        image_alt: payload.image_alt !== undefined ? String(payload.image_alt).slice(0, 255) : item.image_alt,
        image_type: IMAGE_TYPES.has(payload.image_type) ? payload.image_type : item.image_type,
        sort_order: payload.sort_order !== undefined ? (Number.parseInt(payload.sort_order, 10) || 0) : item.sort_order,
      });
      await storageService.removeMany(khoaCu).catch(() => {});
      return publicImage(item);
    }

    const row = await InvitationImage.create({
      id: randomUUID(),
      users_id: invitation.users_id,
      invitation_id: invitationId,
      image_alt: String(payload.image_alt || '').slice(0, 255) || 'Ảnh thiệp cưới',
      image_type: IMAGE_TYPES.has(payload.image_type) ? payload.image_type : 'gallery',
      sort_order: Number.parseInt(payload.sort_order, 10) || 0,
      is_cover: String(payload.is_cover) === 'true' || payload.is_cover === true,
      created_at: new Date(),
      ...chung,
    });
    return publicImage(row);
  } catch (error) {
    await storageService.removeMany(imagePipeline.allKeysOf(stored.variants)).catch(() => {});
    throw error;
  }
};

const update = async (id, payload, actor, file) => {
  if (!actor || !actor.id) throw unauthorized('Thiếu thông tin user từ token');

  const item = await findRaw(id);
  await assertCanUseInvitation(item.invitation_id, actor);

  // Không cho chuyển ảnh sang thiệp khác trừ khi cũng có quyền với thiệp đích.
  let invitationId = item.invitation_id;
  if (payload.invitation_id && String(payload.invitation_id) !== String(item.invitation_id)) {
    await assertCanUseInvitation(payload.invitation_id, actor);
    invitationId = payload.invitation_id;
  }

  const oldKeys = imagePipeline.allKeysOf(item.variants);
  let stored = null;
  if (file) stored = await storeFile(file, invitationId);

  const patch = { invitation_id: invitationId, updated_at: new Date() };
  if (payload.image_alt !== undefined) patch.image_alt = String(payload.image_alt).slice(0, 255);
  if (payload.image_type !== undefined && IMAGE_TYPES.has(payload.image_type)) patch.image_type = payload.image_type;
  if (payload.sort_order !== undefined) patch.sort_order = Number.parseInt(payload.sort_order, 10) || 0;
  if (payload.is_cover !== undefined) patch.is_cover = String(payload.is_cover) === 'true' || payload.is_cover === true;

  if (stored) {
    Object.assign(patch, {
      image_url: stored.url,
      storage_driver: stored.storage_driver,
      storage_key: stored.key,
      width: stored.width,
      height: stored.height,
      bytes: stored.bytes,
      blur_data_url: stored.blur_data_url,
      dominant_color: stored.dominant_color,
      variants: stored.variants,
    });
  }

  try {
    await item.update(patch);
  } catch (error) {
    if (stored) await storageService.removeMany(imagePipeline.allKeysOf(stored.variants)).catch(() => {});
    throw error;
  }

  // Chỉ xoá ảnh cũ SAU khi DB đã trỏ sang ảnh mới -> không bao giờ có khoảng thời
  // gian thiệp trỏ tới tệp đã bị xoá.
  if (stored && oldKeys.length) await storageService.removeMany(oldKeys).catch(() => {});

  return publicImage(item);
};

const remove = async (id, actor) => {
  const item = await findRaw(id);
  await assertCanUseInvitation(item.invitation_id, actor);

  const keys = imagePipeline.allKeysOf(item.variants);
  if (item.storage_key && !keys.includes(item.storage_key)) keys.push(item.storage_key);

  await item.destroy();
  await storageService.removeMany(keys).catch(() => {});
  return true;
};

module.exports = {
  getAll,
  getById,
  create,
  attachFromStorage,
  update,
  remove,
  publicImage,
  assertCanUseInvitation,
  MAX_IMAGES_PER_INVITATION,
  IMAGE_TYPES,
};
