# ShopLedger

ShopLedger is a small point-of-sale app for invoices, inventory, and customer credit (Khata).

Hosted demo URL pending. Run the same resettable demo locally with the commands below.

## What changed

| Issue | Before | After |
| --- | --- | --- |
| Invoice totals | Order #1002 printed ₹1,083.24 with ₹183.60 GST. | The invoice matches the ₹963.90 checkout total and ₹45.90 GST. |
| Sellable stock | Checkout refused the last available unit even while one was in stock. | Sell, cancel, and resell moves available stock through 1, 0, 1, and 0. The three wholesale holds stay intact. |
| Order History and Khata | The cross-year filter returned no orders. A ₹500 payment left a balance of −₹11,98,067.99. | The filter returns the five orders in range. The same payment leaves ₹732.01 due. |

## Repairing a damaged Khata balance

Open **Customer Khata** and select **Review balance**. Meera’s demo account has a verified starting total and receipt list. The preview shows the old value, the proposed ₹1,700.00 settled total, and the receipt used. Apply the repair and reload to see ₹732.01 due. Applying the same repair again leaves the account and the audit trail alone.

The second demo account requires manual review. Repair needs both the verified starting total and a complete matching list of later receipts. A numeric suffix by itself can support several different balances. Unverified, missing, conflicting, or non-exact records stay in review.

## Run locally

Use Node.js 22 or newer.

```sh
npm install
node --test
DEMO_MODE=1 npm start
```

Open http://localhost:3000. **Reset demo** restores the synthetic records for the current browser session. Use `npm start` without demo mode to run against the original JSON fixture. The seed script can also write a separate file with `node scripts/seed-demo.js data/demo.tmp.json`.

The anonymous demo keeps synthetic changes in memory. A restart clears them. Invoice reprints use the current pricing rules because orders contain no historical rule snapshot.
