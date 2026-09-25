'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyWalletAmount, reduceLedger } = require('../src/utils/walletMath');

// Mô phỏng ví bằng ledger có dấu. balance PHẢI == SUM(ledger) sau mỗi bước.
const wallet = () => {
  const ledger = [];
  const api = {
    ledger,
    balance: 0,
    pending: 0,
    totalEarned: 0,
    totalPaid: 0,
    push(amount, type) {
      this.balance = applyWalletAmount(this.balance, amount);
      ledger.push({ amount, type, balance_after: this.balance });
      assert.equal(this.balance, reduceLedger(ledger.map((r) => r.amount)), 'balance != SUM(ledger)');
    },
    commission(a) { this.push(a, 'commission_credit'); this.totalEarned = applyWalletAmount(this.totalEarned, a); },
    refund(a) { this.push(-a, 'refund_debit'); this.totalEarned = applyWalletAmount(this.totalEarned, -a); },
    hold(a) { this.push(-a, 'payout_hold'); this.pending = applyWalletAmount(this.pending, a); },
    release(a) { this.push(a, 'payout_release'); this.pending = applyWalletAmount(this.pending, -a); },
    approve(a) { this.pending = applyWalletAmount(this.pending, -a); this.totalPaid = applyWalletAmount(this.totalPaid, a); }
  };
  return api;
};

// §18/§19: đơn 400k @40% -> CTV hưởng 240k vào ví
test('commission credit: đơn 400k@40% -> ví +240k', () => {
  const w = wallet();
  w.commission(240000);
  assert.equal(w.balance, 240000);
  assert.equal(w.totalEarned, 240000);
});

// §19: cộng dồn 2 đơn
test('2 đơn commission -> ví cộng dồn, ledger khớp', () => {
  const w = wallet();
  w.commission(240000);
  w.commission(180000);
  assert.equal(w.balance, 420000);
  assert.equal(reduceLedger(w.ledger.map((r) => r.amount)), 420000);
});

// §21: tạo phiếu rút -> hold; admin duyệt -> pending giảm, paid tăng, balance giữ nguyên sau hold
test('payout: hold 420k -> balance 0, pending 420k; approve -> paid 420k', () => {
  const w = wallet();
  w.commission(420000);
  w.hold(420000);
  assert.equal(w.balance, 0);
  assert.equal(w.pending, 420000);
  w.approve(420000);
  assert.equal(w.pending, 0);
  assert.equal(w.totalPaid, 420000);
  assert.equal(w.balance, 0); // tiền đã rời ví lúc hold
});

// §22/§23: reject phiếu -> nhả tiền, balance quay lại
test('payout reject/cancel -> release, balance khôi phục', () => {
  const w = wallet();
  w.commission(300000);
  w.hold(200000);
  assert.equal(w.balance, 100000);
  w.release(200000);
  assert.equal(w.balance, 300000);
  assert.equal(w.pending, 0);
});

// §22: refund sau khi đã có hoa hồng
test('refund đảo hoa hồng -> ledger có dòng âm, balance giảm', () => {
  const w = wallet();
  w.commission(240000);
  w.refund(240000);
  assert.equal(w.balance, 0);
  assert.equal(w.totalEarned, 0);
  assert.equal(w.ledger.length, 2);
  assert.equal(w.ledger[1].amount, -240000);
});

// §23: balance đối soát được từ ledger ở mọi thời điểm
test('balance luôn = SUM(ledger) qua chuỗi thao tác hỗn hợp', () => {
  const w = wallet();
  w.commission(240000);
  w.commission(180000);
  w.hold(300000);
  w.release(300000);
  w.refund(180000);
  w.hold(240000);
  assert.equal(w.balance, reduceLedger(w.ledger.map((r) => r.amount)));
});
