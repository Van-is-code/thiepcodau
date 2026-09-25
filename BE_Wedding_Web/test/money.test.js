'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { roundVnd, computeCommission, assertAboveFloor } = require('../src/utils/money');

test('roundVnd làm tròn về đồng, nhận string/number', () => {
  assert.equal(roundVnd('200000'), 200000);
  assert.equal(roundVnd('300000.00'), 300000);
  assert.equal(roundVnd(159999.6), 160000);
  assert.equal(roundVnd(0), 0);
});

// ----- §35 Case 1: CTV single = 250k, hoa hồng 40% -> platform 100k, CTV 150k -----
test('Case 1: single 250k @ 40% -> platform 100k, ctv 150k', () => {
  const r = computeCommission(250000, 0.4);
  assert.equal(r.commissionAmount, 100000);
  assert.equal(r.ctvEarningAmount, 150000);
});

// ----- §35 Case 2: CTV combo = 400k, hoa hồng 40% -> platform 160k, CTV 240k -----
test('Case 2: combo 400k @ 40% -> platform 160k, ctv 240k', () => {
  const r = computeCommission(400000, 0.4);
  assert.equal(r.commissionAmount, 160000);
  assert.equal(r.ctvEarningAmount, 240000);
});

test('Hoa hồng 10/20/30/40% trên 400k', () => {
  assert.equal(computeCommission(400000, 0.1).commissionAmount, 40000);
  assert.equal(computeCommission(400000, 0.2).commissionAmount, 80000);
  assert.equal(computeCommission(400000, 0.3).commissionAmount, 120000);
  assert.equal(computeCommission(400000, 0.4).commissionAmount, 160000);
  assert.equal(computeCommission(400000, 0.3).ctvEarningAmount, 280000);
});

test('commission_rate ngoài [0,1] bị từ chối', () => {
  assert.throws(() => computeCommission(200000, 1.2), /commission_rate/);
  assert.throws(() => computeCommission(200000, -0.1), /commission_rate/);
});

// ----- §35 Case 3: CTV nhập single = 180k -> reject (dưới sàn 200k) -----
test('Case 3: single 180k < sàn 200k -> reject', () => {
  assert.throws(() => assertAboveFloor(180000, 200000, 'Giá thiệp lẻ'), /không được thấp hơn giá sàn/);
});

test('Giá = sàn thì hợp lệ; giá > sàn thì hợp lệ', () => {
  assert.equal(assertAboveFloor(200000, 200000), 200000);
  assert.equal(assertAboveFloor(220000, 200000), 220000);
  assert.equal(assertAboveFloor(300000, 300000), 300000);
});

test('Giá <= 0 bị từ chối', () => {
  assert.throws(() => assertAboveFloor(0, 200000), /số dương/);
  assert.throws(() => assertAboveFloor(-5, 200000), /số dương/);
});

// ----- Snapshot bất biến: đổi rate sau khi "chốt đơn" không đổi số đã lưu -----
test('Snapshot hoa hồng: số đã chốt không đổi khi rate đổi về sau', () => {
  const atOrderTime = computeCommission(400000, 0.4); // đơn tạo lúc rate 40%
  const frozen = { ...atOrderTime };
  // Admin đổi CTV sang 30% sau đó -> tính lại chỉ để so sánh, KHÔNG ghi đè đơn.
  const later = computeCommission(400000, 0.3);
  assert.equal(frozen.commissionAmount, 160000);
  assert.equal(frozen.ctvEarningAmount, 240000);
  assert.notEqual(frozen.commissionAmount, later.commissionAmount);
});
