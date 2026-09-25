'use strict';
// Kho nhạc: bài chung / bài riêng / tắt / xoá.
//
// Điểm cần chắc: TẮT khác XOÁ. Tắt chỉ ẩn khỏi danh sách chọn, thiệp cũ vẫn phát
// được. Xoá mới gỡ tệp — nên xoá bài đang có thiệp dùng phải bị chặn.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const music = require('../src/services/musicLibraryService');

test('VISIBILITIES/STATUSES đúng bộ giá trị cho phép', () => {
  assert.deepEqual(music.VISIBILITIES, ['public', 'exclusive']);
  assert.deepEqual(music.STATUSES, ['active', 'disabled']);
});

test('normalizeMeta: từ chối tên rỗng', async () => {
  await assert.rejects(() => music.normalizeMeta({ title: '   ' }), /không được để trống/);
});

test('normalizeMeta: từ chối trạng thái lạ', async () => {
  await assert.rejects(() => music.normalizeMeta({ status: 'xoa-roi' }), /active hoặc disabled/);
});

test('normalizeMeta: từ chối mức dùng lạ', async () => {
  await assert.rejects(() => music.normalizeMeta({ visibility: 'restricted' }), /public hoặc exclusive/);
});

test('normalizeMeta: bài riêng bắt buộc chọn khách hàng', async () => {
  await assert.rejects(() => music.normalizeMeta({ visibility: 'exclusive' }), /phải chọn đúng 1 khách hàng/);
});

test('normalizeMeta: chuyển về bài chung thì bỏ chủ sở hữu', async () => {
  const r = await music.normalizeMeta(
    { visibility: 'public' },
    { visibility: 'exclusive', owner_customer_id: 'ai-do' }
  );
  assert.equal(r.visibility, 'public');
  assert.equal(r.owner_customer_id, null);
});

test('normalizeMeta: cắt tên quá dài, không để tràn cột', async () => {
  const r = await music.normalizeMeta({ title: 'x'.repeat(400) });
  assert.equal(r.title.length, 250);
});

test('normalizeMeta: không gửi gì thì không đụng vào trường nào', async () => {
  assert.deepEqual(await music.normalizeMeta({}), {});
});

// ---- Lọc theo quyền: bài riêng của người khác KHÔNG được lọt ra ----
//
// Đây mới là chốt chặn thật. Giao diện có lọc hay không không quan trọng —
// gọi thẳng API vẫn phải không thấy bài riêng của khách khác.
const { MusicTrack } = require('../src/models');

const whereCua = async (opts) => {
  // buildWhere là hàm nội bộ; soi qua truy vấn mà list() dựng ra.
  let bat = null;
  const cu = MusicTrack.findAll;
  MusicTrack.findAll = async (o) => { bat = o.where; return []; };
  try { await music.list(opts); } finally { MusicTrack.findAll = cu; }
  return bat;
};

test('khách thường chỉ thấy bài đang BẬT', async () => {
  const w = await whereCua({ customerId: 'kh-1', isAdmin: false });
  assert.equal(w.status, 'active');
});

test('khách thường thấy bài chung + bài riêng CỦA MÌNH', async () => {
  const w = await whereCua({ customerId: 'kh-1', isAdmin: false });
  const nhanh = w[Op.or];
  assert.ok(Array.isArray(nhanh) && nhanh.length === 2);
  assert.deepEqual(nhanh[0], { visibility: 'public' });
  assert.deepEqual(nhanh[1], { visibility: 'exclusive', owner_customer_id: 'kh-1' });
});

test('khách chưa gắn hồ sơ khách hàng chỉ thấy bài chung', async () => {
  const w = await whereCua({ customerId: null, isAdmin: false });
  assert.deepEqual(w[Op.or], [{ visibility: 'public' }]);
});

test('điều kiện lọc dùng Symbol nên Object.keys rỗng — phải đọc bằng Reflect.ownKeys', async () => {
  // Bẫy đã mắc một lần ở phần phân quyền mẫu thiệp: kiểm "where có rỗng không"
  // bằng Object.keys thì nhánh Op.or biến mất, lộ hết dữ liệu riêng tư.
  const w = await whereCua({ customerId: 'kh-1', isAdmin: false });
  assert.ok(Reflect.ownKeys(w).length > Object.keys(w).length);
});

test('admin thấy hết, không bị lọc theo chủ sở hữu', async () => {
  const w = await whereCua({ customerId: null, isAdmin: true });
  assert.equal(w[Op.or], undefined);
});

// ---- Nhạc riêng của khách: không mượn được của người khác ----
const { assertOwnMusic } = require('../src/services/invitationService');

const CHU = 'user-A';

test('setMusic: nhạc của CHÍNH chủ thiệp thì nhận', () => {
  const ds = ['/uploads/music/' + CHU + '/bai-cua-toi.mp3'];
  assert.deepEqual(assertOwnMusic(ds, CHU), ds);
});

test('setMusic: chặn nhạc thuộc tài khoản KHÁC', () => {
  assert.throws(
    () => assertOwnMusic(['/uploads/music/user-B/bai-nguoi-khac.mp3'], CHU),
    (e) => e.status === 403 && /không thuộc tài khoản này/i.test(e.message)
  );
});

test('setMusic: chặn cả khi trộn lẫn bài hợp lệ', () => {
  assert.throws(() => assertOwnMusic([
    '/uploads/music/' + CHU + '/cua-toi.mp3',
    '/uploads/music/user-B/cua-ho.mp3',
  ], CHU), (e) => e.status === 403);
});

test('setMusic: không chặn nhầm tài khoản có id bắt đầu giống nhau', () => {
  // user-A vs user-AB: so chuỗi mà quên dấu / ở cuối là user-AB lọt qua.
  assert.throws(
    () => assertOwnMusic(['/uploads/music/user-AB/x.mp3'], CHU),
    (e) => e.status === 403
  );
});

test('setMusic: kho nhạc chung và link ngoài không bị luật này đụng tới', () => {
  const ds = ['/media/music/bai-he-thong.mp3', 'https://cdn.abc.com/nhac.mp3'];
  assert.deepEqual(assertOwnMusic(ds, CHU), ds);
});

test('setMusic: danh sách rỗng hoặc thiếu -> không ném lỗi', () => {
  assert.deepEqual(assertOwnMusic([], CHU), []);
  assert.equal(assertOwnMusic(null, CHU), null);
});
