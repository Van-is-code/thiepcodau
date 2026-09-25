const musicLibraryService = require('../services/musicLibraryService');
const { Customer } = require('../models');
const { actorFromReq } = require('../services/auditService');

const ctxOf = (req) => {
  const a = actorFromReq(req);
  return { adminUserId: a.actorId || req.user?.id || null, ip: a.ip || null };
};
const fail = (res, e, mac) => res.status(e.status || 500)
  .json({ success: false, message: e.message || mac, ...(e.details ? { data: e.details } : {}) });

// Khách đang đăng nhập ứng với khách hàng nào. Cần để biết bài RIÊNG nào họ được
// thấy. Không tìm ra thì coi như không có -> chỉ thấy bài chung.
const customerIdOf = async (req) => {
  if (!req.user?.id) return null;
  const kh = await Customer.findOne({ where: { user_id: req.user.id }, attributes: ['id'] }).catch(() => null);
  return kh ? kh.id : null;
};

// GET /api/music-library — danh sách bài KHÁCH NÀY được chọn.
const list = async (req, res) => {
  try {
    const data = await musicLibraryService.list({
      customerId: await customerIdOf(req),
      isAdmin: req.user?.role === 'admin',
    });
    return res.status(200).json({ success: true, message: 'OK', data });
  } catch (error) { return fail(res, error, 'Lỗi lấy kho nhạc'); }
};

// GET /api/admin/music-library — danh sách quản trị, thấy cả bài đã tắt.
const listAdmin = async (req, res) => {
  try {
    const data = await musicLibraryService.listForAdmin({
      search: req.query.search, status: req.query.status, visibility: req.query.visibility,
    });
    return res.status(200).json({ success: true, message: 'OK', data });
  } catch (error) { return fail(res, error, 'Lỗi lấy kho nhạc'); }
};

// POST — multipart field "file" để tải tệp, hoặc JSON { url } để thêm link.
const add = async (req, res) => {
  try {
    const ctx = ctxOf(req);
    const chung = {
      title: req.body.title,
      artist: req.body.artist,
      visibility: req.body.visibility,
      owner_customer_id: req.body.owner_customer_id || null,
      sort_order: req.body.sort_order,
    };
    const data = req.file
      ? await musicLibraryService.addFile({
        buffer: req.file.buffer,
        safeExt: req.file.safeExt,
        originalname: req.file.originalname,
        ...chung,
      }, ctx)
      : await musicLibraryService.addLink({ url: req.body.url, ...chung }, ctx);
    return res.status(201).json({ success: true, message: 'Đã thêm vào kho nhạc', data });
  } catch (error) { return fail(res, error, 'Thêm nhạc thất bại'); }
};

const update = async (req, res) => {
  try {
    const data = await musicLibraryService.update(req.params.id, req.body || {}, ctxOf(req));
    return res.status(200).json({ success: true, message: 'Đã cập nhật', data });
  } catch (error) { return fail(res, error, 'Cập nhật nhạc thất bại'); }
};

// Bao nhiêu thiệp đang dùng bài này — giao diện hỏi trước khi cho bấm xoá.
const usage = async (req, res) => {
  try {
    const { MusicTrack } = require('../models');
    const t = await MusicTrack.findByPk(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: 'Không tìm thấy bản nhạc' });
    const n = await musicLibraryService.countUsage(t.url);
    return res.status(200).json({ success: true, message: 'OK', data: { usage: n } });
  } catch (error) { return fail(res, error, 'Không đếm được'); }
};

const remove = async (req, res) => {
  try {
    const data = await musicLibraryService.remove(req.params.id, {
      force: String(req.query.force) === 'true',
      ...ctxOf(req),
    });
    return res.status(200).json({ success: true, message: 'Đã xoá bản nhạc', data });
  } catch (error) { return fail(res, error, 'Xoá nhạc thất bại'); }
};

module.exports = { list, listAdmin, add, update, usage, remove };
