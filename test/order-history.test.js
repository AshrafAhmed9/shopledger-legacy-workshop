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

test('sorts order history by calendar date, newest first', () => {
  assert.deepEqual(ids(fixture()), [1008, 1005, 1004, 1002, 1001]);
});

test('applies both date bounds inclusively across years', () => {
  assert.deepEqual(ids(fixture(), { from: '2021-12-28', to: '2022-02-02' }), [1005, 1004, 1002, 1001]);
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

test('supports one-sided filters and either supported input format', () => {
  const db = fixture();
  assert.deepEqual(ids(db, { from: '30/01/2022' }), [1008, 1005, 1004]);
  assert.deepEqual(ids(db, { to: '2022-01-01' }), [1002, 1001]);
  assert.deepEqual(ids(db, { from: '2022-01-01', to: '01/01/2022' }), [1002]);
});

test('compares mixed formats and puts the newer order first within a day', () => {
  const db = fixture();
  db.orders.push({ id: 1009, date: '2022-01-30' });
  assert.deepEqual(ids(db, { from: '2022-01-30', to: '2022-01-30' }), [1009, 1004]);
});

test('rejects malformed and impossible calendar keys without changing fiscal parsing', () => {
  assert.equal(dates.toCalendarKey('bad'), '');
  assert.equal(dates.toCalendarKey('2022-02-30'), '');
  assert.equal(dates.toCalendarKey('29/02/2024'), '2024-02-29');
});
