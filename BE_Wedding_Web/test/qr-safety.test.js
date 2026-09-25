'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const QRCode = require('qrcode');
const bankQr = require('../src/services/bankQrService');

// Ảnh bom nén: tệp PNG vài trăm KB nhưng giải nén ra hàng trăm triệu điểm ảnh.
// Vài request đồng thời là đủ làm nghẽn CPU/RAM của server.
test('chặn ảnh bom nén trước khi giải nén', async () => {
  const bomb = await sharp({ create: { width: 12000, height: 12000, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .png({ compressionLevel: 9 }).toBuffer();
  assert.ok(bomb.length < 2 * 1024 * 1024, 'tệp nén phải nhỏ (đó là điểm nguy hiểm)');

  const t0 = Date.now();
  await assert.rejects(() => bankQr.scanBankQr(bomb), (e) => e.status === 413 && /quá lớn/.test(e.message));
  // Phải từ chối gần như tức thì, không được bỏ 6 giây ra giải nén rồi mới chặn.
  assert.ok(Date.now() - t0 < 1500, `chặn quá chậm: ${Date.now() - t0}ms`);
});

test('vẫn đọc được mã QR ngân hàng thật', async () => {
  // Chuỗi VietQR hợp lệ: BIN 970422 (MB Bank), STK 0011008686868
  const payload = '00020101021238570010A00000072701270006970422011300110086868680208QRIBFTTA53037045802VN63042B10';
  const png = await QRCode.toBuffer(payload, { width: 600 });
  const r = await bankQr.scanBankQr(png);
  assert.equal(r.bankBin, '970422');
  assert.equal(r.accountNumber, '0011008686868');
  // QR trả về phải do hệ thống tự sinh, không dùng lại ảnh người dùng tải lên.
  assert.match(r.qrImage, /^data:image\/png;base64,/);
});

test('từ chối ảnh không chứa mã QR', async () => {
  const plain = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 200, g: 200, b: 200 } } })
    .png().toBuffer();
  await assert.rejects(() => bankQr.scanBankQr(plain), (e) => e.status === 422);
});

test('từ chối mã QR không phải QR chuyển khoản', async () => {
  const png = await QRCode.toBuffer('https://example.com/khong-phai-vietqr', { width: 400 });
  await assert.rejects(() => bankQr.scanBankQr(png), (e) => e.status === 422 && /VietQR|ngân hàng/.test(e.message));
});
