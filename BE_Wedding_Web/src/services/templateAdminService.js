// Quản trị mẫu thiệp: tải theme lên -> tự chuyển đổi -> đăng ký, và cấp/thu quyền.
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  sequelize, InvitationTemplate, TemplatePermission, Customer, CtvProfile, User, Invitation,
} = require('../models');
const { convertThemeZip } = require('./themeConverter/packager');
const templateUploadService = require('./templateUploadService');
const access = require('./templateAccessService');
const catalog = require('./themeConverter/fieldCatalog');
const auditService = require('./auditService');
const { isUuid } = require('../utils/isUuid');
const { pagination } = require('../middlewares/ownership');

const bad = (message, status = 400) => { const e = new Error(message); e.status = status; return e; };

const slugifyCode = (code) => String(code || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9-_]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 50);

// Chỉ nhận đúng các khoá ô ảnh có thật và giá trị trong khoảng hợp lý.
const sanitizeImageRules = (rules) => {
  if (!rules || typeof rules !== 'object') return null;
  const out = {};
  for (const [slot, cfg] of Object.entries(rules)) {
    if (!catalog.isKnownImageSlot(slot) || !cfg || typeof cfg !== 'object') continue;
    const meta = catalog.IMAGE_SLOTS[slot];
    const rule = {};
    if (cfg.allow_change !== undefined) rule.allow_change = cfg.allow_change !== false;
    if (meta.multiple) {
      // Cho khách tải thêm ảnh vào album hay cố định đúng số ô của thiết kế.
      if (cfg.allow_add !== undefined) rule.allow_add = cfg.allow_add !== false;
      const max = Number.parseInt(cfg.max, 10);
      if (Number.isFinite(max)) rule.max = Math.min(Math.max(max, 1), meta.max || 20);
    }
    if (Object.keys(rule).length) out[slot] = rule;
  }
  return Object.keys(out).length ? out : null;
};

const publicTemplate = (t, extra = {}) => ({
  id: t.id,
  template_code: t.template_code,
  template_name: t.template_name,
  html_path: t.html_path,
  status: t.status,
  visibility: t.visibility,
  owner_customer_id: t.owner_customer_id,
  thumbnail_url: t.thumbnail_url,
  description: t.description,
  sort_order: t.sort_order,
  editable_fields: t.editable_fields,
  image_slot_rules: t.image_slot_rules,
  // Cột null = chưa ai chốt tay -> lấy theo manifest (theme có thẻ <audio> không).
  has_music_box: t.has_music_box != null
    ? Boolean(t.has_music_box)
    : Boolean(t.manifest && t.manifest.has_music_box),
  music_box_source: t.has_music_box != null ? 'admin' : 'theme',
  created_at: t.created_at,
  updated_at: t.updated_at,
  // Manifest có thể rất dài -> chỉ trả phần tóm tắt ở danh sách.
  manifest_summary: t.manifest ? {
    fields: (t.manifest.fields || []).length,
    image_slots: (t.manifest.image_slots || []).length,
    needs_review: (t.manifest.needs_review || []).length,
  } : null,
  ...extra,
});

/**
 * Tải gói theme (.zip) lên -> chuyển đổi -> giải nén -> tạo bản ghi mẫu.
 *
 * Toàn bộ đi qua một đường duy nhất để mọi mẫu vào hệ thống đều đã gắn thuộc tính
 * và có manifest — không còn cảnh mẫu "đẹp nhưng không bơm được dữ liệu".
 */
const importTheme = async ({ buffer, templateCode, templateName, description, entryFile,
  visibility = 'public', ownerCustomerId = null, overrides = {}, minConfidence,
  editableFields = null, imageSlotRules = null, adminUserId, ip }) => {
  if (!buffer || !buffer.length) throw bad('Chưa chọn tệp .zip của theme');

  const code = slugifyCode(templateCode);
  if (!code) throw bad('Mã mẫu (template_code) không hợp lệ');
  if (!access.VISIBILITIES.includes(visibility)) throw bad('Mức hiển thị không hợp lệ');
  if (visibility === 'exclusive' && !isUuid(String(ownerCustomerId || ''))) {
    throw bad('Mẫu độc quyền phải chọn đúng 1 khách hàng');
  }

  const existed = await InvitationTemplate.findOne({ where: { template_code: code } });
  if (existed) throw bad(`Mã mẫu "${code}" đã tồn tại, hãy chọn mã khác`, 409);

  if (ownerCustomerId) {
    const cust = await Customer.findByPk(ownerCustomerId);
    if (!cust) throw bad('Không tìm thấy khách hàng được chọn', 404);
  }

  // 1) Chuyển đổi: gắn data-field / data-image + sinh manifest
  const converted = convertThemeZip(buffer, { entryFile, overrides, minConfidence });

  // 2) Giải nén gói ĐÃ chuyển đổi vào uploads/templates (dùng lại lớp chống
  //    zip-slip / zip-bomb sẵn có thay vì viết lại).
  const extracted = templateUploadService.extractPackage({
    buffer: converted.zip,
    templateCode: code,
    entryFile: converted.entryName,
  });

  const now = new Date();
  const template = await InvitationTemplate.create({
    id: randomUUID(),
    template_code: code,
    template_name: String(templateName || code).slice(0, 255),
    html_path: extracted.htmlPath,
    status: 'draft', // luôn vào dạng nháp -> admin xem trước rồi mới xuất bản
    visibility,
    owner_customer_id: visibility === 'exclusive' ? ownerCustomerId : null,
    created_by: adminUserId || null,
    description: description ? String(description).slice(0, 2000) : null,
    manifest: converted.manifest,
    schema: { fields: converted.manifest.fields, image_slots: converted.manifest.image_slots },
    // null = dùng bộ mặc định của hệ thống; mảng = đúng những ô admin đã tích.
    // Suy từ theme ngay lúc nhập; admin sửa lại sau cũng được.
    has_music_box: converted.manifest.has_music_box === true ? true : null,
    editable_fields: catalog.sanitizeEditable(editableFields),
    image_slot_rules: sanitizeImageRules(imageSlotRules),
    sort_order: 0,
    created_at: now,
    updated_at: now,
  });

  await auditService.log({
    actorType: 'admin', actorId: adminUserId || null,
    action: 'template.import', entityType: 'invitation_template', entityId: template.id,
    newValue: { code, visibility, stats: converted.report.summary },
    ip: ip || null,
  });

  return {
    template: publicTemplate(template),
    report: converted.report,
    manifest: converted.manifest,
  };
};

module.exports = { importTheme, publicTemplate, slugifyCode, bad, sanitizeImageRules };

// ---------------- Danh sách quản trị ----------------
const listForAdmin = async (query = {}) => {
  const { page, limit, offset } = pagination(query, { defaultLimit: 30 });
  const where = {};
  if (query.status) where.status = query.status;
  if (query.visibility) where.visibility = query.visibility;
  if (query.search) {
    where[Op.or] = [
      { template_name: { [Op.iLike]: `%${query.search}%` } },
      { template_code: { [Op.iLike]: `%${query.search}%` } },
    ];
  }

  const { count, rows } = await InvitationTemplate.findAndCountAll({
    where, limit, offset,
    order: [['sort_order', 'ASC'], ['created_at', 'DESC']],
    include: [{ model: Customer, as: 'ownerCustomer', attributes: ['id', 'name'], required: false }],
  });

  // Đếm số quyền đã cấp + số thiệp đang dùng, để admin biết mẫu nào đang được dùng
  // trước khi tắt hay xoá.
  const ids = rows.map((r) => r.id);
  const [grants, usage] = await Promise.all([
    ids.length ? TemplatePermission.findAll({
      attributes: ['template_id', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      where: { template_id: { [Op.in]: ids }, enabled: true }, group: ['template_id'],
    }) : [],
    ids.length ? Invitation.findAll({
      attributes: ['template_id', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      where: { template_id: { [Op.in]: ids } }, group: ['template_id'],
    }) : [],
  ]);
  const gMap = Object.fromEntries(grants.map((g) => [String(g.template_id), Number(g.get('n')) || 0]));
  const uMap = Object.fromEntries(usage.map((u) => [String(u.template_id), Number(u.get('n')) || 0]));

  return {
    items: rows.map((t) => publicTemplate(t, {
      owner_customer_name: t.ownerCustomer ? t.ownerCustomer.name : null,
      grant_count: gMap[String(t.id)] || 0,
      invitation_count: uMap[String(t.id)] || 0,
    })),
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

const getDetail = async (id) => {
  if (!isUuid(id)) throw bad('id không hợp lệ', 404);
  const t = await InvitationTemplate.findByPk(id, {
    include: [{ model: Customer, as: 'ownerCustomer', attributes: ['id', 'name'], required: false }],
  });
  if (!t) throw bad('Không tìm thấy mẫu', 404);

  const perms = await TemplatePermission.findAll({
    where: { template_id: t.id }, order: [['created_at', 'DESC']],
  });
  const enriched = await enrichGrantees(perms);
  const invitationCount = await Invitation.count({ where: { template_id: t.id } });

  return {
    ...publicTemplate(t, { owner_customer_name: t.ownerCustomer ? t.ownerCustomer.name : null }),
    manifest: t.manifest,
    invitation_count: invitationCount,
    permissions: enriched,
  };
};

// Gắn tên người được cấp quyền để trang quản trị hiện tên thay vì UUID.
const enrichGrantees = async (perms) => {
  const byType = { ctv: [], customer: [], user: [] };
  for (const p of perms) if (byType[p.grantee_type]) byType[p.grantee_type].push(p.grantee_id);

  const [ctvs, customers, users] = await Promise.all([
    byType.ctv.length ? CtvProfile.findAll({
      where: { id: { [Op.in]: byType.ctv } },
      attributes: ['id', 'display_name', 'phone'],
      include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
    }) : [],
    byType.customer.length ? Customer.findAll({
      where: { id: { [Op.in]: byType.customer } },
      attributes: ['id', 'name', 'phone'],
      include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
    }) : [],
    byType.user.length ? User.findAll({
      where: { id: { [Op.in]: byType.user } },
      attributes: ['id', 'username', 'role']
    }) : [],
  ]);

  const info = {
    ctv: Object.fromEntries(ctvs.map((c) => [String(c.id), {
      name: c.display_name,
      username: c.user ? c.user.username : null,
      phone: c.phone || null,
      role: 'ctv'
    }])),
    customer: Object.fromEntries(customers.map((c) => [String(c.id), {
      name: c.name,
      username: c.user ? c.user.username : null,
      phone: c.phone || null,
      role: 'customer'
    }])),
    user: Object.fromEntries(users.map((u) => [String(u.id), {
      name: u.username,
      username: u.username,
      phone: null,
      role: u.role
    }])),
  };

  return perms.map((p) => {
    const meta = (info[p.grantee_type] || {})[String(p.grantee_id)] || {};
    return {
      id: p.id,
      grantee_type: p.grantee_type,
      grantee_id: p.grantee_id,
      grantee_name: meta.name || meta.username || p.grantee_id,
      username: meta.username || null,
      role: meta.role || p.grantee_type,
      phone: meta.phone || null,
      enabled: p.enabled,
      note: p.note,
      created_at: p.created_at,
    };
  });
};

const listEligibleGrantees = async ({ search = '' } = {}) => {
  const [users, ctvs, customers] = await Promise.all([
    User.findAll({
      attributes: ['id', 'username', 'role', 'created_at'],
      order: [['created_at', 'DESC']]
    }),
    CtvProfile.findAll({
      attributes: ['id', 'user_id', 'display_name', 'phone', 'status'],
      include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
    }),
    Customer.findAll({
      attributes: ['id', 'user_id', 'name', 'phone', 'status'],
      include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
    })
  ]);

  const items = [];

  // 1. Users
  for (const u of users) {
    items.push({
      grantee_type: 'user',
      grantee_id: u.id,
      username: u.username,
      display_name: u.username,
      role: u.role,
      type_label: u.role === 'admin' ? 'Quản trị viên' : u.role === 'ctv' ? 'Tài khoản CTV' : 'Tài khoản người dùng',
      label: `[Tài khoản] ${u.username} (${u.role.toUpperCase()})`,
    });
  }

  // 2. CTVs
  for (const c of ctvs) {
    items.push({
      grantee_type: 'ctv',
      grantee_id: c.id,
      username: c.user?.username || null,
      display_name: c.display_name,
      role: 'ctv',
      type_label: 'Cộng tác viên (CTV)',
      label: `[CTV] ${c.display_name} (@${c.user?.username || 'ctv'})`,
    });
  }

  // 3. Customers
  for (const cu of customers) {
    items.push({
      grantee_type: 'customer',
      grantee_id: cu.id,
      username: cu.user?.username || null,
      display_name: cu.name,
      role: 'customer',
      type_label: 'Khách hàng của CTV',
      label: `[Khách hàng] ${cu.name} (@${cu.user?.username || 'khach'})`,
    });
  }

  if (search) {
    const q = search.toLowerCase();
    return items.filter(x =>
      x.label.toLowerCase().includes(q) ||
      (x.username && x.username.toLowerCase().includes(q)) ||
      (x.display_name && x.display_name.toLowerCase().includes(q))
    );
  }

  return items;
};

module.exports.listForAdmin = listForAdmin;
module.exports.getDetail = getDetail;

// ---------------- Cập nhật mẫu ----------------
const updateTemplate = async (id, body = {}, { adminUserId, ip } = {}) => {
  if (!isUuid(id)) throw bad('id không hợp lệ', 404);
  const t = await InvitationTemplate.findByPk(id);
  if (!t) throw bad('Không tìm thấy mẫu', 404);

  const before = { status: t.status, visibility: t.visibility, owner_customer_id: t.owner_customer_id };
  const patch = { updated_at: new Date() };

  if (body.template_name !== undefined) patch.template_name = String(body.template_name).slice(0, 255);
  if (body.description !== undefined) patch.description = body.description ? String(body.description).slice(0, 2000) : null;
  if (body.thumbnail_url !== undefined) patch.thumbnail_url = body.thumbnail_url ? String(body.thumbnail_url).slice(0, 500) : null;
  if (body.sort_order !== undefined) patch.sort_order = Number.parseInt(body.sort_order, 10) || 0;
  // Đổi quyền sửa sau khi mẫu đã chạy: áp ngay cho mọi thiệp dùng mẫu này.
  if (body.has_music_box !== undefined) {
    // null = trả về "theo theme". true/false = admin chốt tay.
    patch.has_music_box = body.has_music_box === null || body.has_music_box === ''
      ? null
      : Boolean(body.has_music_box === true || body.has_music_box === 'true');
  }
  if (body.editable_fields !== undefined) patch.editable_fields = catalog.sanitizeEditable(body.editable_fields);
  if (body.image_slot_rules !== undefined) patch.image_slot_rules = sanitizeImageRules(body.image_slot_rules);

  // Bật/tắt mẫu: 'published' = khách chọn được, 'draft' = ẩn khỏi mọi người trừ admin.
  if (body.status !== undefined) {
    if (!['draft', 'published'].includes(body.status)) throw bad('status chỉ nhận draft hoặc published');
    patch.status = body.status;
  }

  if (body.visibility !== undefined) {
    if (!access.VISIBILITIES.includes(body.visibility)) throw bad('Mức hiển thị không hợp lệ');
    patch.visibility = body.visibility;
    if (body.visibility === 'exclusive') {
      const owner = body.owner_customer_id || t.owner_customer_id;
      if (!isUuid(String(owner || ''))) throw bad('Mẫu độc quyền phải chọn đúng 1 khách hàng');
      const cust = await Customer.findByPk(owner);
      if (!cust) throw bad('Không tìm thấy khách hàng được chọn', 404);
      patch.owner_customer_id = owner;
    } else {
      patch.owner_customer_id = null;
    }
  } else if (body.owner_customer_id !== undefined && t.visibility === 'exclusive') {
    if (!isUuid(String(body.owner_customer_id || ''))) throw bad('owner_customer_id không hợp lệ');
    patch.owner_customer_id = body.owner_customer_id;
  }

  await t.update(patch);

  await auditService.log({
    actorType: 'admin', actorId: adminUserId || null,
    action: 'template.update', entityType: 'invitation_template', entityId: t.id,
    oldValue: before,
    newValue: { status: t.status, visibility: t.visibility, owner_customer_id: t.owner_customer_id },
    ip: ip || null,
  });

  return publicTemplate(t);
};

// ---------------- Cấp / thu quyền ----------------
const GRANTEE_MODEL = { ctv: CtvProfile, customer: Customer, user: User };

const grantAccess = async (templateId, { granteeType, granteeId, note }, { adminUserId, ip } = {}) => {
  if (!isUuid(templateId)) throw bad('template_id không hợp lệ', 404);
  
  const rawId = String(granteeId || '').trim();
  if (!rawId) throw bad('Chưa chọn đối tượng được cấp quyền');

  const t = await InvitationTemplate.findByPk(templateId);
  if (!t) throw bad('Không tìm thấy mẫu', 404);

  let targetType = granteeType || 'user';
  let targetId = rawId;
  let exists = null;

  if (isUuid(rawId)) {
    if (targetType && GRANTEE_MODEL[targetType]) {
      exists = await GRANTEE_MODEL[targetType].findByPk(rawId);
    }
    if (!exists) {
      exists = await User.findByPk(rawId);
      if (exists) targetType = 'user';
    }
    if (!exists) {
      exists = await Customer.findByPk(rawId);
      if (exists) targetType = 'customer';
    }
    if (!exists) {
      exists = await CtvProfile.findByPk(rawId);
      if (exists) targetType = 'ctv';
    }
  } else {
    // 1. Tìm theo username trong bảng User (chú ý: bảng User KHÔNG có cột email)
    const userFound = await User.findOne({ where: { username: rawId } });
    if (userFound) {
      if (targetType === 'ctv') {
        const ctvFound = await CtvProfile.findOne({ where: { user_id: userFound.id } });
        if (ctvFound) {
          exists = ctvFound;
          targetType = 'ctv';
        } else {
          exists = userFound;
          targetType = 'user';
        }
      } else if (targetType === 'customer') {
        const custFound = await Customer.findOne({ where: { user_id: userFound.id } });
        if (custFound) {
          exists = custFound;
          targetType = 'customer';
        } else {
          // Tài khoản người dùng không gắn Customer -> tự động cấp thẳng theo User
          exists = userFound;
          targetType = 'user';
        }
      } else {
        exists = userFound;
        targetType = 'user';
      }
    }

    // 2. Tìm theo Customer (name hoặc phone)
    if (!exists) {
      exists = await Customer.findOne({
        where: { [Op.or]: [{ name: rawId }, { phone: rawId }] }
      });
      if (exists) targetType = 'customer';
    }

    // 3. Tìm theo CtvProfile (display_name hoặc phone)
    if (!exists) {
      exists = await CtvProfile.findOne({
        where: { [Op.or]: [{ display_name: rawId }, { phone: rawId }] }
      });
      if (exists) targetType = 'ctv';
    }
  }

  if (!exists) {
    throw bad(`Không tìm thấy tài khoản / đối tượng với thông tin: "${rawId}"`, 404);
  }

  targetId = exists.id;

  const [row, created] = await TemplatePermission.findOrCreate({
    where: { template_id: templateId, grantee_type: targetType, grantee_id: targetId },
    defaults: {
      id: randomUUID(),
      template_id: templateId,
      grantee_type: targetType,
      grantee_id: targetId,
      enabled: true,
      note: note ? String(note).slice(0, 500) : null,
      granted_by: adminUserId || null,
      created_at: new Date(),
      updated_at: new Date(),
    }
  });

  if (!created && !row.enabled) {
    await row.update({ enabled: true, note: note ? String(note).slice(0, 500) : row.note, updated_at: new Date() });
  }

  await auditService.log({
    actorType: 'admin',
    actorId: adminUserId || null,
    action: 'template.grant',
    entityType: 'invitation_template',
    entityId: templateId,
    newValue: {
      grantee_type: targetType,
      grantee_id: targetId,
      grantee_name: exists.username || exists.name || exists.display_name
    },
    ip: ip || null,
  });

  return { id: row.id, granted: true, reactivated: !created, grantee_type: targetType, grantee_id: targetId };
};

// Bật/tắt 1 quyền đã cấp (không xoá -> giữ lịch sử).
const setAccessEnabled = async (permissionId, enabled, { adminUserId, ip } = {}) => {
  if (!isUuid(permissionId)) throw bad('permissionId không hợp lệ', 404);
  const row = await TemplatePermission.findByPk(permissionId);
  if (!row) throw bad('Không tìm thấy bản ghi cấp quyền', 404);

  await row.update({ enabled: Boolean(enabled), updated_at: new Date() });
  await auditService.log({
    actorType: 'admin', actorId: adminUserId || null,
    action: enabled ? 'template.grant.enable' : 'template.grant.disable',
    entityType: 'invitation_template', entityId: row.template_id,
    newValue: { permission_id: row.id, enabled: row.enabled }, ip: ip || null,
  });
  return { id: row.id, enabled: row.enabled };
};

// Thu hồi (xoá hẳn) 1 quyền đã cấp.
const revokeAccess = async (permissionId, { adminUserId, ip } = {}) => {
  if (!isUuid(permissionId)) throw bad('permissionId không hợp lệ', 404);
  const row = await TemplatePermission.findByPk(permissionId);
  if (!row) throw bad('Không tìm thấy bản ghi cấp quyền', 404);

  const snapshot = { template_id: row.template_id, grantee_type: row.grantee_type, grantee_id: row.grantee_id };
  await row.destroy();
  await auditService.log({
    actorType: 'admin', actorId: adminUserId || null,
    action: 'template.revoke', entityType: 'invitation_template', entityId: snapshot.template_id,
    oldValue: snapshot, ip: ip || null,
  });
  return { revoked: true };
};

module.exports.updateTemplate = updateTemplate;
module.exports.grantAccess = grantAccess;
module.exports.setAccessEnabled = setAccessEnabled;
module.exports.revokeAccess = revokeAccess;
module.exports.listEligibleGrantees = listEligibleGrantees;

// ---------------- Xoá mẫu ----------------
//
// Chỉ xoá được khi CHƯA có thiệp nào dùng. Xoá mẫu đang được dùng sẽ làm mọi thiệp
// đó mất giao diện — khách mở link chỉ thấy trang lỗi, mà không có đường khôi phục.
// Muốn ngừng dùng mẫu thì TẮT (status='draft'): thiệp cũ vẫn chạy, chỉ không ai
// chọn mới được nữa.
const deleteTemplate = async (id, { adminUserId, ip } = {}) => {
  if (!isUuid(id)) throw bad('id không hợp lệ', 404);
  const t = await InvitationTemplate.findByPk(id);
  if (!t) throw bad('Không tìm thấy mẫu', 404);

  const used = await Invitation.count({ where: { template_id: id } });
  if (used > 0) {
    throw bad(
      `Mẫu đang được ${used} thiệp sử dụng nên không thể xoá. `
      + 'Hãy TẮT mẫu thay vì xoá — thiệp cũ vẫn hiển thị bình thường, chỉ không ai chọn mới được nữa.',
      409
    );
  }

  const snapshot = { template_code: t.template_code, template_name: t.template_name, html_path: t.html_path };

  // Xoá bản ghi trước: nếu bước này hỏng thì tệp trên đĩa vẫn còn, mẫu vẫn dùng
  // được. Làm ngược lại thì mẫu sẽ trỏ vào thư mục đã biến mất.
  await t.destroy(); // template_permissions có ON DELETE CASCADE

  // Dọn thư mục đã giải nén. Lỗi ở đây chỉ để lại rác, không ảnh hưởng dữ liệu.
  try {
    const dir = path.join(process.cwd(), 'uploads', 'templates', t.template_code);
    const root = path.join(process.cwd(), 'uploads', 'templates');
    if (dir.startsWith(root + path.sep)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('[template] xoá bản ghi xong nhưng không dọn được thư mục:', error.message);
  }

  await auditService.log({
    actorType: 'admin', actorId: adminUserId || null,
    action: 'template.delete', entityType: 'invitation_template', entityId: id,
    oldValue: snapshot, ip: ip || null,
  });

  return { deleted: true, ...snapshot };
};

module.exports.deleteTemplate = deleteTemplate;
