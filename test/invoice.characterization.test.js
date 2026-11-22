const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

function item(name, hsn, price, qty = 1) {
  return { name, sku: 'SKU-' + hsn, hsn, price, qty };
}

function discountedOrder() {
  return {
    id: 1002,
    date: '02/01/2022',
    customer: 'Counter customer',
    coupon: 'SAVE10',
    items: [item('Rice', '1006', 510, 2)],
    subtotal: 1020,
    discount: 102,
    tax: 45.90,
    total: 963.90
  };
}

function matchingOrder() {
  return {
    id: 1008,
    items: [item('Tea', '0902', 500)],
    subtotal: 500,
    discount: 0,
    tax: 90,
    total: 590
  };
}

test('CURRENT BEHAVIOUR: SAVE10 invoice taxes gross at 18% and discounts the tax-inclusive amount', () => {
  const order = discountedOrder();
  const checkout = pricing.computeTotals(order.items, order.coupon);
  assert.equal(checkout.discount, 102);
  assert.equal(checkout.tax, 45.90);
  assert.equal(checkout.total, 963.90);

  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.subtotal, 1020);
  assert.equal(printed.discount, 120.36);
  assert.equal(printed.tax, 183.60);
  assert.equal(printed.cgst, 91.80);
  assert.equal(printed.sgst, 91.80);
  assert.equal(printed.total, 1083.24);
  assert.equal(printed.rows[0].gstPercent, 18);
  assert.equal(printed.rows[0].lineTax, 183.60);
});

test('CURRENT BEHAVIOUR: invoice ignores the SAVE10 cap', () => {
  const order = { coupon: 'SAVE10', items: [item('Rice', '1006', 2240)] };
  const checkout = pricing.computeTotals(order.items, order.coupon);
  assert.equal(checkout.discount, 150);
  assert.equal(checkout.total, 2194.50);

  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 264.32);
  assert.equal(printed.total, 2378.88);
});

test('CURRENT BEHAVIOUR: invoice uses its 18% fallback for both 5% and 12% HSN lines', () => {
  const order = { items: [item('Rice', '1006', 200), item('Ghee', '0405', 300)] };
  const checkout = pricing.computeTotals(order.items);
  assert.deepEqual(checkout.lines.map(line => [line.gstPercent, line.tax]), [[5, 10], [12, 36]]);
  assert.equal(checkout.total, 546);

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(line => [line.gstPercent, line.lineTax]), [[18, 36], [18, 54]]);
  assert.equal(printed.tax, 90);
  assert.equal(printed.total, 590);
});

test('CURRENT BEHAVIOUR: a flat coupon does not reduce the taxable invoice amount', () => {
  const order = { coupon: 'FLAT50', items: [item('Tea', '0902', 400)] };
  const checkout = pricing.computeTotals(order.items, order.coupon);
  assert.equal(checkout.discount, 50);
  assert.equal(checkout.tax, 63);
  assert.equal(checkout.total, 413);

  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 50);
  assert.equal(printed.tax, 72);
  assert.equal(printed.total, 422);
});

test('CURRENT BEHAVIOUR: displayed line taxes can sum to more than total GST', () => {
  const order = { items: [item('Tea', '0902', 100.03), item('Coffee', '0901', 100.03), item('Syrup', '2106', 100.03)] };
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(line => line.lineTax), [18.01, 18.01, 18.01]);
  assert.equal(printed.tax, 54.02);
  assert.equal(printed.total, 354.11);
});

test('the undiscounted 18% invoice matches the stored order figures', () => {
  const order = matchingOrder();
  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.tax, order.tax);
  assert.equal(printed.total, order.total);
  assert.equal(printed.discount, order.discount);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('honors an explicit GST percentage and keeps line labels and quantities', () => {
  const printed = invoice.computeInvoiceFigures({
    items: [{ ...item('Rice', '1006', 50, 2), gstRate: 5 }]
  });
  assert.deepEqual(printed.rows, [{
    name: 'Rice', sku: 'SKU-1006', hsn: '1006', qty: 2, price: 50,
    gstPercent: 5, line: 100, lineTax: 5
  }]);
  assert.equal(printed.total, 105);
});

test('CURRENT BEHAVIOUR: printed invoice and GST audit expose the same mismatch without changing the order', () => {
  const order = discountedOrder();
  const cancelledOrder = { ...discountedOrder(), id: 1009, status: 'cancelled' };
  const db = { orders: [order, matchingOrder(), cancelledOrder] };
  const before = structuredClone(db);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹183\.60/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹1083\.24/);
  assert.match(html, /Accountant Reconciliation Notice:.*₹1083\.24.*₹963\.90.*\+₹119\.34/);

  const audit = reports.getGstReconciliation(db);
  assert.equal(audit.totalChecked, 2);
  assert.equal(audit.mismatchCount, 1);
  assert.equal(audit.totalDelta, 119.34);
  assert.deepEqual(audit.rows.map(row => [
    row.orderId, row.ledgerTax, row.invoiceTax, row.ledgerTotal, row.invoiceTotal, row.delta, row.matched
  ]), [
    [1002, 45.90, 183.60, 963.90, 1083.24, 119.34, false],
    [1008, 90, 90, 590, 590, 0, true]
  ]);
  assert.deepEqual(db, before);
});
