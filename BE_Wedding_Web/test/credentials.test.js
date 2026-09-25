'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertCredentials, assertPassword, assertUsername, MIN_PASSWORD_LENGTH } = require('../src/utils/credentials');

// Hệ thống cấp tài khoản theo kiểu admin/CTV tạo hộ khách, nên chính sách PHẢI áp
// cho mọi đường tạo tài khoản chứ không chỉ trang tự đăng ký.
test('từ chối mật khẩu ngắn', () => {
  assert.throws(() => assertPassword('1234567'), /tối thiểu/);
  assert.throws(() => assertPassword(''), /bắt buộc/);
  assert.doesNotThrow(() => assertPassword('MatKhau!2027'));
});

test('từ chối mật khẩu phổ biến dù đủ độ dài', () => {
  for (const p of ['12345678', 'password', 'qwerty123', 'admin123', 'thiepcuoi']) {
    assert.throws(() => assertPassword(p), /phổ biến/, `phải chặn: ${p}`);
  }
});

test('từ chối mật khẩu trùng tên đăng nhập', () => {
  assert.throws(() => assertCredentials('khachhang', 'khachhang'), /trùng với tên đăng nhập/);
  assert.throws(() => assertCredentials('KhachHang', 'khachhang'), /trùng với tên đăng nhập/);
});

test('username chỉ nhận chữ, số và . _ -', () => {
  assert.throws(() => assertUsername('kh@ch'), /chỉ được chứa/);
  assert.throws(() => assertUsername('khach mời'), /chỉ được chứa/);
  assert.throws(() => assertUsername('ab'), /3–50/);
  assert.throws(() => assertUsername('x'.repeat(51)), /3–50/);
  assert.equal(assertUsername('  khach.hang_01-a  '), 'khach.hang_01-a', 'phải cắt khoảng trắng thừa');
});

test('mật khẩu quá dài bị chặn (tránh tốn CPU khi băm)', () => {
  assert.throws(() => assertPassword('a'.repeat(201)), /quá dài/);
});

test('độ dài tối thiểu lấy từ biến môi trường, mặc định 8', () => {
  assert.ok(MIN_PASSWORD_LENGTH >= 8);
});
