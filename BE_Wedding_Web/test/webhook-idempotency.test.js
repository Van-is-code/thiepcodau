'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyEntitlementDelta } = require('../src/utils/entitlementMath');
const { applyWalletAmount, reduceLedger } = require('../src/utils/walletMath');

// Mô phỏng đúng cơ chế của orderService.handlePayosWebhook:
//  - payment_transactions.event_id UNIQUE  -> findOrCreate: created=false nếu trùng
//  - chỉ settle khi order.status ∈ {pending, expired}
//  - settle: +entitlement (1 lần), +commission ví (1 lần), status -> paid
function makeSystem(order) {
  const processedEvents = new Set();
  const wallet = { balance: 0, ledger: [] };
  const customer = { purchased: 0, used: 0, status: 'pending_payment' };
  const o = { ...order };

  function handleWebhook({ eventId, code, amount }) {
    if (processedEvents.has(eventId)) return { processed: false, reason: 'duplicate_event' };
    processedEvents.add(eventId); // ~ INSERT payment_transactions(event_id UNIQUE)

    if (code !== '00') return { processed: false, reason: 'not_success' };
    if (amount !== o.amount) return { processed: false, reason: 'amount_mismatch' };

    if (o.status === 'pending' || o.status === 'expired') {
      // settle
      o.status = 'paid';
      if (customer.status === 'pending_payment') customer.status = 'active';
      const e = applyEntitlementDelta(customer, { delta: o.card_quantity, reason: 'purchase' });
      customer.purchased = e.purchased;
      customer.used = e.used;
      wallet.balance = applyWalletAmount(wallet.balance, o.ctv_earning_amount);
      wallet.ledger.push(o.ctv_earning_amount);
      return { processed: true };
    }
    return { processed: false, reason: `order_already_${o.status}` };
  }

  return { handleWebhook, state: { o, wallet, customer } };
}

test('§24/§31: webhook gửi 2 lần cùng event_id -> chỉ cộng quota & hoa hồng 1 lần', () => {
  const sys = makeSystem({ status: 'pending', amount: 400000, card_quantity: 2, ctv_earning_amount: 240000 });

  const first = sys.handleWebhook({ eventId: 'ref-abc-1', code: '00', amount: 400000 });
  const second = sys.handleWebhook({ eventId: 'ref-abc-1', code: '00', amount: 400000 });
  const third = sys.handleWebhook({ eventId: 'ref-abc-1', code: '00', amount: 400000 });

  assert.equal(first.processed, true);
  assert.equal(second.processed, false);
  assert.equal(second.reason, 'duplicate_event');
  assert.equal(third.processed, false);

  assert.equal(sys.state.customer.purchased, 2);      // KHÔNG phải 4/6
  assert.equal(sys.state.wallet.balance, 240000);     // KHÔNG phải 480k/720k
  assert.equal(reduceLedger(sys.state.wallet.ledger), 240000);
  assert.equal(sys.state.customer.status, 'active');
  assert.equal(sys.state.o.status, 'paid');
});

test('§11: event_id khác nhau nhưng order đã paid -> không cộng lần 2', () => {
  const sys = makeSystem({ status: 'pending', amount: 200000, card_quantity: 1, ctv_earning_amount: 120000 });
  sys.handleWebhook({ eventId: 'evt-1', code: '00', amount: 200000 });
  const again = sys.handleWebhook({ eventId: 'evt-2', code: '00', amount: 200000 });
  assert.equal(again.processed, false);
  assert.match(again.reason, /already_paid/);
  assert.equal(sys.state.customer.purchased, 1);
  assert.equal(sys.state.wallet.balance, 120000);
});

test('§11: sai số tiền -> không settle', () => {
  const sys = makeSystem({ status: 'pending', amount: 300000, card_quantity: 2, ctv_earning_amount: 180000 });
  const r = sys.handleWebhook({ eventId: 'evt-x', code: '00', amount: 250000 });
  assert.equal(r.processed, false);
  assert.equal(r.reason, 'amount_mismatch');
  assert.equal(sys.state.o.status, 'pending');
  assert.equal(sys.state.customer.status, 'pending_payment');
});

test('§11: code != 00 -> không settle', () => {
  const sys = makeSystem({ status: 'pending', amount: 300000, card_quantity: 2, ctv_earning_amount: 180000 });
  const r = sys.handleWebhook({ eventId: 'evt-y', code: '01', amount: 300000 });
  assert.equal(r.processed, false);
  assert.equal(sys.state.o.status, 'pending');
});

test('§29: đơn expired vẫn settle được khi khách trả trễ (link cũ)', () => {
  const sys = makeSystem({ status: 'expired', amount: 220000, card_quantity: 1, ctv_earning_amount: 132000 });
  const r = sys.handleWebhook({ eventId: 'evt-late', code: '00', amount: 220000 });
  assert.equal(r.processed, true);
  assert.equal(sys.state.o.status, 'paid');
  assert.equal(sys.state.customer.status, 'active');
});
