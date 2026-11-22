const assert = require('node:assert/strict');
const test = require('node:test');
const dates = require('../lib/dates');
const orders = require('../lib/orders');

function fixture() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021', customer: 'Walk-in' },
      { id: 1002, date: '01/01/2022', customer: 'Meera', status: 'pending' },
      { id: 1004, date: '30/01/2022', customer: 'Meera' },
      { id: 1005, date: '02/02/2022', customer: 'Meera', status: 'pending' },
      { id: 1008, date: '15/03/2022', customer: 'Walk-in' }
    ]
  };
}

function ids(db, filters) {
  return orders.list(db, filters).map(order => order.id);
}

test('CURRENT BEHAVIOUR: history sorts stored dates lexically', () => {
  assert.deepEqual(ids(fixture()), [1004, 1001, 1008, 1005, 1002]);
});

test('CURRENT BEHAVIOUR: cross-year date range returns no orders', () => {
  assert.deepEqual(ids(fixture(), { from: '2021-12-28', to: '2022-02-02' }), []);
});

test('applies customer search and status together', () => {
  assert.deepEqual(ids(fixture(), { search: ' meera ', status: 'pending' }), [1005, 1002]);
});

test('keeps day-first dates in the returned order and leaves storage order unchanged', () => {
  const db = fixture();
  const before = structuredClone(db);
  assert.equal(orders.list(db).find(order => order.id === 1008).date, '15/03/2022');
  assert.deepEqual(db, before);
});

test('keeps fiscal-year handling for both display and date-picker formats', () => {
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('2022-03-31'), 'FY21-22');
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
  assert.equal(dates.getFiscalYear('2022-04-01'), 'FY22-23');
});
