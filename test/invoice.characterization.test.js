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

test('SAVE10 invoice matches billed GST and discounts before tax', () => {
  const order = discountedOrder();
  const checkout = pricing.computeTotals(order.items, order.coupon);
  assert.equal(checkout.discount, 102);
  assert.equal(checkout.tax, 45.90);
  assert.equal(checkout.total, 963.90);

  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.subtotal, 1020);
  assert.equal(printed.discount, 102);
  assert.equal(printed.tax, 45.90);
  assert.equal(printed.cgst, 22.95);
  assert.equal(printed.sgst, 22.95);
  assert.equal(printed.total, 963.90);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 45.90);
});

test('invoice honors the SAVE10 discount cap', () => {
  const order = { coupon: 'SAVE10', items: [item('Rice', '1006', 2240)] };
  const checkout = pricing.computeTotals(order.items, order.coupon);
  assert.equal(checkout.discount, 150);
  assert.equal(checkout.total, 2194.50);

  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 150);
  assert.equal(printed.total, 2194.50);
});

test('invoice uses the actual 5% and 12% HSN rates', () => {
  const order = { items: [item('Rice', '1006', 200), item('Ghee', '0405', 300)] };
  const checkout = pricing.computeTotals(order.items);
  assert.deepEqual(checkout.lines.map(line => [line.gstPercent, line.tax]), [[5, 10], [12, 36]]);
  assert.equal(checkout.total, 546);

  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(line => [line.gstPercent, line.lineTax]), [[5, 10], [12, 36]]);
  assert.equal(printed.tax, 46);
  assert.equal(printed.total, 546);
});

test('a flat coupon reduces the taxable invoice amount', () => {
  const order = { coupon: 'FLAT50', items: [item('Tea', '0902', 400)] };
  const checkout = pricing.computeTotals(order.items, order.coupon);
  assert.equal(checkout.discount, 50);
  assert.equal(checkout.tax, 63);
  assert.equal(checkout.total, 413);

  const printed = invoice.computeInvoiceFigures(order);
  assert.equal(printed.discount, 50);
  assert.equal(printed.tax, 63);
  assert.equal(printed.total, 413);
});

test('displayed line taxes add up to the checkout GST', () => {
  const order = { items: [item('Tea', '0902', 100.03), item('Coffee', '0901', 100.03), item('Syrup', '2106', 100.03)] };
  const printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual(printed.rows.map(line => line.lineTax), [18.01, 18.01, 18.01]);
  assert.equal(printed.tax, 54.03);
  assert.equal(printed.total, 354.12);
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

test('printed invoice and GST audit agree with checkout without changing the order', () => {
  const order = discountedOrder();
  const cancelledOrder = { ...discountedOrder(), id: 1009, status: 'cancelled' };
  const db = { orders: [order, matchingOrder(), cancelledOrder] };
  const before = structuredClone(db);
  const html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.90/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const audit = reports.getGstReconciliation(db);
  assert.equal(audit.totalChecked, 2);
  assert.equal(audit.mismatchCount, 0);
  assert.equal(audit.totalDelta, 0);
  assert.deepEqual(audit.rows.map(row => [
    row.orderId, row.ledgerTax, row.invoiceTax, row.ledgerTotal, row.invoiceTotal, row.delta, row.matched
  ]), [
    [1002, 45.90, 45.90, 963.90, 963.90, 0, true],
    [1008, 90, 90, 590, 590, 0, true]
  ]);
  assert.deepEqual(db, before);
});

test('GST audit and invoice warning remain independent of the stored figures', () => {
  const totalMismatch = { ...matchingOrder(), total: 589.99 };
  const taxMismatch = { ...matchingOrder(), id: 1010, tax: 89.99 };
  const audit = reports.getGstReconciliation({ orders: [totalMismatch, taxMismatch] });
  assert.equal(audit.mismatchCount, 2);
  assert.equal(audit.totalDelta, 0.01);
  assert.deepEqual(audit.rows.map(row => row.matched), [false, false]);
  assert.match(invoice.render(totalMismatch), /Accountant Reconciliation Notice/);
});
