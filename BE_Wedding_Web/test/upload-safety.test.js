'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const AdmZip = require('adm-zip');
const { detect } = require('../src/middlewares/uploadGuard');
const templateUpload = require('../src/services/templateUploadService');

// ---- Nhận dạng tệp theo NỘI DUNG, không theo đuôi do người dùng đặt ----
test('uploadGuard từ chối tệp giả danh ảnh', () => {
  assert.equal(detect(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image'), null);
  assert.equal(detect(Buffer.from('<html><script>alert(1)</script></html>'), 'image'), null);
  assert.equal(detect(Buffer.from('<?php system($_GET[0]); ?>'), 'image'), null);
  assert.equal(detect(Buffer.alloc(4), 'image'), null);
});

test('uploadGuard nhận đúng ảnh thật và suy ra đuôi từ nội dung', () => {
  const jpg = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(16)]);
  assert.equal(detect(jpg, 'image').ext, '.jpg');
  const png = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(16)]);
  assert.equal(detect(png, 'image').ext, '.png');
});

test('uploadGuard không nhầm ảnh thành nhạc và ngược lại', () => {
  const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(16)]);
  assert.equal(detect(mp3, 'audio').ext, '.mp3');
  assert.equal(detect(mp3, 'image'), null, 'mp3 không được coi là ảnh');
});

// ---- Gói mẫu thiệp (.zip) ----
const zipWith = (entries) => {
  const z = new AdmZip();
  for (const [name, content] of entries) z.addFile(name, Buffer.from(content));
  return z.toBuffer();
};

test('chặn gói mẫu có quá nhiều tệp', () => {
  const many = Array.from({ length: 6000 }, (_, i) => [`f${i}.txt`, 'x']);
  assert.throws(() => templateUpload.extractPackage({ buffer: zipWith(many), templateCode: 'test-many' }),
    /quá nhiều tệp/);
});

test('chặn zip bomb: tệp nén nhỏ nhưng giải nén ra rất lớn', () => {
  const prev = process.env.MAX_TEMPLATE_UNCOMPRESSED_BYTES;
  process.env.MAX_TEMPLATE_UNCOMPRESSED_BYTES = String(1024 * 1024); // 1MB cho nhanh
  // Phải nạp lại module để đọc trần mới.
  delete require.cache[require.resolve('../src/services/templateUploadService')];
  const svc = require('../src/services/templateUploadService');
  try {
    const buf = zipWith([['big.bin', 'A'.repeat(5 * 1024 * 1024)]]);
    assert.throws(() => svc.extractPackage({ buffer: buf, templateCode: 'test-bomb' }), /giải nén ra quá lớn/);
  } finally {
    if (prev === undefined) delete process.env.MAX_TEMPLATE_UNCOMPRESSED_BYTES;
    else process.env.MAX_TEMPLATE_UNCOMPRESSED_BYTES = prev;
    delete require.cache[require.resolve('../src/services/templateUploadService')];
  }
});

test('chặn zip-slip: entry trỏ ra ngoài thư mục đích', () => {
  // adm-zip tự làm sạch tên khi TẠO zip, nên ghép thủ công qua entryName.
  const z = new AdmZip();
  z.addFile('index.html', Buffer.from('<html></html>'));
  z.addFile('x.html', Buffer.from('<html>hacked</html>'));
  z.getEntries()[1].entryName = '../../../evil-escaped.html';
  assert.throws(() => templateUpload.extractPackage({ buffer: z.toBuffer(), templateCode: 'test-slip' }),
    /đường dẫn không an toàn/);
});
