const assert = require('node:assert/strict');
const test = require('node:test');
const ledger = require('../lib/ledger');

function fixture() {
  return {
    customers: [{
      id: 1,
      name: 'Customer',
      openingBalance: 450,
      totalBilled: 1982.01,
      totalSettled: 1200,
      balance: 1232.01
    }],
    nextSettlementId: 51,
    settlements: []
  };
}

test('CURRENT BEHAVIOUR: a string payment concatenates the settled total', () => {
  const db = fixture();
  const result = ledger.recordSettlement(db, 1, '500', 'cash', 'Counter receipt');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, '1200500');
  assert.equal(result.customer.balance, -1198067.99);
  assert.equal(result.settlement.amount, 500);
});

test('numeric payments update the balance and preserve receipt data', () => {
  const db = fixture();
  const result = ledger.recordSettlement(db, 1, 500.25, 'cash', 'Counter receipt');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700.25);
  assert.equal(result.customer.balance, 731.76);
  assert.equal(result.settlement.id, 51);
  assert.equal(result.settlement.amount, 500.25);
  assert.equal(result.settlement.mode, 'cash');
  assert.equal(result.settlement.note, 'Counter receipt');
  assert.deepEqual(db.settlements, [result.settlement]);
  assert.equal(db.nextSettlementId, 52);
});

test('a zero or negative payment leaves ledger and receipt sequence untouched', () => {
  for (const amount of [0, -1, '0', '-1', '', null]) {
    const db = fixture();
    const before = structuredClone(db);
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false);
    assert.deepEqual(db, before);
  }
});

test('unknown customer creates no receipt', () => {
  const db = fixture();
  const before = structuredClone(db);
  assert.equal(ledger.recordSettlement(db, 999, '500').ok, false);
  assert.deepEqual(db, before);
});
