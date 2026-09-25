// Quyết định AI được dùng MẪU nào.
//
// Ba mức hiển thị:
//   public    — mọi người dùng đã đăng nhập đều chọn được
//   restricted— chỉ ai có dòng trong template_permissions (đang bật)
//   exclusive — độc quyền cho đúng 1 khách hàng (owner_customer_id)
//
// Quy tắc cấp quyền cho CTV: cấp cho CTV thì MỌI KHÁCH của CTV đó cũng dùng được —
// vì thực tế chính CTV là người soạn thiệp hộ khách.
const { Op } = require('sequelize');
const {
  InvitationTemplate, TemplatePermission, Customer, CtvProfile,
} = require('../models');
const { isUuid } = require('../utils/isUuid');

const VISIBILITIES = ['public', 'restricted', 'exclusive'];
const GRANTEE_TYPES = ['ctv', 'customer', 'user'];

const bad = (message, status = 400) => {
  const e = new Error(message); e.status = status; return e;
};

/**
 * Dựng "danh tính" của người đang thao tác: họ là ai trong hệ CTV/khách.
 * Dùng chung cho cả lúc liệt kê mẫu lẫn lúc kiểm quyền dùng 1 mẫu.
 */
const resolveIdentity = async (actor) => {
  if (!actor || !actor.id) return { role: 'guest' };
  if (actor.role === 'admin') return { role: 'admin', userId: actor.id };

  const [ctvProfile, customer] = await Promise.all([
    CtvProfile.findOne({ where: { user_id: actor.id }, attributes: ['id', 'status'] }),
    Customer.findOne({ where: { user_id: actor.id }, attributes: ['id', 'ctv_id', 'status'] }),
  ]);

  return {
    role: actor.role || 'user',
    userId: actor.id,
    // CTV đang thao tác (soạn thiệp hộ khách)
    ctvId: ctvProfile && ctvProfile.status === 'active' ? ctvProfile.id : null,
    // Khách hàng: chính họ, và CTV đang quản lý họ
    customerId: customer ? customer.id : null,
    ownerCtvId: customer ? customer.ctv_id : null,
  };
};

module.exports = { VISIBILITIES, GRANTEE_TYPES, resolveIdentity, bad };

// Các "khoá" mà người này nắm: dùng để tra template_permissions.
// CTV của khách cũng được tính -> cấp quyền cho CTV là cả nhóm khách dùng được.
const granteeKeysOf = (identity) => {
  const keys = [];
  if (identity.userId) keys.push({ grantee_type: 'user', grantee_id: identity.userId });
  if (identity.customerId) keys.push({ grantee_type: 'customer', grantee_id: identity.customerId });
  // CTV: cả khi họ tự thao tác, lẫn khi họ là CTV quản lý khách đang soạn thiệp.
  const ctvIds = [identity.ctvId, identity.ownerCtvId].filter(Boolean);
  for (const id of [...new Set(ctvIds.map(String))]) {
    keys.push({ grantee_type: 'ctv', grantee_id: id });
  }
  return keys;
};

// Điều kiện WHERE lọc đúng những mẫu mà người này được dùng.
const buildVisibilityWhere = async (identity) => {
  if (identity.role === 'admin') return {}; // admin thấy tất cả

  const keys = granteeKeysOf(identity);
  let grantedIds = [];
  if (keys.length) {
    const rows = await TemplatePermission.findAll({
      where: {
        enabled: true,
        [Op.or]: keys.map((k) => ({ grantee_type: k.grantee_type, grantee_id: k.grantee_id })),
      },
      attributes: ['template_id'],
    });
    grantedIds = [...new Set(rows.map((r) => String(r.template_id)))];
  }

  const or = [
    // Mẫu công khai: ai cũng dùng
    { visibility: 'public' },
  ];
  // Mẫu giới hạn: phải có dòng cấp quyền
  if (grantedIds.length) or.push({ visibility: 'restricted', id: { [Op.in]: grantedIds } });
  // Mẫu độc quyền: chỉ đúng khách đó (hoặc mẫu độc quyền đã được cấp thêm quyền)
  if (identity.customerId) {
    or.push({ visibility: 'exclusive', owner_customer_id: identity.customerId });
  }
  if (grantedIds.length) or.push({ visibility: 'exclusive', id: { [Op.in]: grantedIds } });

  return { [Op.or]: or };
};

/**
 * Người này có được dùng mẫu này không? Trả về { allowed, reason }.
 *
 * Đây là CHỐT CHẶN cuối cùng — phải gọi ở mọi chỗ gán mẫu vào thiệp
 * (tạo thiệp nháp, đổi mẫu), không chỉ ở chỗ liệt kê. Chỉ lọc ở danh sách thì
 * người dùng vẫn gán được mẫu độc quyền của khách khác bằng cách gửi thẳng id.
 */
const canUseTemplate = async (templateId, actor) => {
  if (!templateId || !isUuid(templateId)) return { allowed: false, reason: 'template_id không hợp lệ' };

  const template = await InvitationTemplate.findByPk(templateId, {
    attributes: ['id', 'status', 'visibility', 'owner_customer_id', 'template_name'],
  });
  if (!template) return { allowed: false, reason: 'Mẫu không tồn tại' };

  const identity = await resolveIdentity(actor);
  if (identity.role === 'admin') return { allowed: true, template, identity };

  // Mẫu chưa xuất bản: chỉ admin xem/dùng được.
  if (template.status !== 'published') {
    return { allowed: false, reason: 'Mẫu này chưa được mở để sử dụng', template };
  }

  if (template.visibility === 'public') return { allowed: true, template, identity };

  // Độc quyền: đúng khách đó thì được, không cần bảng cấp quyền.
  if (template.visibility === 'exclusive'
    && identity.customerId
    && String(template.owner_customer_id) === String(identity.customerId)) {
    return { allowed: true, template, identity };
  }

  const keys = granteeKeysOf(identity);
  if (keys.length) {
    const granted = await TemplatePermission.findOne({
      where: {
        template_id: template.id,
        enabled: true,
        [Op.or]: keys.map((k) => ({ grantee_type: k.grantee_type, grantee_id: k.grantee_id })),
      },
    });
    if (granted) return { allowed: true, template, identity };
  }

  return { allowed: false, reason: 'Bạn không có quyền dùng mẫu thiệp này', template };
};

// Bản ném lỗi, tiện gọi trong service khác.
const assertCanUseTemplate = async (templateId, actor) => {
  const r = await canUseTemplate(templateId, actor);
  if (!r.allowed) {
    // Trả 404 thay vì 403 cho mẫu độc quyền/giới hạn: không tiết lộ là mẫu có tồn tại.
    const e = new Error(r.reason);
    e.status = r.reason === 'Mẫu không tồn tại' ? 404 : 403;
    throw e;
  }
  return r.template;
};

module.exports.granteeKeysOf = granteeKeysOf;
module.exports.buildVisibilityWhere = buildVisibilityWhere;
module.exports.canUseTemplate = canUseTemplate;
module.exports.assertCanUseTemplate = assertCanUseTemplate;
