// Quyen sua tai cho: bo loc truong phai dung o TANG DICH VU, khong chi o giao dien.
// Giao dien co the bi sua bang DevTools, nen day moi la cho chot.
const test = require('node:test');
const assert = require('node:assert');
const catalog = require('../src/services/themeConverter/fieldCatalog');

test('sanitizeEditable: null = dung bo mac dinh cua he thong', () => {
  assert.strictEqual(catalog.sanitizeEditable(null), null);
  assert.strictEqual(catalog.sanitizeEditable(undefined), null);
});

test('sanitizeEditable: bo cac key khong co trong danh muc', () => {
  const r = catalog.sanitizeEditable(['groom_name', 'khong_ton_tai', 'bride_name']);
  assert.deepStrictEqual(r, ['groom_name', 'bride_name']);
});

test('sanitizeEditable: KHONG cho mo o ngan hang du admin co gui len', () => {
  const r = catalog.sanitizeEditable([
    'groom_name', 'groom.bank_account_number', 'bride.bank_name', 'groom.bank_account_name',
  ]);
  assert.deepStrictEqual(r, ['groom_name']);
});

test('sanitizeEditable: bo trung lap', () => {
  const r = catalog.sanitizeEditable(['groom_name', 'groom_name', 'bride_name']);
  assert.deepStrictEqual(r, ['groom_name', 'bride_name']);
});

test('sanitizeEditable: mang rong = khong cho sua o nao', () => {
  assert.deepStrictEqual(catalog.sanitizeEditable([]), []);
});

test('sanitizeEditable: kieu du lieu la -> coi nhu khong dat', () => {
  assert.strictEqual(catalog.sanitizeEditable('groom_name'), null);
  assert.strictEqual(catalog.sanitizeEditable({ a: 1 }), null);
});

test('resolveEditable: null -> bo mac dinh, va bo mac dinh khong chua o ngan hang', () => {
  const r = catalog.resolveEditable(null);
  assert.ok(r.length > 10, 'bo mac dinh phai co nhieu o');
  for (const k of catalog.NEVER_EDITABLE) {
    assert.ok(!r.includes(k), `bo mac dinh khong duoc chua ${k}`);
  }
});

test('resolveEditable: mang rong KHAC null — rong la khoa het, khong phai ve mac dinh', () => {
  assert.deepStrictEqual(catalog.resolveEditable([]), []);
  assert.notDeepStrictEqual(catalog.resolveEditable([]), catalog.resolveEditable(null));
});

test('resolveEditable: van chan o ngan hang ke ca khi DB da lo luu', () => {
  const r = catalog.resolveEditable(['groom_name', 'groom.bank_account_number']);
  assert.deepStrictEqual(r, ['groom_name']);
});

test('NEVER_EDITABLE dung la 6 o tai khoan ngan hang', () => {
  assert.deepStrictEqual([...catalog.NEVER_EDITABLE].sort(), [
    'bride.bank_account_name', 'bride.bank_account_number', 'bride.bank_name',
    'groom.bank_account_name', 'groom.bank_account_number', 'groom.bank_name',
  ].sort());
});

// ---- Luat anh: cho doi anh / cho tai them / toi da bao nhieu ----
const { sanitizeImageRules } = require('../src/services/templateAdminService');

test('sanitizeImageRules: bo o anh khong co trong danh muc', () => {
  assert.strictEqual(sanitizeImageRules({ khong_ton_tai: { allow_change: true } }), null);
});

test('sanitizeImageRules: o anh don khong nhan luat "tai them"', () => {
  const r = sanitizeImageRules({ cover: { allow_change: false, allow_add: true, max: 9 } });
  assert.deepStrictEqual(r, { cover: { allow_change: false } });
});

test('sanitizeImageRules: album nhan du 3 luat', () => {
  const r = sanitizeImageRules({ gallery: { allow_change: true, allow_add: false, max: 12 } });
  assert.deepStrictEqual(r, { gallery: { allow_change: true, allow_add: false, max: 12 } });
});

test('sanitizeImageRules: ep so anh toi da ve trong khoang cho phep', () => {
  const { IMAGE_SLOTS } = catalog;
  const tran = IMAGE_SLOTS.gallery.max || 20;
  assert.strictEqual(sanitizeImageRules({ gallery: { max: 9999 } }).gallery.max, tran);
  assert.strictEqual(sanitizeImageRules({ gallery: { max: -5 } }).gallery.max, 1);
  assert.strictEqual(sanitizeImageRules({ gallery: { max: 'abc' } }), null);
});

test('sanitizeImageRules: khong co gi hop le -> null (dung bo mac dinh)', () => {
  assert.strictEqual(sanitizeImageRules(null), null);
  assert.strictEqual(sanitizeImageRules({}), null);
  assert.strictEqual(sanitizeImageRules('x'), null);
});
