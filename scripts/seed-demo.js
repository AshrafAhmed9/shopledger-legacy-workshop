'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

function seedDemo(starter) {
  const db = structuredClone(starter);
  function corrupt(id, amount, verified) {
    const customer = db.customers.find(row => row.id === id);
    const receiptId = db.nextSettlementId++;
    if (verified) {
      const receiptIds = db.settlements.filter(row => row.customerId === id).map(row => row.id);
      customer.repairCheckpoint = {
        settled: customer.totalSettled,
        afterReceiptId: Math.max(0, ...receiptIds),
        receiptIds: [receiptId]
      };
    }
    // Replay the legacy addition of the submitted form text to the stored total.
    customer.totalSettled += String(amount);
    customer.balance = Math.round(((customer.openingBalance || 0) + customer.totalBilled -
      Number(customer.totalSettled) + 1e-9) * 100) / 100;
    db.settlements.unshift({
      id: receiptId,
      customerId: id,
      customerName: customer.name,
      date: '16/03/2022',
      amount,
      mode: 'cash',
      note: 'Demo receipt'
    });
  }

  corrupt(1, 500, true);
  corrupt(2, 75, false);
  return db;
}

if (require.main === module) {
  const source = path.join(__dirname, '..', 'data', 'db.json');
  const output = process.argv[2] || path.join(__dirname, '..', 'data', 'demo.tmp.json');
  const data = seedDemo(JSON.parse(readFileSync(source, 'utf8')));
  writeFileSync(output, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
  console.log('Wrote demo seed to ' + output);
}

module.exports = { seedDemo };
