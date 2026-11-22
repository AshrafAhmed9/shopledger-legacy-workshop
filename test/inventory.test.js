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

test('CURRENT BEHAVIOUR: refuses the final unreserved unit', () => {
  const db = fixture();
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 1 }]).ok, false);
  assert.deepEqual(stock(db), [4, 3, 1]);
});

test('CURRENT BEHAVIOUR: cancellation changes status without restocking', () => {
  const db = fixture();
  const items = [{ id: 1, qty: 1 }];
  inventory.reserve(db.products, items);
  const order = orders.add(db, { items, status: 'pending' });
  assert.equal(orders.cancel(db, order.id).ok, true);
  assert.deepEqual(stock(db), [3, 3, 0]);
  assert.equal(orders.cancel(db, order.id).ok, false);
  assert.deepEqual(stock(db), [3, 3, 0]);
});

test('refuses orders beyond available stock without mutation', () => {
  const db = fixture();
  assert.equal(inventory.check(db.products, [{ id: 1, qty: 2 }]).ok, false);
  assert.deepEqual(stock(db), [4, 3, 1]);
});
