var dates = require('./dates');

function round2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

function findCustomer(db, id) {
  if (!id || !db.customers) return null;
  for (var i = 0; i < db.customers.length; i++) {
    if (db.customers[i].id == id) return db.customers[i];
  }
  return null;
}

exports.findCustomer = findCustomer;

exports.listCustomers = function (db) {
  return (db.customers || []).map(function (c) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      type: c.type || 'Retail',
      gstin: c.gstin || '',
      creditLimit: c.creditLimit || 5000,
      openingBalance: c.openingBalance || 0,
      totalBilled: c.totalBilled || 0,
      totalSettled: c.totalSettled || 0,
      balance: round2((c.openingBalance || 0) + (c.totalBilled || 0) - (c.totalSettled || 0))
    };
  });
};

// Called when an order is placed with paymentMode === 'khata'
exports.chargeOrderToKhata = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer account not found for Khata billing' };

  var currentBalance = round2((c.openingBalance || 0) + (c.totalBilled || 0) - (c.totalSettled || 0));
  var projected = round2(currentBalance + Number(orderTotal));

  if (c.creditLimit && projected > c.creditLimit) {
    return {
      ok: false,
      error: 'Khata credit limit exceeded for ' + c.name + ' (Limit: ₹' + c.creditLimit + ', Projected: ₹' + projected.toFixed(2) + ')'
    };
  }

  c.totalBilled = round2((c.totalBilled || 0) + Number(orderTotal));
  c.balance = round2((c.openingBalance || 0) + c.totalBilled - (c.totalSettled || 0));
  return { ok: true, customer: c };
};

exports.reverseOrderDebit = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return;
  c.totalBilled = Math.max(0, round2((c.totalBilled || 0) - Number(orderTotal)));
  c.balance = round2((c.openingBalance || 0) + c.totalBilled - (c.totalSettled || 0));
};

// Records a customer payment settling their outstanding Khata balance
exports.recordSettlement = function (db, customerId, amount, mode, note) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer not found' };

  var payment = amount;
  if (typeof amount === 'string') {
    payment = /^\d+(\.\d{1,2})?$/.test(amount.trim()) ? Number(amount) : NaN;
  }
  if (!Number.isFinite(payment) || payment <= 0 || payment !== round2(payment)) {
    return { ok: false, error: 'Enter a positive settlement amount in rupees and paise' };
  }

  var receivable = (c.openingBalance || 0) + (c.totalBilled || 0);
  var priorSettled = c.totalSettled;
  if (!Number.isFinite(priorSettled) || !Number.isFinite(c.balance) ||
      round2(receivable - priorSettled) !== c.balance) {
    return { ok: false, error: 'This Khata account needs reconciliation before recording a settlement' };
  }

  var totalSettled = round2(priorSettled + payment);
  var balance = round2(receivable - totalSettled);
  if (!Number.isFinite(totalSettled) || !Number.isFinite(balance)) {
    return { ok: false, error: 'Settlement would produce an invalid balance' };
  }
  c.totalSettled = totalSettled;
  c.balance = balance;

  var entry = {
    id: db.nextSettlementId++,
    customerId: c.id,
    customerName: c.name,
    date: dates.today(),
    amount: payment,
    mode: mode || 'upi',
    note: note || 'Khata settlement'
  };

  if (!db.settlements) db.settlements = [];
  db.settlements.unshift(entry);

  return {
    ok: true,
    settlement: entry,
    customer: c
  };
};
