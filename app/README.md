# DNK Power Conmix — RMC Billing System (MVP Demo)

A ready-mix concrete **billing & dispatch** app built for the DNK Power Conmix lead.
This is an **MVP for sign-off / demo** — the full production build (multi-user server,
cloud backup, e-invoice/e-way bill APIs) comes after project confirmation.

## Three ways to run

1. **Hosted link (share with the client):**
   https://claude.ai/code/artifact/33c3be4e-34c5-41e2-97fa-720674f6ebe2
   Opens in any browser on any device — nothing to install. (Private until you share it.)
2. **Single file (email / USB / host anywhere):** `dnk-rmc.html` — one self-contained
   file, double-click to run, fully offline.
3. **Dev folder:** double-click `index.html` (loads the separate source files).

**Demo login:** user `admin` · password `admin`

All data is saved locally in the browser. Works **fully offline**.

## What the demo shows (the lead's requirement list)

| Requirement | In the demo |
|---|---|
| Customer master (select, don't type) | ✅ Customers page + dropdown on billing |
| Site/project master | ✅ Sites linked to each customer, auto-loads |
| Vehicle & driver master | ✅ Vehicles & Drivers page |
| Concrete grade master (M15…M40, M20S) | ✅ Grades page |
| Rate master (customer + grade wise) | ✅ Rate Master — **auto-fills rate on billing** |
| Daily dispatch entry | ✅ New Dispatch / Bill |
| Automatic GST calculation | ✅ **IGST 18%** other-state, **CGST+SGST 9%+9%** within A.P. |
| Invoice generation (PDF) | ✅ Tally-style tax invoice → Print / **Save as PDF** |
| Delivery challans | ✅ Challan print from Invoices list |
| Outstanding payments | ✅ Outstanding page + record payments |
| Sales reports (daily/monthly) | ✅ Reports page (monthly & customer-wise) |
| Search previous bills instantly | ✅ Live search on Invoices |
| Excel export | ✅ One-click CSV (opens in Excel) |
| User login & backup | ✅ Login + JSON backup/restore |

## The billing flow (what the client should try)

1. **New Dispatch / Bill** → pick **Customer** → Site auto-loads → pick **Grade** →
   **Rate auto-fills** from the rate master → type **Quantity** → GST + total calculate live.
2. Click **Generate Invoice & PDF** → invoice opens → **Print / Save as PDF**.
3. Invoice numbering auto-increments: `DNK/1401`, `DNK/1402`, …

Seeded with the exact data from the sample invoice (S & A INFRA, M-30, 6.50 Cum @ ₹5050,
grand total **₹38,733.50**) so the demo matches the printed bill.

## Files
- `dnk-rmc.html` — **single-file build** (share / host / double-click)
- `index.html` — dev entry (loads the source files below)
- `styles.css` — UI styling (real DNK brand blue / green / gold)
- `app.js` — app logic, masters, GST, storage
- `print.js` — tax invoice / challan template + number-to-words + print overlay
- `assets.js` — embedded DNK logo (`Logo final.png`)
- `build.js` — bundles the source into `dnk-rmc.html` (run `node build.js` after edits)
- `sample-invoice-preview.html` — static preview of a generated invoice

## Note for production (post sign-off)
- Data currently lives in the browser (localStorage). Production = proper database +
  multi-user login + automatic cloud backup.
- Add GST e-Invoice (IRN/QR) and e-Way bill integration.
- Rounding follows correct 18% math; the printed sample had a minor tax-line typo
  (`5908.25` vs the `5908.50` its own total implies) — this app is internally consistent.
