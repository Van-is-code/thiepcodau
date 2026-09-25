'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const pipeline = require('../src/services/imagePipelineService');
const storage = require('../src/services/storageService');

const makeJpeg = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 90 } } })
  .jpeg().toBuffer();

test('nhận diện ảnh theo magic bytes, không tin đuôi tệp', async () => {
  const jpg = await makeJpeg(64, 64);
  assert.equal(pipeline.detectImageType(jpg).ext, 'jpg');

  const png = await sharp(jpg).png().toBuffer();
  assert.equal(pipeline.detectImageType(png).ext, 'png');

  const webp = await sharp(jpg).webp().toBuffer();
  assert.equal(pipeline.detectImageType(webp).ext, 'webp');
});

test('từ chối SVG và tệp giả danh ảnh (chống XSS lưu trữ)', () => {
  // SVG là XML, có thể chứa <script> -> mở từ CDN sẽ chạy mã.
  assert.throws(() => pipeline.assertRealImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')), /không phải ảnh hợp lệ/);
  // HTML đổi đuôi thành .jpg
  assert.throws(() => pipeline.assertRealImage(Buffer.from('<html><script>alert(1)</script></html>')), /không phải ảnh hợp lệ/);
  // PHP webshell
  assert.throws(() => pipeline.assertRealImage(Buffer.from('<?php system($_GET[0]); ?>')), /không phải ảnh hợp lệ/);
  // Rỗng / quá ngắn
  assert.throws(() => pipeline.assertRealImage(Buffer.alloc(4)), /không phải ảnh hợp lệ/);
});

test('sinh đủ bộ phiên bản AVIF/WebP/JPEG theo các cỡ nhỏ hơn ảnh gốc', async () => {
  const buf = await makeJpeg(2400, 1600);
  const r = await pipeline.processAndStore(buf, 'test/pipeline-full');

  assert.equal(r.original_width, 2400);
  for (const f of ['avif', 'webp', 'jpeg']) {
    assert.ok(r.variants[f].length >= 4, `${f} phải có >= 4 cỡ`);
    // Đã sắp xếp tăng dần theo chiều rộng (srcset cần đúng thứ tự).
    const widths = r.variants[f].map((v) => v.width);
    assert.deepEqual(widths, [...widths].sort((a, b) => a - b));
    // Không phóng to quá ảnh gốc.
    assert.ok(Math.max(...widths) <= 2400);
  }

  // AVIF phải nhẹ hơn JPEG ở cùng cỡ — đó là lý do sinh ra nó.
  const avif1280 = r.variants.avif.find((v) => v.width === 1280);
  const jpeg1280 = r.variants.jpeg.find((v) => v.width === 1280);
  assert.ok(avif1280.bytes < jpeg1280.bytes, 'AVIF phải nhỏ hơn JPEG cùng cỡ');
});

test('ảnh nhỏ hơn mọi điểm gãy vẫn xuất được ít nhất 1 cỡ', async () => {
  const buf = await makeJpeg(300, 200);
  const r = await pipeline.processAndStore(buf, 'test/pipeline-small');
  assert.ok(r.variants.jpeg.length >= 1);
  assert.equal(r.variants.jpeg[0].width, 300, 'không phóng to ảnh nhỏ');
});

test('ảnh nhoè LQIP đủ nhỏ để nhúng thẳng vào HTML', async () => {
  const buf = await makeJpeg(2400, 1600);
  const blur = await pipeline.makeBlurPlaceholder(buf);
  assert.match(blur, /^data:image\/webp;base64,/);
  // Dưới 2KB thì nhúng inline mới có lợi so với 1 request riêng.
  assert.ok(blur.length < 2048, `LQIP quá lớn: ${blur.length} ký tự`);
});

test('xoay ảnh theo EXIF Orientation (ảnh dọc chụp từ điện thoại)', async () => {
  // Ảnh 400x200 gắn cờ orientation 6 = xoay 90°, hiển thị đúng phải là 200x400.
  const rotated = await sharp({ create: { width: 400, height: 200, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const r = await pipeline.processAndStore(rotated, 'test/pipeline-exif');
  assert.ok(r.height > r.width, `phải cao hơn rộng sau khi xoay, nhận ${r.width}x${r.height}`);
});

test('gom đủ khoá của mọi phiên bản để xoá sạch, không để rác trong kho', async () => {
  const buf = await makeJpeg(1000, 1000);
  const r = await pipeline.processAndStore(buf, 'test/pipeline-keys');
  const keys = pipeline.allKeysOf(r.variants);
  const expected = r.variants.avif.length + r.variants.webp.length + r.variants.jpeg.length;
  assert.equal(keys.length, expected);
  assert.equal(new Set(keys).size, expected, 'các khoá phải khác nhau');
  await storage.removeMany(keys);
});

// ---- Thang chất lượng theo cỡ ảnh ----
//
// Đo trên ảnh cưới thật: ở 1920px mức AVIF q50 làm mượt mất lưới voan và hạt ren.
// Cỡ nhỏ thì không cần nâng — điện thoại không đủ điểm ảnh để thể hiện lưới voan.
const { qualityOf, WIDTHS } = require('../src/services/imagePipelineService');

test('qualityOf: cỡ càng lớn nén càng kỹ, không bao giờ giảm', () => {
  for (const format of ['avif', 'webp', 'jpeg']) {
    let truoc = 0;
    for (const w of WIDTHS) {
      const q = qualityOf(w, format);
      assert.ok(q >= truoc, `${format} ${w}px: q${q} thấp hơn cỡ nhỏ hơn (q${truoc})`);
      truoc = q;
    }
  }
});

test('qualityOf: cỡ điện thoại giữ nguyên mức nhẹ', () => {
  assert.equal(qualityOf(400, 'avif'), 50);
  assert.equal(qualityOf(800, 'avif'), 50);
});

test('qualityOf: cỡ lớn nâng lên cho nét voan/ren', () => {
  assert.ok(qualityOf(1920, 'avif') > qualityOf(800, 'avif'));
  assert.ok(qualityOf(1920, 'jpeg') > qualityOf(800, 'jpeg'));
});

test('qualityOf: cỡ vượt bảng vẫn có mức, không trả undefined', () => {
  for (const format of ['avif', 'webp', 'jpeg']) {
    const q = qualityOf(99999, format);
    assert.ok(Number.isFinite(q) && q > 0 && q <= 100, `${format}: ${q}`);
  }
});

test('qualityOf: AVIF luôn đặt thấp hơn JPEG ở cùng cỡ (AVIF nén tốt hơn)', () => {
  for (const w of WIDTHS) assert.ok(qualityOf(w, 'avif') < qualityOf(w, 'jpeg'));
});
