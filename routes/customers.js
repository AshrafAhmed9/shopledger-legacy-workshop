var express = require('express');
var store = require('../lib/store');
var ledger = require('../lib/ledger');
var repair = require('../lib/khata-repair');

var router = express.Router();

router.get('/customers', function (req, res) {
  var db = store.read();
  res.json({
    customers: ledger.listCustomers(db),
    settlements: (db.settlements || []).slice(0, 25)
  });
});

function describeRepair(db, customer) {
  var receipts = (db.settlements || []).filter(function (receipt) {
    return receipt.customerId === customer.id;
  });
  var result = repair.preview(customer, receipts);
  return Object.assign(result, {
    oldSettled: customer.totalSettled,
    oldBalance: customer.balance,
    proposedBalance: result.status === 'repairable' ? repair.balanceFor(customer, result.proposedSettled) : null
  });
}

router.get('/customers/:id/repair-preview', function (req, res) {
  var db = store.read();
  var customer = ledger.findCustomer(db, req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.set('Cache-Control', 'no-store').json(describeRepair(db, customer));
});

router.post('/customers/:id/repair', function (req, res) {
  var db = store.read();
  var customer = ledger.findCustomer(db, req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  var proposal = describeRepair(db, customer);
  if (proposal.status === 'clean') return res.json({ applied: false, balance: customer.balance });
  if (proposal.status !== 'repairable') return res.status(409).json({ error: proposal.reason });
  var body = req.body || {};
  if (body.expectedOldSettled !== undefined && body.expectedOldSettled !== proposal.oldSettled) {
    return res.status(409).json({ error: 'The account changed. Review its current balance before applying.' });
  }

  customer.totalSettled = proposal.proposedSettled;
  customer.balance = proposal.proposedBalance;
  store.appendAudit(db, 'KHATA_REPAIR', JSON.stringify({
    customerId: customer.id,
    oldSettled: proposal.oldSettled,
    newSettled: customer.totalSettled,
    receiptIds: proposal.receiptIds
  }));
  store.write(db);
  res.json({ applied: true, balance: customer.balance, receiptIds: proposal.receiptIds });
});

router.post('/customers/:id/settle', function (req, res) {
  var db = store.read();
  var body = req.body || {};

  // Pass amount directly from request payload
  var result = ledger.recordSettlement(
    db,
    req.params.id,
    body.amount,
    body.mode || 'upi',
    body.note || ''
  );

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  store.appendAudit(
    db,
    'KHATA_SETTLEMENT',
    result.customer.name + ' settled ₹' + body.amount + ' via ' + (body.mode || 'upi').toUpperCase()
  );
  store.write(db);

  res.status(201).json(result);
});

module.exports = router;
