# DNK Power Conmix — RMC Billing & Dispatch System

Ready-Mix Concrete billing software for **DNK Power Conmix** (V.Kota, Chittoor Dist., Andhra Pradesh).
Generates Tally-style GST tax invoices without re-typing customer, vehicle, grade, quantity or GST every time.

> **Status:** MVP / demo for client sign-off. The full production build (server database,
> multi-user, cloud backup, GST e-Invoice IRN/QR + e-Way bill APIs) follows after confirmation.

## Live

| | Link |
|---|---|
| 🧾 Billing app (demo) | https://dnk-powerconmix.web.app |
| 📄 Project proposal | https://dnk-rmc-proposal.web.app |

**Demo login:** sign in as **Administrator** (full access) or **Site Manager** (limited access).

## Features

**Core (usable in the demo)**
- Customer, Site/Project, Vehicle & Driver, Concrete Grade and customer-wise Rate masters
- Daily dispatch entry → auto rate + **automatic GST** (IGST inter-state, CGST+SGST intra-state)
- **Domestic / unregistered buyers (no GSTIN) → No GST (Bill of Supply)**
- Tax invoice & delivery challan (print / save as PDF), auto invoice numbering
- Outstanding payments, daily/monthly & customer-wise reports
- Instant search, Excel/CSV export, JSON backup & restore
- **Customer-wise invoice download** and **customer-wise Toll Register** (running dispatch ledger) + statement PDF
- Role-based login & per-module permissions

**Premium (built, shown locked in the demo — set `DEMO_MODE=false` to unlock)**
- Leads & Follow-up (CRM), Concrete Calculator (site size → cubic metres),
  Revenue Calculator, Users & Permissions management

## Run locally

No build or install needed — it is a self-contained web app.

- **Single file:** open `app/dnk-rmc.html` (double-click) — works fully offline.
- **Dev sources:** open `app/index.html` (loads the separate files below).
  After editing, run `node app/build.js` to regenerate `app/dnk-rmc.html`.

## Project layout

```
app/          Source: index.html, styles.css, app.js, print.js, assets.js (logo), build.js
              → dnk-rmc.html (single-file build)
proposal/     Client proposal page (index.html)
deploy/       Firebase Hosting config (firebase.json, .firebaserc) + public folders
Images/       Logo and sample invoice
TOLL PROJECT.pdf   Reference for the customer toll-register format
```

## Deploy (Firebase Hosting — multisite)

```bash
cd deploy
# refresh public copies after changing source
cp ../app/dnk-rmc.html billing/index.html
cp ../proposal/index.html proposal/index.html
firebase deploy --only hosting --project dnk-rmc-est-817e1
```

## Tech

Vanilla HTML/CSS/JS, no framework, no backend — data stored in the browser (localStorage) with an
in-memory fallback. Chosen for a zero-friction, offline-capable client demo.
