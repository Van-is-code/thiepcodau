'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const AdmZip = require('adm-zip');
const { convert } = require('../src/services/themeConverter/annotate');
const { convertThemeZip } = require('../src/services/themeConverter/packager');
const catalog = require('../src/services/themeConverter/fieldCatalog');

const html = (body) => '<!DOCTYPE html><html><head><title>t</title></head><body>' + body + '</body></html>';

// NGUYÊN TẮC CỐT LÕI: thà bỏ sót còn hơn gắn sai. Gắn sai khiến dữ liệu thật của
// khách hiện nhầm chỗ — lỗi đó khó phát hiện vì thiệp nhìn vẫn "có chữ".
test('chỉ sinh ra trường nằm trong danh mục chuẩn', () => {
  const r = convert(html('<h1 class="hero-name groom">A</h1><p class="ceremony-venue-address">X</p>'));
  for (const f of r.applied.fields) {
    assert.ok(catalog.isKnownField(f.field), 'trường lạ: ' + f.field);
  }
  for (const i of r.applied.images) {
    assert.ok(catalog.isKnownImageSlot(i.slot), 'ô ảnh lạ: ' + i.slot);
  }
});

test('KHÔNG gắn vào ảnh trang trí (hoa lá, hoạ tiết, bướm)', () => {
  const r = convert(html(
    '<div class="gallery">'
    + '<img src="assets/images/botanical/hoa-cam-tu-cau.webp" alt="" aria-hidden="true">'
    + '<img src="assets/images/botanical/blue-butterfly.webp" alt="">'
    + '<img src="assets/images/couple/anh-cuoi.jpg" alt="Ảnh cưới">'
    + '</div>'
  ));
  assert.equal(r.applied.images.length, 1, 'chỉ ảnh cưới thật được gắn');
  assert.equal(r.applied.images[0].slot, 'gallery');
  assert.ok(r.skipped.some((s) => s.reason === 'anh-trang-tri'));
});

test('phân biệt nhà trai / nhà gái qua CHỮ trong khối, không chỉ qua class', () => {
  // Theme hay đặt class trung tính và chỉ phân biệt bằng tiêu đề chữ.
  const r = convert(html(
    '<div class="family-column"><h3>NHÀ TRAI</h3><p class="family-parent">Ông: Nguyễn Văn A</p></div>'
    + '<div class="family-column"><h3>NHÀ GÁI</h3><p class="family-parent">Ông: Trần Văn B</p></div>'
  ));
  const fields = r.applied.fields.map((f) => f.field);
  assert.ok(fields.includes('groom.father_grom'), 'phải nhận ra cha nhà trai');
  assert.ok(fields.includes('bride.father_bride'), 'phải nhận ra cha nhà gái');
});

test('KHÔNG đoán bừa khi không phân biệt được bên nào', () => {
  // Hai tên cạnh nhau, không có dấu hiệu nào nói ai là cô dâu ai là chú rể.
  const r = convert(html('<div><span class="card-name">An</span><span class="card-name">Bình</span></div>'));
  const fields = r.applied.fields.map((f) => f.field);
  assert.ok(!fields.includes('groom_short_name') && !fields.includes('bride_short_name'),
    'thà bỏ sót còn hơn gán nhầm tên cô dâu thành chú rể');
  // Nhưng phải báo lên để người duyệt map tay.
  assert.ok(r.unmapped.some((u) => u.sample.includes('An') || u.sample.includes('Bình')));
});

test('ô chủ tài khoản KHÔNG bị nhầm thành tên cô dâu chú rể', () => {
  // Hai thứ này thường trùng tên nên gắn nhầm rất khó phát hiện — cho tới khi tài
  // khoản đứng tên bố mẹ.
  const r = convert(html(
    '<div id="gift-panel-groom"><div class="bank-slip-field">'
    + '<span class="bank-slip-label">CHỦ TÀI KHOẢN</span>'
    + '<span class="bank-slip-value slip-name">TRAN VAN A</span>'
    + '</div></div>'
  ));
  const f = r.applied.fields.find((x) => x.sample.includes('TRAN VAN A'));
  assert.ok(f, 'phải nhận ra ô này');
  assert.equal(f.field, 'groom.bank_account_name');
});

test('trường ngân hàng được gắn data-readonly (sửa qua panel quét QR)', () => {
  const r = convert(html(
    '<div id="gift-panel-bride"><span class="bank-slip-value slip-account-num">0123456789</span></div>'
  ));
  assert.ok(/data-readonly/.test(r.html), 'thiếu data-readonly thì sửa tay sẽ ghi sai vào extra_data');
});

test('timeline được đánh số theo thứ tự mốc', () => {
  const item = (t, ti, d) => '<div class="timeline-event">'
    + '<span class="timeline-time">' + t + '</span>'
    + '<h3 class="timeline-title">' + ti + '</h3>'
    + '<p class="timeline-desc">' + d + '</p></div>';
  const r = convert(html(item('10:00', 'Đón khách', 'A') + item('11:00', 'Làm lễ', 'B') + item('12:00', 'Khai tiệc', 'C')));
  const fields = r.applied.fields.map((f) => f.field);
  for (let i = 1; i <= 3; i += 1) {
    assert.ok(fields.includes('timeline_time_' + i), 'thiếu timeline_time_' + i);
    assert.ok(fields.includes('timeline_title_' + i), 'thiếu timeline_title_' + i);
  }
});

test('không ghi đè thuộc tính theme đã gắn sẵn (chạy lại nhiều lần vẫn an toàn)', () => {
  const src = html('<h1 class="hero-name groom" data-field="bride_short_name">A</h1>');
  const r1 = convert(src);
  assert.equal(r1.applied.fields.length, 0, 'không được đụng vào thứ đã gắn');
  assert.ok(/data-field="bride_short_name"/.test(r1.html), 'phải giữ nguyên lựa chọn của người trước');
  // Chạy lần hai trên kết quả lần một -> vẫn y nguyên.
  const r2 = convert(r1.html);
  assert.equal(r2.html.match(/data-field=/g).length, 1);
});

test('người duyệt map tay luôn thắng bộ đoán tự động', () => {
  const r = convert(html('<h1 class="hero-name groom">A</h1>'), {
    overrides: { 'h1.hero-name': 'bride_short_name' },
  });
  assert.ok(/data-field="bride_short_name"/.test(r.html));
  assert.ok(!/data-field="groom_short_name"/.test(r.html));
});

test('manifest mô tả trạng thái CUỐI, không phải phần vừa thêm', () => {
  const zip = new AdmZip();
  zip.addFile('index.html', Buffer.from(html(
    '<h1 class="hero-name groom">A</h1><p class="ceremony-venue-address" data-field="venue_address">X</p>'
  )));
  const out = convertThemeZip(zip.toBuffer(), {});
  // 1 trường tool vừa gắn + 1 trường theme đã có sẵn = 2
  assert.equal(out.manifest.fields.length, 2);
  assert.ok(out.manifest.fields.includes('venue_address'));
  assert.equal(out.manifest.entry_file, 'index.html');
});

test('gói theme độc hại bị chặn ở bộ chuyển đổi', () => {
  const z = new AdmZip();
  z.addFile('index.html', Buffer.from(html('<p>x</p>')));
  z.addFile('x.html', Buffer.from('hack'));
  z.getEntries()[1].entryName = '../../../evil.html';
  assert.throws(() => convertThemeZip(z.toBuffer(), {}), /đường dẫn không an toàn/);

  assert.throws(() => convertThemeZip(Buffer.from('khong phai zip'), {}), /không phải \.zip hợp lệ/);
});
