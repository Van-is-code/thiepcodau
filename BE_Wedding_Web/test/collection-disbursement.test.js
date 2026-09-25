'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { roundVnd, computeCommission } = require('../src/utils/money');
const { applyWalletAmount, reduceLedger } = require('../src/utils/walletMath');
const payos = require('../src/services/payosPayoutService');

// ---------------------------------------------------------------------------
// Mô phỏng dòng tiền THU HỘ + CHI HỘ, không cần DB.
//
//   Thu hộ : khách trả toàn bộ vào tài khoản nền tảng
//            -> platform_amount (nền tảng giữ) + ctv_amount (thu hộ CTV)
//   Chi hộ : phần ctv_amount được chuyển về tài khoản ngân hàng CTV
// ---------------------------------------------------------------------------
function makeLedger() {
  const collections = [];
  const wallet = { balance: 0, pending: 0, totalEarned: 0, totalPaid: 0, ledger: [] };

  const push = (amount, type) => {
    wallet.balance = applyWalletAmount(wallet.balance, amount);
    wallet.ledger.push({ amount, type });
    assert.equal(wallet.balance, reduceLedger(wallet.ledger.map((r) => r.amount)), 'balance != SUM(sổ cái)');
  };

  return {
    collections,
    wallet,
    // 1 đơn được thanh toán: ghi sổ thu hộ + cộng hoa hồng vào ví.
    collect(sellingPrice, commissionRate, orderId) {
      const c = computeCommission(sellingPrice, commissionRate);
      collections.push({
        order_id: orderId,
        gross: c.sellingPrice,
        platform: c.commissionAmount,
        ctv: c.ctvEarningAmount,
        status: 'pending_settlement',
        settled_payout_id: null,
      });
      push(c.ctvEarningAmount, 'commission_credit');
      wallet.totalEarned = applyWalletAmount(wallet.totalEarned, c.ctvEarningAmount);
      return c;
    },
    // Tạo phiếu rút: giữ tiền khỏi ví.
    requestPayout(amount, id) {
      assert.ok(amount <= wallet.balance, 'không được rút quá số dư khả dụng');
      push(-amount, 'payout_hold');
      wallet.pending = applyWalletAmount(wallet.pending, amount);
      return { id, amount, status: 'pending', provider_state: null };
    },
    // Duyệt + chi hộ: pending -> paid, các khoản thu hộ chuyển sang đã tất toán.
    approve(req) {
      wallet.pending = applyWalletAmount(wallet.pending, -req.amount);
      wallet.totalPaid = applyWalletAmount(wallet.totalPaid, req.amount);
      for (const c of collections) {
        if (c.status === 'pending_settlement') { c.status = 'settled'; c.settled_payout_id = req.id; }
      }
      req.status = 'approved';
      req.provider_state = 'processing';
      return req;
    },
    // Chi hộ THẤT BẠI: đảo ngược đúng bằng payoutDisbursementService.markFailed.
    fail(req) {
      wallet.totalPaid = applyWalletAmount(wallet.totalPaid, -req.amount);
      wallet.pending = applyWalletAmount(wallet.pending, req.amount);
      push(req.amount, 'payout_release');
      wallet.pending = applyWalletAmount(wallet.pending, -req.amount);
      for (const c of collections) {
        if (c.settled_payout_id === req.id) { c.status = 'pending_settlement'; c.settled_payout_id = null; }
      }
      req.status = 'pending';
      req.provider_state = 'failed';
      return req;
    },
    succeed(req) { req.provider_state = 'succeeded'; return req; },
    pendingOwed() {
      return collections.filter((c) => c.status === 'pending_settlement')
        .reduce((s, c) => roundVnd(s + c.ctv), 0);
    },
    totals() {
      return {
        gross: collections.reduce((s, c) => roundVnd(s + c.gross), 0),
        platform: collections.reduce((s, c) => roundVnd(s + c.platform), 0),
        ctv: collections.reduce((s, c) => roundVnd(s + c.ctv), 0),
      };
    },
  };
}

// ----- THU HỘ -----

test('thu hộ: tổng thu = phần nền tảng + phần thu hộ CTV (bất biến cốt lõi)', () => {
  const sys = makeLedger();
  sys.collect(250000, 0.4, 'o1');   // nền tảng 100k, CTV 150k
  sys.collect(400000, 0.4, 'o2');   // nền tảng 160k, CTV 240k
  sys.collect(330000, 0.35, 'o3');  // nền tảng 115.5k -> 115500, CTV 214500

  const t = sys.totals();
  assert.equal(t.gross, 980000);
  assert.equal(roundVnd(t.platform + t.ctv), t.gross, 'gross phải bằng platform + ctv');
  // Phần thu hộ CTV phải khớp đúng số dư ví CTV.
  assert.equal(sys.wallet.balance, t.ctv);
  assert.equal(sys.pendingOwed(), t.ctv, 'chưa chi thì toàn bộ vẫn là nợ CTV');
});

test('thu hộ: đơn không có CTV thì nền tảng hưởng trọn, không nợ ai', () => {
  const c = computeCommission(200000, 1); // rate 1 = nền tảng giữ hết
  assert.equal(c.commissionAmount, 200000);
  assert.equal(c.ctvEarningAmount, 0);
});

// ----- CHI HỘ -----

test('chi hộ thành công: nợ CTV về 0, ví khớp sổ cái', () => {
  const sys = makeLedger();
  sys.collect(250000, 0.4, 'o1');
  sys.collect(400000, 0.4, 'o2');
  assert.equal(sys.wallet.balance, 390000);

  const req = sys.requestPayout(390000, 'p1');
  assert.equal(sys.wallet.balance, 0, 'giữ tiền -> số dư khả dụng về 0');
  assert.equal(sys.wallet.pending, 390000);

  sys.approve(req);
  sys.succeed(req);
  assert.equal(sys.wallet.pending, 0);
  assert.equal(sys.wallet.totalPaid, 390000);
  assert.equal(sys.pendingOwed(), 0, 'đã chi hộ xong -> không còn nợ CTV');
  assert.equal(sys.wallet.balance, reduceLedger(sys.wallet.ledger.map((r) => r.amount)));
});

test('chi hộ THẤT BẠI: tiền quay lại ví CTV và khoản thu hộ trở lại diện còn nợ', () => {
  const sys = makeLedger();
  sys.collect(400000, 0.4, 'o1'); // CTV 240k
  const req = sys.requestPayout(240000, 'p1');
  sys.approve(req);
  assert.equal(sys.pendingOwed(), 0);

  sys.fail(req);

  // Đây là điểm dễ sai nhất: nếu không đảo ngược thì CTV mất trắng 240k trên sổ
  // trong khi thực tế chưa nhận được đồng nào.
  assert.equal(sys.wallet.balance, 240000, 'tiền phải quay lại số dư khả dụng');
  assert.equal(sys.wallet.pending, 0);
  assert.equal(sys.wallet.totalPaid, 0, 'không được tính là đã trả');
  assert.equal(sys.pendingOwed(), 240000, 'khoản thu hộ phải trở lại diện còn nợ');
  assert.equal(req.status, 'pending', 'phiếu quay về chờ duyệt để admin xử lý lại');
  assert.equal(sys.wallet.balance, reduceLedger(sys.wallet.ledger.map((r) => r.amount)));
});

test('chi hộ thất bại rồi duyệt lại thành công: không nhân đôi tiền', () => {
  const sys = makeLedger();
  sys.collect(400000, 0.4, 'o1');
  const req1 = sys.requestPayout(240000, 'p1');
  sys.approve(req1);
  sys.fail(req1);

  const req2 = sys.requestPayout(240000, 'p2');
  sys.approve(req2);
  sys.succeed(req2);

  assert.equal(sys.wallet.totalPaid, 240000, 'chỉ được trả đúng 1 lần');
  assert.equal(sys.wallet.balance, 0);
  assert.equal(sys.pendingOwed(), 0);
});

test('không thể rút quá số dư khả dụng', () => {
  const sys = makeLedger();
  sys.collect(250000, 0.4, 'o1'); // CTV 150k
  assert.throws(() => sys.requestPayout(150001, 'p1'));
});

// ----- CHỮ KÝ & CHỐNG GIAN LẬN WEBHOOK CHI HỘ -----

test('chữ ký chi hộ: sắp xếp khoá theo bảng chữ cái, đổi thứ tự vẫn ra cùng kết quả', () => {
  const a = payos.signPayload({ amount: 150000, referenceId: 'p1', toBin: '970422', toAccountNumber: '123' });
  const b = payos.signPayload({ toAccountNumber: '123', toBin: '970422', referenceId: 'p1', amount: 150000 });
  assert.equal(a, b, 'thứ tự khoá trong object không được ảnh hưởng chữ ký');
});

test('chữ ký chi hộ: đổi 1 đồng là chữ ký khác hẳn (không giả mạo số tiền được)', () => {
  const real = payos.signPayload({ amount: 150000, referenceId: 'p1' });
  const tampered = payos.signPayload({ amount: 150001, referenceId: 'p1' });
  assert.notEqual(real, tampered);
});

test('so sánh chữ ký dùng thời gian hằng số, và đúng/sai vẫn cho kết quả chuẩn', () => {
  assert.equal(payos.safeEqual('abc123', 'abc123'), true);
  assert.equal(payos.safeEqual('abc123', 'abc124'), false);
  // Khác độ dài -> false, không ném lỗi (timingSafeEqual gốc sẽ ném).
  assert.equal(payos.safeEqual('abc', 'abcdef'), false);
  assert.equal(payos.safeEqual('', ''), true);
  assert.equal(payos.safeEqual(null, undefined), true);
});

test('webhook chi hộ thiếu data bị từ chối', () => {
  assert.throws(() => payos.verifyPayoutWebhook({}), /thiếu trường data/);
  assert.throws(() => payos.verifyPayoutWebhook(null), /thiếu trường data/);
});

test('chuẩn hoá trạng thái payOS về 3 nhóm nghiệp vụ', () => {
  assert.equal(payos.normalizeState('SUCCEEDED'), 'succeeded');
  assert.equal(payos.normalizeState('success'), 'succeeded');
  assert.equal(payos.normalizeState('FAILED'), 'failed');
  assert.equal(payos.normalizeState('CANCELLED'), 'failed');
  assert.equal(payos.normalizeState('REVERSED'), 'failed');
  assert.equal(payos.normalizeState('PROCESSING'), 'processing');
  // Trạng thái lạ -> KHÔNG được coi là thành công.
  assert.equal(payos.normalizeState('SOMETHING_NEW'), 'processing');
  assert.equal(payos.normalizeState(undefined), 'processing');
});
