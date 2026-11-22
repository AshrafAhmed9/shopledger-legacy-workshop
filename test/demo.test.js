const assert = require('node:assert/strict');
const test = require('node:test');

function base() {
  return {
    customers: [
      { id: 1, name: 'Meera', openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200, balance: 1232.01 },
      { id: 2, name: 'Another account', openingBalance: 0, totalBilled: 350, totalSettled: 200, balance: 150 }
    ],
    settlements: [{ id: 503, customerId: 1, amount: 500 }],
    nextSettlementId: 505,
    orders: [{ id: 1002 }],
    products: [{ id: 10, stock: 4, reserved: 3 }],
    auditLog: []
  };
}

test('creates repair and review examples without editing the starter data', () => {
  const source = base();
  const before = structuredClone(source);
  const seeded = require('../scripts/seed-demo').seedDemo(source);
  const repair = require('../lib/khata-repair');
  const classify = customer => repair.preview(customer, seeded.settlements.filter(r => r.customerId === customer.id));
  assert.equal(seeded.customers[0].balance, -1198067.99);
  assert.equal(classify(seeded.customers[0]).proposedSettled, 1700);
  assert.equal(classify(seeded.customers[1]).status, 'needs_review');
  assert.deepEqual(seeded.orders, before.orders);
  assert.deepEqual(seeded.products, before.products);
  assert.deepEqual(source, before);
});

test('visitor writes and resets stay inside their own demo session', () => {
  const demo = require('../lib/demo-store');
  const middleware = demo.createMiddleware(base());
  function request(cookie, action) {
    let id;
    middleware({ headers: { cookie } }, {
      cookie(name, value, options) {
        assert.equal(name, 'shopledger_demo');
        assert.equal(options.httpOnly, true);
        id = value;
      }
    }, action);
    return id;
  }
  const first = request('', () => {
    const db = demo.current().read();
    db.products[0].stock = 3;
    demo.current().write(db);
  });
  const second = request('', () => assert.equal(demo.current().read().products[0].stock, 4));
  assert.notEqual(first, second);
  request('shopledger_demo=' + first, () => {
    assert.equal(demo.current().read().products[0].stock, 3);
    demo.current().reset();
    assert.equal(demo.current().read().products[0].stock, 4);
  });
  request('shopledger_demo=' + second, () => assert.equal(demo.current().read().products[0].stock, 4));
  assert.equal(demo.current(), undefined);
});
