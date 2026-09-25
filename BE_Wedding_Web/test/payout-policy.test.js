'use strict';
// Mức rút tối thiểu: sàn của nền tảng + mức riêng từng CTV.
//
// Tiền bạc nên kiểm cả những đường lách: CTV tự hạ mức của mình, admin gõ số âm,
// gửi kèm khoá lạ để ghi đè trạng thái bộ quét.
const test = require('node:test');
const assert = require('node:assert/strict');
const payout = require('../src/services/payoutService');

const { effectiveMin, validatePolicy, POLICY_MAC_DINH } = payout;

test('effectiveMin: lấy mức CAO HƠN giữa sàn nền tảng và mức riêng CTV', () => {
  assert.equal(effectiveMin({ auto_payout_min_amount: 300000 }, { min_payout_amount: 500000 }), 500000);
  assert.equal(effectiveMin({ auto_payout_min_amount: 800000 }, { min_payout_amount: 500000 }), 800000);
});

test('effectiveMin: CTV để 0 thì vẫn phải theo sàn nền tảng', () => {
  assert.equal(effectiveMin({ auto_payout_min_amount: 0 }, { min_payout_amount: 500000 }), 500000);
});

test('effectiveMin: nền tảng không đặt sàn thì theo mức riêng của CTV', () => {
  assert.equal(effectiveMin({ auto_payout_min_amount: 200000 }, { min_payout_amount: 0 }), 200000);
});

test('effectiveMin: thiếu dữ liệu -> 0, không ném lỗi', () => {
  assert.equal(effectiveMin(null, null), 0);
  assert.equal(effectiveMin({}, {}), 0);
  assert.equal(effectiveMin({ auto_payout_min_amount: null }, { min_payout_amount: undefined }), 0);
});

test('effectiveMin: nhận chuỗi từ DECIMAL của Postgres', () => {
  assert.equal(effectiveMin({ auto_payout_min_amount: '300000.00' }, { min_payout_amount: '500000.00' }), 500000);
});

test('validatePolicy: nhận mức hợp lệ', () => {
  const r = validatePolicy({ min_payout_amount: 500000 }, POLICY_MAC_DINH);
  assert.equal(r.min_payout_amount, 500000);
});

test('validatePolicy: 0 nghĩa là bỏ ngưỡng, vẫn hợp lệ', () => {
  assert.equal(validatePolicy({ min_payout_amount: 0 }, { ...POLICY_MAC_DINH, min_payout_amount: 500000 }).min_payout_amount, 0);
});

test('validatePolicy: từ chối số âm', () => {
  assert.throws(() => validatePolicy({ min_payout_amount: -1 }), /không hợp lệ/);
});

test('validatePolicy: từ chối chữ', () => {
  assert.throws(() => validatePolicy({ min_payout_amount: 'nhiều' }), /không hợp lệ/);
});

test('validatePolicy: chặn mức vô lý (khoá cứng toàn bộ CTV)', () => {
  assert.throws(() => validatePolicy({ min_payout_amount: 100000000 }), /không được quá/);
});

test('validatePolicy: thứ trong tuần phải 0..6', () => {
  assert.equal(validatePolicy({ default_weekday: 6 }).default_weekday, 6);
  assert.throws(() => validatePolicy({ default_weekday: 7 }), /0\.\.6/);
  assert.throws(() => validatePolicy({ default_weekday: -1 }), /0\.\.6/);
});

test('validatePolicy: giờ chạy phải 0..23', () => {
  assert.equal(validatePolicy({ run_hour: 0 }).run_hour, 0);
  assert.throws(() => validatePolicy({ run_hour: 24 }), /0\.\.23/);
});

test('validatePolicy: không gửi trường nào thì giữ nguyên giá trị cũ', () => {
  const truoc = { default_weekday: 3, run_hour: 14, min_payout_amount: 700000, last_run_date: '2026-09-01' };
  assert.deepEqual(validatePolicy({}, truoc), truoc);
});

test('validatePolicy: KHÔNG cho ghi đè last_run_date qua body', () => {
  const truoc = { ...POLICY_MAC_DINH, last_run_date: '2026-09-24' };
  const r = validatePolicy({ last_run_date: null, khoa_la: 1 }, truoc);
  assert.equal(r.last_run_date, '2026-09-24');
  assert.equal(r.khoa_la, undefined);
});

test('validatePolicy: sửa một trường không làm mất trường khác', () => {
  const truoc = { default_weekday: 5, run_hour: 8, min_payout_amount: 0, last_run_date: null };
  const r = validatePolicy({ min_payout_amount: 300000 }, truoc);
  assert.equal(r.min_payout_amount, 300000);
  assert.equal(r.default_weekday, 5);
  assert.equal(r.run_hour, 8);
});

// ---- Chốt chặn thật trong createRequest ----
//
// Guard chạy TRƯỚC transaction nên kiểm được mà không cần CSDL: chỉ cần thay tạm
// lớp đọc cấu hình. Đây mới là chỗ quyết định — giao diện chặn chỉ là cho đẹp,
// gọi thẳng API vẫn phải bị chặn.
const { AppSetting } = require('../src/models');

const voiChinhSach = async (policy, fn) => {
  const that = AppSetting.findByPk;
  AppSetting.findByPk = async () => ({ value: policy });
  try { return await fn(); } finally { AppSetting.findByPk = that; }
};

const ctvGia = (minRieng = 0) => ({
  id: '00000000-0000-0000-0000-000000000001',
  status: 'active',
  auto_payout_min_amount: minRieng,
});

test('createRequest: dưới sàn nền tảng -> bị chặn, lỗi 400', async () => {
  await voiChinhSach({ min_payout_amount: 500000 }, async () => {
    await assert.rejects(
      () => payout.createRequest(ctvGia(0), { amount: 200000, requestedBy: 'ctv' }),
      (e) => e.status === 400 && /tối thiểu/i.test(e.message)
    );
  });
});

test('createRequest: mức riêng của CTV cao hơn sàn thì theo mức riêng', async () => {
  await voiChinhSach({ min_payout_amount: 300000 }, async () => {
    await assert.rejects(
      () => payout.createRequest(ctvGia(800000), { amount: 500000, requestedBy: 'ctv' }),
      (e) => e.status === 400 && /800\.000/.test(e.message)
    );
  });
});

test('createRequest: admin tạo hộ với allowBelowMin thì KHÔNG bị chặn vì ngưỡng', async () => {
  await voiChinhSach({ min_payout_amount: 500000 }, async () => {
    // Qua được guard thì sẽ chết ở bước CSDL — miễn không phải lỗi ngưỡng là đúng.
    await assert.rejects(
      () => payout.createRequest(ctvGia(0), { amount: 200000, requestedBy: 'system', allowBelowMin: true }),
      (e) => !/tối thiểu/i.test(e.message)
    );
  });
});

test('createRequest: đủ ngưỡng thì qua được guard', async () => {
  await voiChinhSach({ min_payout_amount: 500000 }, async () => {
    await assert.rejects(
      () => payout.createRequest(ctvGia(0), { amount: 500000, requestedBy: 'ctv' }),
      (e) => !/tối thiểu/i.test(e.message)
    );
  });
});

test('createRequest: CTV bị khoá vẫn chặn trước, không phụ thuộc ngưỡng', async () => {
  await voiChinhSach({ min_payout_amount: 0 }, async () => {
    await assert.rejects(
      () => payout.createRequest({ ...ctvGia(0), status: 'locked' }, { amount: 999999, requestedBy: 'ctv' }),
      (e) => e.status === 403
    );
  });
});

// ---- Hai công tắc: tự tạo phiếu, và tự chuyển tiền ----
//
// Hai thứ khác nhau, hay bị lẫn:
//   auto_sweep_enabled = có TỰ TẠO phiếu rút theo lịch tuần không
//   payout_mode        = duyệt phiếu xong TIỀN ĐI KIỂU NÀO
// Tắt payout_mode thì phiếu chỉ nằm chờ, admin tự chuyển khoản.

test('validatePolicy: bật/tắt tự tạo phiếu', () => {
  assert.equal(validatePolicy({ auto_sweep_enabled: true }).auto_sweep_enabled, true);
  assert.equal(validatePolicy({ auto_sweep_enabled: false }).auto_sweep_enabled, false);
  // Giao diện gửi qua form có thể ra chuỗi.
  assert.equal(validatePolicy({ auto_sweep_enabled: 'true' }).auto_sweep_enabled, true);
});

test('validatePolicy: giá trị lạ cho công tắc -> coi như tắt, không ném lỗi', () => {
  assert.equal(validatePolicy({ auto_sweep_enabled: 'bat-di' }).auto_sweep_enabled, false);
});

test('validatePolicy: payout_mode chỉ nhận manual hoặc payos', () => {
  assert.equal(validatePolicy({ payout_mode: 'manual' }).payout_mode, 'manual');
  assert.throws(() => validatePolicy({ payout_mode: 'momo' }), /manual hoặc payos/);
});

test('validatePolicy: CHƯA có khoá payOS thì không bật được chi tự động', () => {
  // Bật mà chưa có khoá là duyệt phiếu xong ăn lỗi 503 — lúc đang trả tiền cho
  // cộng tác viên. Chặn ngay tại chỗ bấm.
  assert.throws(() => validatePolicy({ payout_mode: 'payos' }), /Chưa cấu hình khoá chi hộ payOS/);
});

test('mặc định là chuyển khoản tay, không tự chi', () => {
  assert.equal(POLICY_MAC_DINH.payout_mode, 'manual');
  assert.equal(POLICY_MAC_DINH.auto_sweep_enabled, false);
});

test('đổi công tắc này không làm mất công tắc kia', () => {
  const truoc = { ...POLICY_MAC_DINH, auto_sweep_enabled: true, payout_mode: 'manual', min_payout_amount: 500000 };
  const r = validatePolicy({ min_payout_amount: 300000 }, truoc);
  assert.equal(r.auto_sweep_enabled, true);
  assert.equal(r.payout_mode, 'manual');
  assert.equal(r.min_payout_amount, 300000);
});
