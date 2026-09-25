'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyEntitlementDelta } = require('../src/utils/entitlementMath');

// Mô phỏng chuỗi biến động cho 1 khách.
const run = (events) => {
  let s = { purchased: 0, used: 0 };
  const trail = [];
  for (const e of events) {
    const r = applyEntitlementDelta(s, e);
    s = { purchased: r.purchased, used: r.used };
    trail.push(r);
  }
  return { state: s, last: trail[trail.length - 1], trail };
};

// ----- §35 Case 4: mua 1 + mua thêm 1 = 2 lượt (KHÔNG auto combo) -----
test('Case 4: mua 1 rồi mua thêm 1 -> available 2 (2 giao dịch lẻ độc lập)', () => {
  const { last } = run([
    { delta: 1, reason: 'purchase' },
    { delta: 1, reason: 'purchase' }
  ]);
  assert.equal(last.purchased, 2);
  assert.equal(last.used, 0);
  assert.equal(last.available, 2);
});

// ----- §35 Case 5: mua combo ngay từ đầu -> +2 -----
test('Case 5: mua combo -> available += 2 trong 1 lần', () => {
  const { last } = run([{ delta: 2, reason: 'purchase' }]);
  assert.equal(last.purchased, 2);
  assert.equal(last.available, 2);
});

// ----- §16: Purchased / Used / Available rõ ràng -----
test('§16: Purchased 3, Used 2, Available 1', () => {
  const { last } = run([
    { delta: 2, reason: 'purchase' },
    { delta: 1, reason: 'purchase' },
    { delta: -1, reason: 'card_created' },
    { delta: -1, reason: 'card_created' }
  ]);
  assert.deepEqual([last.purchased, last.used, last.available], [3, 2, 1]);
});

// ----- §14/§15: mua thêm nhiều lần cho khách cũ -----
test('§15: khách có 2, mua thêm 1 -> 3', () => {
  const { last } = run([
    { delta: 2, reason: 'purchase' },
    { delta: 1, reason: 'purchase' }
  ]);
  assert.equal(last.available, 3);
});

test('§14: 4 đơn 1 thiệp liên tiếp -> available 4', () => {
  const { last } = run(Array.from({ length: 4 }, () => ({ delta: 1, reason: 'purchase' })));
  assert.equal(last.available, 4);
});

// ----- §16: không cho Available < 0 (kẹp về 0, cờ cảnh báo) -----
test('§16: tạo thiệp khi hết quyền -> available kẹp 0, warn_negative', () => {
  const r = applyEntitlementDelta({ purchased: 1, used: 1 }, { delta: -1, reason: 'card_created' });
  assert.equal(r.available, 0);
  assert.equal(r.available_raw, -1);
  assert.equal(r.warn_negative, true);
});

// ----- §22: refund đảo entitlement -----
test('§22: refund đơn combo -> purchased -= 2', () => {
  const { last } = run([
    { delta: 2, reason: 'purchase' },
    { delta: -2, reason: 'refund' }
  ]);
  assert.equal(last.purchased, 0);
  assert.equal(last.available, 0);
});

test('refund khi thiệp đã dùng -> available 0, cờ cảnh báo bật', () => {
  const { last } = run([
    { delta: 1, reason: 'purchase' },
    { delta: -1, reason: 'card_created' },
    { delta: -1, reason: 'refund' }
  ]);
  assert.equal(last.available, 0);
  assert.equal(last.warn_negative, true); // purchased(0) - used(1) = -1
});

test('reason lạ bị từ chối', () => {
  assert.throws(() => applyEntitlementDelta({ purchased: 0, used: 0 }, { delta: 1, reason: 'x' }), /reason/);
});
