'use strict';
// Đẩy ảnh thẳng lên R2: client tự gửi KHOÁ TỆP lên, nên mọi giả định phải kiểm lại
// ở server. Đây là các đường lách đã nghĩ tới.
const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../src/services/storageService');

test('assertSafeKey: chặn thoát thư mục bằng ..', () => {
  assert.throws(() => storage.assertSafeKey('invitations/abc/../../etc/passwd'));
  assert.throws(() => storage.assertSafeKey('../secret'));
});

test('assertSafeKey: chặn khoá kiểu ổ đĩa Windows', () => {
  assert.throws(() => storage.assertSafeKey('C:/Windows/win.ini'));
  assert.throws(() => storage.assertSafeKey('d:/x'));
});

test('assertSafeKey: dấu / đầu bị bỏ chứ không phải lỗi (chuẩn hoá)', () => {
  assert.equal(storage.assertSafeKey('/etc/passwd'), 'etc/passwd');
  assert.equal(storage.assertSafeKey('//a/b'), 'a/b');
});

test('assertSafeKey: chặn ký tự điều khiển và dấu gạch ngược', () => {
  assert.throws(() => storage.assertSafeKey('a' + String.fromCharCode(0) + 'b'));
  assert.throws(() => storage.assertSafeKey('a' + String.fromCharCode(92) + 'b'));
});

test('assertSafeKey: nhận khoá hợp lệ', () => {
  const k = 'invitations/11111111-1111-1111-1111-111111111111/original/1-abc.jpg';
  assert.equal(storage.assertSafeKey(k), k);
});

test('presignUpload: chưa bật R2 thì từ chối, báo 503', async () => {
  const cu = process.env.STORAGE_DRIVER;
  process.env.STORAGE_DRIVER = 'local';
  try {
    await assert.rejects(
      () => storage.presignUpload('invitations/a/original/x.jpg', { contentType: 'image/jpeg' }),
      (e) => e.status === 503
    );
  } finally { process.env.STORAGE_DRIVER = cu; }
});

// ---- Kiểm tra khoá phải thuộc đúng thiệp ----
//
// attachFromStorage kiểm hình dạng khoá TRƯỚC khi hỏi CSDL, nên kiểm được mà
// không cần CSDL — và quan trọng hơn: chốt chặn này không phụ thuộc CSDL sống hay chết.
const svc = require('../src/services/invitationImageService');

const ACTOR = { id: 'u1', role: 'user' };
const INV = '11111111-1111-1111-1111-111111111111';
const KHAC = '22222222-2222-2222-2222-222222222222';

test('attach: khoá của thiệp KHÁC -> bị chặn', async () => {
    await assert.rejects(
      () => svc.attachFromStorage({
        invitation_id: INV,
        key: 'invitations/' + KHAC + '/original/1-abc.jpg',
      }, ACTOR),
      (e) => e.status === 400 && /không thuộc thiệp này/i.test(e.message)
    );
});

test('attach: khoá ngoài nhánh original/ -> bị chặn', async () => {
    // Nhánh variants là nơi ảnh ĐÃ xử lý nằm. Cho attach vào đó thì client tự
    // trỏ được tới tệp bất kỳ đã có sẵn trong kho.
    await assert.rejects(
      () => svc.attachFromStorage({
        invitation_id: INV,
        key: 'invitations/' + INV + '/1920/abc.avif',
      }, ACTOR),
      (e) => e.status === 400 && /không thuộc thiệp này/i.test(e.message)
    );
});

test('attach: khoá có .. -> bị chặn ngay ở bước làm sạch', async () => {
    await assert.rejects(
      () => svc.attachFromStorage({
        invitation_id: INV,
        key: 'invitations/' + INV + '/original/../../../etc/passwd',
      }, ACTOR)
    );
});

test('attach: thiếu khoá -> bị chặn', async () => {
    await assert.rejects(() => svc.attachFromStorage({ invitation_id: INV }, ACTOR));
});

test('attach: không có actor -> 401', async () => {
  await assert.rejects(
    () => svc.attachFromStorage({ invitation_id: INV, key: 'x' }, null),
    (e) => e.status === 401
  );
});
