const assert = require('node:assert/strict');
const test = require('node:test');

function preview() {
  return require('../lib/khata-repair').preview(...arguments);
}

function customer(changes = {}) {
  return {
    id: 1,
    openingBalance: 450,
    totalBilled: 1982.01,
    totalSettled: '1200500',
    balance: -1198067.99,
    repairCheckpoint: { settled: 1200, afterReceiptId: 503, receiptIds: [505] },
    ...changes
  };
}

function receipts(...entries) {
  return entries.map(([id, amount]) => ({ id, customerId: 1, amount }));
}

test('recovers the original ₹500 payment using a verified checkpoint', () => {
  const account = customer();
  const records = receipts([505, 500], [503, 500], [501, 700]);
  const before = structuredClone({ account, records });
  const result = preview(account, records);
  assert.equal(result.status, 'repairable');
  assert.equal(result.proposedSettled, 1700);
  assert.deepEqual(result.receiptIds, [505]);
  assert.equal(require('../lib/khata-repair').balanceFor(account, result.proposedSettled), 732.01);
  assert.deepEqual({ account, records }, before);
});

test('unwinds two corrupting payments newest first', () => {
  const account = customer({
    totalSettled: '1200500200',
    balance: -1200497767.99,
    repairCheckpoint: { settled: 1200, afterReceiptId: 503, receiptIds: [505, 508] }
  });
  const result = preview(account, receipts([505, 500], [508, 200]));
  assert.equal(result.status, 'repairable');
  assert.equal(result.proposedSettled, 1900);
  assert.deepEqual(result.receiptIds, [508, 505]);
});

test('replays a ₹50.25 receipt exactly in paise', () => {
  const account = customer({ totalSettled: '120050.25', balance: -117618.24 });
  const result = preview(account, receipts([505, 50.25]));
  assert.equal(result.status, 'repairable');
  assert.equal(result.proposedSettled, 1250.25);
  assert.equal(require('../lib/khata-repair').balanceFor(account, result.proposedSettled), 1181.76);
});

test('declines incomplete receipt history even when a suffix matches', () => {
  const account = customer({ repairCheckpoint: { settled: 1200, afterReceiptId: 503, receiptIds: [505, 507] } });
  assert.equal(preview(account, receipts([505, 500])).status, 'needs_review');
  assert.equal(preview(account, []).status, 'needs_review');
});

test('declines a suffix with multiple possible starting totals and no checkpoint', () => {
  const account = customer({ totalSettled: '1234', balance: 1198.01, repairCheckpoint: undefined });
  const result = preview(account, receipts([505, 3], [506, 4]));
  assert.equal(result.status, 'needs_review');
  assert.equal(result.proposedSettled, null);
});

test('leaves a consistent numeric account alone', () => {
  assert.equal(preview(customer({ totalSettled: 1200, balance: 1232.01 }), []).status, 'clean');
});

test('declines numeric-but-inconsistent and mismatched legacy balances', () => {
  assert.equal(preview(customer({ totalSettled: 1200, balance: 1 }), []).status, 'needs_review');
  assert.equal(preview(customer({ balance: 1 }), receipts([505, 500])).status, 'needs_review');
});

test('declines normalized or conflicting receipts that cannot prove the original suffix', () => {
  assert.equal(preview(customer({ totalSettled: '1200500.00' }), receipts([505, 500])).status, 'needs_review');
  assert.equal(preview(customer(), receipts([505, 500], [505, 500])).status, 'needs_review');
  assert.equal(preview(customer(), receipts([505, 500], [506, 200])).status, 'needs_review');
  assert.equal(preview(customer({repairCheckpoint: undefined}), receipts([505, 500])).status, 'needs_review');
});
