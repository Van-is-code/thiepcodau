// Kho nhạc.
//
// Ba loại bài cùng nằm chung một danh sách:
//   - bài CHUNG  (visibility=public)     mọi khách chọn được
//   - bài RIÊNG  (visibility=exclusive)  chỉ đúng 1 khách hàng thấy
//   - bài của chính khách tự tải lên     nằm ở uploads/music/<user_id>/, không vào bảng này
//
// Tắt khác xoá: TẮT chỉ ẩn khỏi danh sách chọn, thiệp cũ đang dùng bài đó VẪN
// PHÁT BÌNH THƯỜNG vì tệp còn nguyên. XOÁ mới gỡ tệp — thiệp cũ mất nhạc.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { MusicTrack, Customer } = require('../models');
const auditService = require('./auditService');

const MUSIC_DIR = path.join(process.cwd(), 'media', 'music');
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);
const VISIBILITIES = ['public', 'exclusive'];
const STATUSES = ['active', 'disabled'];

const bad = (message, status = 400) => { const e = new Error(message); e.status = status; return e; };

const ensureDir = () => {
  if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
};

const publicTrack = (t, extra = {}) => ({
  id: t.id,
  title: t.title,
  artist: t.artist || null,
  url: t.url,
  source: t.source,
  visibility: t.visibility || 'public',
  owner_customer_id: t.owner_customer_id || null,
  status: t.status || 'active',
  bytes: t.bytes != null ? Number(t.bytes) : null,
  duration_seconds: t.duration_seconds != null ? Number(t.duration_seconds) : null,
  sort_order: t.sort_order || 0,
  created_at: t.created_at,
  ...extra,
});

// Bài nào KHÁCH NÀY được chọn.
//
// Admin thì thấy hết, kể cả bài đã tắt — để còn quản lý. Khách thường chỉ thấy
// bài đang bật, và trong số bài riêng thì chỉ thấy bài của chính mình.
const buildWhere = ({ customerId = null, isAdmin = false, includeDisabled = false } = {}) => {
  const where = {};
  if (!isAdmin || !includeDisabled) where.status = 'active';
  if (isAdmin) return where;

  where[Op.or] = customerId
    ? [{ visibility: 'public' }, { visibility: 'exclusive', owner_customer_id: customerId }]
    : [{ visibility: 'public' }];
  return where;
};

// Danh sách cho KHÁCH chọn.
//
// Vẫn gom cả tệp nhạc thả tay vào thư mục media/music mà chưa có bản ghi — cách
// cũ vẫn dùng được, không bắt ai phải nhập lại. Nhưng tệp thả tay không có chủ
// nên luôn coi là bài chung.
const list = async ({ customerId = null, isAdmin = false } = {}) => {
  const rows = await MusicTrack.findAll({
    where: buildWhere({ customerId, isAdmin }),
    order: [['sort_order', 'ASC'], ['created_at', 'DESC']],
  });
  const daBiet = new Set(rows.filter((r) => r.source === 'file').map((r) => path.basename(r.url)));

  const theoThuMuc = [];
  if (fs.existsSync(MUSIC_DIR)) {
    for (const name of fs.readdirSync(MUSIC_DIR)) {
      if (!AUDIO_EXT.has(path.extname(name).toLowerCase())) continue;
      if (daBiet.has(name)) continue;
      theoThuMuc.push({
        id: 'folder:' + name,
        title: name.replace(/\.[^.]+$/, ''),
        artist: null,
        url: '/media/music/' + name,
        source: 'file',
        visibility: 'public',
        owner_customer_id: null,
        status: 'active',
        bytes: null,
        duration_seconds: null,
        sort_order: 999,
        created_at: null,
      });
    }
  }

  return [...rows.map((r) => publicTrack(r)), ...theoThuMuc];
};

// Danh sách QUẢN TRỊ: thấy hết, kèm tên chủ sở hữu của bài riêng.
const listForAdmin = async ({ search, status, visibility } = {}) => {
  const where = {};
  if (status && STATUSES.includes(status)) where.status = status;
  if (visibility && VISIBILITIES.includes(visibility)) where.visibility = visibility;
  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: '%' + search + '%' } },
      { artist: { [Op.iLike]: '%' + search + '%' } },
    ];
  }

  const rows = await MusicTrack.findAll({ where, order: [['sort_order', 'ASC'], ['created_at', 'DESC']] });

  const ids = rows.map((r) => r.owner_customer_id).filter(Boolean);
  const ten = {};
  if (ids.length) {
    const kh = await Customer.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name'] });
    for (const c of kh) ten[String(c.id)] = c.name;
  }

  return rows.map((r) => publicTrack(r, {
    owner_customer_name: r.owner_customer_id ? (ten[String(r.owner_customer_id)] || null) : null,
  }));
};

// Kiểm tham số chung cho cả thêm lẫn sửa. Tách riêng để kiểm thử được mà không
// cần CSDL.
const normalizeMeta = async (body = {}, truoc = {}) => {
  const out = {};

  if (body.title !== undefined) {
    const t = String(body.title || '').trim();
    if (!t) throw bad('Tên bài hát không được để trống');
    out.title = t.slice(0, 250);
  }
  if (body.artist !== undefined) {
    out.artist = body.artist ? String(body.artist).trim().slice(0, 250) : null;
  }
  if (body.sort_order !== undefined) {
    out.sort_order = Number.parseInt(body.sort_order, 10) || 0;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw bad('Trạng thái chỉ nhận active hoặc disabled');
    out.status = body.status;
  }

  if (body.visibility !== undefined) {
    if (!VISIBILITIES.includes(body.visibility)) throw bad('Mức dùng chỉ nhận public hoặc exclusive');
    out.visibility = body.visibility;
  }

  const visSau = out.visibility || truoc.visibility || 'public';
  if (visSau === 'exclusive') {
    const chu = body.owner_customer_id !== undefined ? body.owner_customer_id : truoc.owner_customer_id;
    if (!chu) throw bad('Bài riêng phải chọn đúng 1 khách hàng');
    const kh = await Customer.findByPk(chu);
    if (!kh) throw bad('Không tìm thấy khách hàng được chọn', 404);
    out.owner_customer_id = chu;
  } else if (body.visibility === 'public' || body.owner_customer_id === null) {
    // Chuyển về bài chung thì bỏ chủ sở hữu, không để sót gây hiểu nhầm.
    out.owner_customer_id = null;
  }

  return out;
};

const addLink = async ({ title, url, ...rest }, ctx = {}) => {
  if (!url || !/^https?:\/\//i.test(String(url))) throw bad('Link nhạc không hợp lệ');
  const meta = await normalizeMeta({ title: title || String(url).split('/').pop() || 'Nhạc nền', ...rest });

  const row = await MusicTrack.create({
    id: randomUUID(),
    url: String(url).trim(),
    source: 'link',
    created_by: ctx.adminUserId || null,
    created_at: new Date(),
    updated_at: new Date(),
    ...meta,
  });
  await auditService.log({
    actorType: 'admin', actorId: ctx.adminUserId || null,
    action: 'music.add', entityType: 'music_track', entityId: row.id,
    newValue: { title: row.title, visibility: row.visibility, source: 'link' }, ip: ctx.ip || null,
  });
  return publicTrack(row);
};

const addFile = async ({ buffer, safeExt, originalname, title, ...rest }, ctx = {}) => {
  if (!buffer || !buffer.length) throw bad('Chưa có file nhạc');

  // Đuôi tệp lấy từ magic bytes (uploadGuard gắn vào file.safeExt), KHÔNG lấy từ
  // tên người dùng đặt: "nhac.html" đổi đuôi lên rồi phục vụ tĩnh là XSS lưu trữ.
  const ext = AUDIO_EXT.has(String(safeExt || '').toLowerCase())
    ? String(safeExt).toLowerCase()
    : null;
  if (!ext) throw bad('Chỉ nhận file .mp3/.wav/.ogg/.m4a/.aac/.flac');

  const meta = await normalizeMeta({
    title: title || String(originalname || '').replace(/\.[^.]+$/, '') || 'Nhạc nền',
    ...rest,
  });

  ensureDir();
  const fname = Date.now() + '-' + randomUUID().slice(0, 8) + ext;
  fs.writeFileSync(path.join(MUSIC_DIR, fname), buffer);

  const row = await MusicTrack.create({
    id: randomUUID(),
    url: '/media/music/' + fname,
    source: 'file',
    bytes: buffer.length,
    storage_key: 'media/music/' + fname,
    created_by: ctx.adminUserId || null,
    created_at: new Date(),
    updated_at: new Date(),
    ...meta,
  });
  await auditService.log({
    actorType: 'admin', actorId: ctx.adminUserId || null,
    action: 'music.add', entityType: 'music_track', entityId: row.id,
    newValue: { title: row.title, visibility: row.visibility, source: 'file', bytes: buffer.length },
    ip: ctx.ip || null,
  });
  return publicTrack(row);
};

const update = async (id, body = {}, ctx = {}) => {
  const track = await MusicTrack.findByPk(id);
  if (!track) throw bad('Không tìm thấy bản nhạc', 404);

  const truoc = { visibility: track.visibility, owner_customer_id: track.owner_customer_id, status: track.status };
  const meta = await normalizeMeta(body, truoc);

  await track.update({ ...meta, updated_at: new Date() });
  await auditService.log({
    actorType: 'admin', actorId: ctx.adminUserId || null,
    action: 'music.update', entityType: 'music_track', entityId: track.id,
    oldValue: truoc,
    newValue: { visibility: track.visibility, owner_customer_id: track.owner_customer_id, status: track.status },
    ip: ctx.ip || null,
  });
  return publicTrack(track);
};

// Đếm số thiệp đang dùng bài này — để cảnh báo TRƯỚC khi xoá.
//
// Nhạc lưu trong music_url và trong extra_data.music_playlist, nên phải soi cả
// hai chỗ; chỉ đếm music_url thôi là báo 0 rồi xoá, xong thiệp mất nhạc.
const countUsage = async (url) => {
  const { sequelize } = require('../models');
  const [rows] = await sequelize.query(
    `SELECT COUNT(*)::int AS n FROM invitations
      WHERE music_url = :url
         OR extra_data->'music_playlist' @> to_jsonb(ARRAY[:url]::text[])`,
    { replacements: { url } }
  );
  return (rows && rows[0] && rows[0].n) || 0;
};

const remove = async (id, { force = false, ...ctx } = {}) => {
  // Tệp thả tay vào thư mục, chưa có bản ghi.
  if (String(id).startsWith('folder:')) {
    const name = String(id).slice(7);
    // Chỉ nhận TÊN TỆP trần. path.basename cắt sạch phần thư mục nên
    // "../music-secret/x.mp3" chỉ còn "x.mp3".
    const safeName = path.basename(name);
    if (!AUDIO_EXT.has(path.extname(safeName).toLowerCase())) throw bad('Chỉ xoá được tệp nhạc');
    const p = path.resolve(MUSIC_DIR, safeName);
    // Thiếu dấu phân cách ở đây thì mọi thư mục ANH EM tên bắt đầu bằng "music"
    // đều lọt (media/music-secret/...).
    if (!p.startsWith(MUSIC_DIR + path.sep)) throw bad('Đường dẫn không hợp lệ');
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { deleted: true, usage: 0 };
  }

  const track = await MusicTrack.findByPk(id);
  if (!track) throw bad('Không tìm thấy bản nhạc', 404);

  // Xoá bài đang có thiệp dùng là thiệp đó mất nhạc, không khôi phục được.
  // Muốn ngừng cho chọn thì TẮT, đừng xoá.
  const usage = await countUsage(track.url);
  if (usage > 0 && !force) {
    const e = new Error(
      `Có ${usage} thiệp đang dùng bài này. Hãy TẮT bài (thiệp cũ vẫn phát được) `
      + 'thay vì xoá, hoặc xác nhận xoá hẳn nếu chắc chắn.'
    );
    e.status = 409;
    e.details = { usage };
    throw e;
  }

  if (track.source === 'file') {
    const p = path.join(process.cwd(), String(track.url).replace(/^\//, ''));
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_e) { /* tệp đã mất thì thôi */ }
  }
  await track.destroy();
  await auditService.log({
    actorType: 'admin', actorId: ctx.adminUserId || null,
    action: 'music.delete', entityType: 'music_track', entityId: String(id),
    oldValue: { title: track.title, url: track.url, usage }, ip: ctx.ip || null,
  });
  return { deleted: true, usage };
};

module.exports = {
  list, listForAdmin, addLink, addFile, update, remove, countUsage,
  normalizeMeta, publicTrack, VISIBILITIES, STATUSES, MUSIC_DIR, AUDIO_EXT,
};
