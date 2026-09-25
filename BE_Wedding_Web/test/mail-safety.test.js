'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Ép cấu hình trước khi nạp service (module đọc env lúc gọi hàm nên đặt ở đây là đủ).
process.env.FRONTEND_URL = 'https://thiepcuoi.me';
process.env.CORS_ORIGINS = 'https://thiepcuoi.me,https://www.thiepcuoi.me';
const mailService = require('../src/services/mailService');

// Endpoint gửi email nhận cả địa chỉ người nhận lẫn link, và thư đi từ hộp Gmail
// của nền tảng. Không ràng buộc thì bất kỳ tài khoản nào cũng biến hệ thống thành
// công cụ phát tán lừa đảo mang danh tên miền của nền tảng.
const send = (over = {}) => mailService.sendInvitationEmail({
  recipientEmail: 'khach@example.com',
  guestName: 'Nguyễn Văn A',
  invitationUrl: 'https://thiepcuoi.me/thiep-abc',
  ...over,
});

test('chặn link thiệp trỏ ra miền ngoài (relay phishing)', async () => {
  await assert.rejects(() => send({ invitationUrl: 'https://evil.example/lua-dao' }), /thuộc hệ thống/);
  await assert.rejects(() => send({ invitationUrl: 'https://thiepcuoi.me.evil.example/x' }), /thuộc hệ thống/);
});

test('chặn giao thức nguy hiểm trong link', async () => {
  await assert.rejects(() => send({ invitationUrl: 'javascript:alert(1)' }), /http hoặc https/);
  await assert.rejects(() => send({ invitationUrl: 'file:///etc/passwd' }), /http hoặc https/);
  await assert.rejects(() => send({ invitationUrl: 'khong-phai-url' }), /không phải đường dẫn hợp lệ/);
});

test('chặn địa chỉ email người nhận không hợp lệ', async () => {
  for (const bad of ['khong-phai-email', 'a@b', 'a@@b.com', 'a b@c.com', 'a@b.com, c@d.com']) {
    await assert.rejects(() => send({ recipientEmail: bad }), /email người nhận không hợp lệ/, `phải chặn: ${bad}`);
  }
});

test('link thuộc hệ thống thì qua được lớp kiểm (dừng ở bước thiếu cấu hình Gmail)', async () => {
  // Không cấu hình GMAIL_USER trong test -> lỗi tiếp theo phải là lỗi cấu hình,
  // chứng tỏ đã vượt qua lớp kiểm link chứ không bị chặn mù.
  delete process.env.GMAIL_USER;
  await assert.rejects(() => send({ invitationUrl: 'https://www.thiepcuoi.me/thiep-abc' }), /GMAIL_USER/);
});
