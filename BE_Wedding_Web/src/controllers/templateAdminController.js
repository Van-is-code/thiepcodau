const templateAdminService = require('../services/templateAdminService');
const { convertThemeZip } = require('../services/themeConverter/packager');
const catalog = require('../services/themeConverter/fieldCatalog');
const previewService = require('../services/templatePreviewService');
const { actorFromReq } = require('../services/auditService');

const ctxOf = (req) => {
  const a = actorFromReq(req);
  return { adminUserId: a.actorId || req.user?.id || null, ip: a.ip || null };
};
const ok = (res, data, message = 'Thành công', status = 200) => res.status(status).json({ success: true, message, data });
const fail = (res, e) => res.status(e.status || 500).json({ success: false, message: e.message || 'Thao tác thất bại' });

// Tham số overrides đi qua multipart nên là chuỗi JSON.
// Tham số gửi qua multipart nên là chuỗi — đọc về đúng kiểu.
const parseJson = (raw) => {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (_e) {
    const e = new Error('Tham số phải là JSON hợp lệ'); e.status = 400; throw e;
  }
};
const parseList = (raw) => {
  const v = parseJson(raw);
  return Array.isArray(v) ? v : null;
};

// Danh mục trường + bộ mặc định — giao diện cần để dựng bảng tích chọn, dùng
// chung cho cả lúc xem trước lẫn lúc sửa quyền của mẫu đã nhập.
const catalogPayload = () => ({
  fields: Object.entries(catalog.ALL_FIELDS).map(([key, m]) => ({ key, ...m })),
  image_slots: Object.entries(catalog.IMAGE_SLOTS).map(([key, m]) => ({ key, ...m })),
  default_editable: catalog.DEFAULT_EDITABLE,
  never_editable: catalog.NEVER_EDITABLE,
});

const parseOverrides = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_e) {
    const e = new Error('Trường overrides phải là JSON hợp lệ'); e.status = 400; throw e;
  }
};

// XEM TRƯỚC: chuyển theme rồi DỰNG THẬT ra thư mục tạm để admin mở xem.
//
// Trả về cả đường dẫn xem trước lẫn báo cáo + danh mục trường, để giao diện vừa
// hiện thiệp thật vừa cho tích chọn quyền sửa ngay trên đó.
const previewTheme = async (req, res) => {
  try {
    const out = previewService.stage(req.file.buffer, {
      entryFile: req.body.entry_file || undefined,
      overrides: parseOverrides(req.body.overrides),
      minConfidence: req.body.min_confidence ? Number(req.body.min_confidence) : undefined,
    });
    return ok(res, {
      preview_token: out.token,
      preview_path: out.previewPath,
      expires_at: out.expiresAt,
      entry_file: out.entryName,
      manifest: out.manifest,
      report: out.report,
      // Danh mục + bộ mặc định để giao diện dựng bảng tích chọn.
      catalog: catalogPayload(),
    }, 'Đã dựng bản xem trước');
  } catch (e) { return fail(res, e); }
};

// Bỏ bản xem trước khi admin đóng hộp thoại (không đợi hết hạn mới dọn).
const discardPreview = async (req, res) => {
  try { return ok(res, previewService.discard(req.params.token), 'Đã bỏ bản xem trước'); }
  catch (e) { return fail(res, e); }
};

const importTheme = async (req, res) => {
  try {
    const { adminUserId, ip } = ctxOf(req);

    // Đã xem trước rồi thì dùng lại gói đã dựng — không bắt admin tải lên lại
    // hàng chục MB chỉ để đổi vài ô tích chọn.
    const buffer = req.body.preview_token
      ? previewService.repack(req.body.preview_token)
      : (req.file && req.file.buffer);
    if (!buffer) throw Object.assign(new Error('Chưa chọn tệp theme'), { status: 400 });

    const data = await templateAdminService.importTheme({
      buffer,
      templateCode: req.body.template_code,
      templateName: req.body.template_name,
      description: req.body.description,
      entryFile: req.body.entry_file || undefined,
      visibility: req.body.visibility || 'public',
      ownerCustomerId: req.body.owner_customer_id || null,
      overrides: parseOverrides(req.body.overrides),
      minConfidence: req.body.min_confidence ? Number(req.body.min_confidence) : undefined,
      editableFields: parseList(req.body.editable_fields),
      imageSlotRules: parseJson(req.body.image_slot_rules),
      adminUserId, ip,
    });
    // Nhập xong thì bản tạm không cần nữa.
    if (req.body.preview_token) {
      try { previewService.discard(req.body.preview_token); } catch (_e) { /* để TTL dọn */ }
    }
    return ok(res, data, 'Đã nhập theme thành mẫu thiệp (đang ở trạng thái nháp)', 201);
  } catch (e) { return fail(res, e); }
};

const list = async (req, res) => {
  try { return ok(res, await templateAdminService.listForAdmin(req.query), 'Danh sách mẫu'); }
  catch (e) { return fail(res, e); }
};

const detail = async (req, res) => {
  try {
    const data = await templateAdminService.getDetail(req.params.id);
    return ok(res, { ...data, catalog: catalogPayload() }, 'Chi tiết mẫu');
  }
  catch (e) { return fail(res, e); }
};

const update = async (req, res) => {
  try { return ok(res, await templateAdminService.updateTemplate(req.params.id, req.body, ctxOf(req)), 'Đã cập nhật mẫu'); }
  catch (e) { return fail(res, e); }
};

const remove = async (req, res) => {
  try { return ok(res, await templateAdminService.deleteTemplate(req.params.id, ctxOf(req)), 'Đã xoá mẫu'); }
  catch (e) { return fail(res, e); }
};

const grant = async (req, res) => {
  try {
    const data = await templateAdminService.grantAccess(req.params.id, {
      granteeType: req.body.grantee_type,
      granteeId: req.body.grantee_id,
      note: req.body.note,
    }, ctxOf(req));
    return ok(res, data, 'Đã cấp quyền dùng mẫu', 201);
  } catch (e) { return fail(res, e); }
};

const toggleGrant = async (req, res) => {
  try {
    const data = await templateAdminService.setAccessEnabled(req.params.permissionId, req.body.enabled, ctxOf(req));
    return ok(res, data, data.enabled ? 'Đã bật quyền' : 'Đã tắt quyền');
  } catch (e) { return fail(res, e); }
};

const revoke = async (req, res) => {
  try { return ok(res, await templateAdminService.revokeAccess(req.params.permissionId, ctxOf(req)), 'Đã thu hồi quyền'); }
  catch (e) { return fail(res, e); }
};

module.exports = { previewTheme, discardPreview, importTheme, list, detail, update, remove, grant, toggleGrant, revoke };
