// Công cụ dùng chung cho việc phân quyền theo chủ sở hữu + lọc query an toàn.
//
// Lỗi hệ thống trước đây: các service CRUD nhận thẳng `req.query` làm mệnh đề WHERE
// và `getById/remove` không kiểm chủ sở hữu -> bất kỳ tài khoản nào cũng đọc/xoá
// được dữ liệu của người khác (IDOR) và làm sập request bằng cột không tồn tại.

const { isUuid } = require('../utils/isUuid');

const isAdmin = (actor) => Boolean(actor && actor.role === 'admin');
const actorId = (actor) => (actor && typeof actor === 'object' ? actor.id : actor);

const forbidden = (message = 'Bạn không có quyền với dữ liệu này') => {
  const e = new Error(message);
  e.status = 403;
  return e;
};

const unauthorized = (message = 'Cần đăng nhập') => {
  const e = new Error(message);
  e.status = 401;
  return e;
};

const notFound = (resource = 'Bản ghi') => {
  const e = new Error(`${resource} không tồn tại`);
  e.status = 404;
  return e;
};

// Chỉ giữ lại các khoá nằm trong danh sách trắng và bỏ giá trị rỗng.
// Trả về object dùng làm `where` an toàn: cột lạ bị loại (không còn 500), và
// người dùng không tự chèn được điều kiện lọc sang dữ liệu của người khác.
const pickFilters = (query = {}, allowed = []) => {
  const out = {};
  const allow = new Set(allowed);
  for (const [key, value] of Object.entries(query)) {
    if (!allow.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    // Chặn object/array lồng nhau ({"$gt": ...}) — chỉ nhận giá trị vô hướng.
    if (typeof value === 'object') continue;
    out[key] = value;
  }
  return out;
};

// Phân trang an toàn: chặn limit khổng lồ (né việc kéo cả bảng trong 1 request).
const pagination = (query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const rawLimit = Number.parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
};

// Bắt buộc actor là chủ sở hữu bản ghi (hoặc admin).
const assertOwner = (record, actor, { ownerField = 'users_id', message } = {}) => {
  if (isAdmin(actor)) return record;
  const uid = actorId(actor);
  if (!uid) throw unauthorized();
  const owner = record ? record[ownerField] : null;
  // Bản ghi cũ không gắn chủ sở hữu: chỉ admin được đụng vào, tránh ai cũng sửa được.
  if (!owner) throw forbidden(message);
  if (String(owner) !== String(uid)) throw forbidden(message);
  return record;
};

// Ghép điều kiện "chỉ dữ liệu của tôi" vào where (admin thì bỏ qua).
const scopeToOwner = (where, actor, { ownerField = 'users_id' } = {}) => {
  if (isAdmin(actor)) return where;
  const uid = actorId(actor);
  if (!uid) throw unauthorized();
  // Ghi đè sau cùng: dù client có gửi users_id khác thì vẫn bị ép về chính mình.
  return { ...where, [ownerField]: uid };
};

// Chặn sớm id không phải UUID: tránh Postgres ném lỗi kiểu -> 500.
const assertUuid = (id, resource = 'Bản ghi') => {
  if (!isUuid(id)) throw notFound(resource);
  return id;
};

module.exports = {
  isAdmin,
  actorId,
  forbidden,
  unauthorized,
  notFound,
  pickFilters,
  pagination,
  assertOwner,
  scopeToOwner,
  assertUuid,
};
