# ShopLedger

ShopLedger is a Node.js and Express app for retail and wholesale checkout,
inventory, GST invoices, order history, and customer credit (Khata). The
browser interface uses plain HTML, CSS, and JavaScript.

## Module map

- `server.js` serves the UI, mounts the API routers, and renders invoices.
- `routes/` contains the products, orders, customers, and reports APIs.
- `lib/orders.js` and `lib/dates.js` handle order history and date utilities.
- `lib/ledger.js` handles Khata charges, settlements, and balances.
- `lib/inventory.js` handles stock checks, deductions, and releases.
- `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`, and `lib/invoice.js`
  calculate checkout amounts and render invoice figures.
- `lib/reports.js` builds dashboard and reconciliation reports.
- `lib/store.js` reads and writes `data/db.json`. `config.js` defines shop
  settings and business rules.

## Commands

- Use Node.js 22 or newer.
- Install the existing dependencies with `npm install`.
- Start the app with `npm start`. Open `http://localhost:3000`.
- Run the workshop tests with `node --test`.

## Working rules

1. Write and run characterization tests before changing behavior.
2. Limit production edits to the modules involved in the selected ticket.
3. Automated tests must never read or write `data/db.json`. Use in-memory
   fixtures. Reproduce app behavior in a disposable copy of the project.
4. Add no dependencies.
