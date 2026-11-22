const assert = require('node:assert/strict');
const test = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

function fixture() {
  return { products: [{ id: 1, name: 'Chilli', stock: 4, reserved: 3 }], orders: [], nextOrderId: 1 };
}

function stock(db) {
  const product = db.products[0];
  return [product.stock, product.reserved, inventory.getSellableStock(product)];
}

test('accepts the final unreserved unit', () => {
  const db = fixture();
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 1 }]).ok, true);
  assert.deepEqual(stock(db), [4, 3, 1]);
});

test('returns the last unit once and lets the cashier resell it', () => {
  const db = fixture();
  const items = [{ id: 1, qty: 1 }];
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  assert.deepEqual(stock(db), [3, 3, 0]);
  const order = orders.add(db, { items, status: 'pending' });
  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.deepEqual(stock(db), [4, 3, 1]);
  assert.equal(orders.cancel(db, order.id).ok, false);
  assert.deepEqual(stock(db), [4, 3, 1]);
  assert.equal(inventory.check(db.products, items).ok, true);
  inventory.reserve(db.products, items);
  assert.deepEqual(stock(db), [3, 3, 0]);
});

test('refuses orders beyond available stock without mutation', () => {
  const db = fixture();
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 2 }]).ok, false);
  assert.deepEqual(stock(db), [4, 3, 1]);
});

test('checks combined quantities for repeated lines of the same product', () => {
  const db = fixture();
  db.products[0].stock = 7;
  const items = [{ id: 1, qty: 2 }, { id: '1', qty: 2 }];
  assert.equal(inventory.check(db.products, items).ok, true);
  assert.equal(inventory.check(db.products, [...items, { id: 1, qty: 1 }]).ok, false);
  assert.deepEqual(stock(db), [7, 3, 4]);
});
