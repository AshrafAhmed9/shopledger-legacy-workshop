var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var config = require('./config');
var store = require('./lib/store');
var orders = require('./lib/orders');
var invoice = require('./lib/invoice');
var demo = require('./lib/demo-store');
var seedDemo = require('./scripts/seed-demo').seedDemo;

var productRoutes = require('./routes/products');
var orderRoutes = require('./routes/orders');
var customerRoutes = require('./routes/customers');
var reportRoutes = require('./routes/reports');

var app = express();
app.get('/healthz', function (req, res) { res.sendStatus(200); });
app.use(bodyParser.json());
if (process.env.DEMO_MODE === '1') {
  if (process.env.RENDER === 'true') app.set('trust proxy', 1);
  app.use(demo.createMiddleware(seedDemo(store.read())));
  app.use('/api', function (req, res, next) {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/admin/export', function (req, res) { res.sendStatus(404); });
  app.get('/api/demo', function (req, res) { res.json({ enabled: true }); });
  app.post('/api/demo/reset', function (req, res) {
    demo.current().reset();
    res.json({ reset: true });
  });
}
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', productRoutes);
app.use('/api', orderRoutes);
app.use('/api', customerRoutes);
app.use('/api', reportRoutes);

// Added Nov 2021 (Neha): Printable HTML invoice view for the accountant
app.get('/orders/:id/invoice', function (req, res) {
  var db = store.read();
  var o = orders.get(db, req.params.id);
  if (!o) return res.status(404).send('Order not found');
  res.send(invoice.render(o));
});

// app.get('/api/orders/:id/pdf', function (req, res) { ... });  // never finished

if (require.main === module) {
  app.listen(config.port, function () {
    console.log('ShopLedger listening on http://localhost:' + config.port);
  });
}

module.exports = app;
