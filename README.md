# Ritvan POS

Ritvan POS is a desktop-first point-of-sale and inventory system built with React, Vite, Tailwind CSS, Express, and local MySQL.

## Current milestone: Phase 11 — operating spendings and item sales analytics

The draft feature branch now includes:
- Premium sign-in, role-aware navigation, same-Wi-Fi LAN support, and a responsive light/dark workspace.
- Database-backed POS, checkout, transaction history, item catalog, inventory adjustments, stock movement ledger and Admin reconciliation.
- **Item editing:** Admins/Managers can update an item's name, SKU, barcode, category, selling price, low-stock threshold and product photo after creation. Changes are validated server-side and written to the audit log. On-hand quantity and weighted-average cost are deliberately excluded from the editor; they can only change through the stock/receiving workflows.
- **Category editing:** Admins/Managers can edit category name and description and update active/inactive status. The API validates duplicate names and retains linked item history.
- **Purchase order editing:** Admins/Managers can edit the supplier, date, notes, line items, quantities and unit costs while an order is still `ORDERED` and nothing has been received. Once any quantity is received, the API rejects edits so stock/WAC history cannot be rewritten. Every edit is audited.
- **Purchase order cancellation:** Admins/Managers can cancel an `ORDERED` purchase only while no quantities have been received. Cancellation is transaction-protected, updates the order to `CANCELLED`, and writes a `PURCHASE_CANCELLED` audit record. It does not change on-hand stock or weighted-average cost. Received, partially received, and already cancelled purchases cannot be cancelled.
- **Per-user permissions:** Admins can open **Permissions** for Manager/Cashier accounts, choose which workspace modules they may open, and choose which table columns are visible in each enabled table. The server enforces module access and role limits; Admin accounts always retain full access. Item average cost is omitted from the item-list API when the signed-in user has no enabled Items/Inventory average-cost column.
- **Store branding:** Admins can upload a compressed transparent PNG logo in Settings. Uploads preserve alpha and save immediately; the saved logo and business name are used in the workspace switcher, POS receipt preview, transaction print receipt and generated WhatsApp receipt PNG.
- **Business customers:** Admins/Managers may mark an existing or new customer as a business. Customer statistics report saved completed sales linked to customers currently marked as businesses. Changing the classification also reclassifies that customer's historical sales in this aggregate; the underlying transactions remain unchanged.
- **Customer Khata:** Credit is offered at checkout only when a registered active customer is selected. Credit sales and repayments are stored in an append-only customer ledger; the Customers page shows outstanding balances, ledger history, and a Record payment action. Overpayments are rejected and repayment actions are audited.
- **Top sellers and Khata dashboard:** The dashboard shows the top five products by units sold, with order discounts reflected in product sales amounts. The payment-method chart reports actual paid collections only; Khata sales are shown separately from cash/UPI/card collected. The Khata panel shows total outstanding balance, customers owing, and credit sales for the selected period only to users with customer-balance permission.

- SKU auto-generation when creating an item without a custom code, compressed item-photo storage in MySQL, live product photos in the POS/catalog, and receipt-only printing.
- **Split payments:** At checkout, a cashier can divide one sale between two or three distinct methods (Cash, UPI and/or Card). Each tender amount and optional reference is saved as its own payment row in the same transaction; amounts must total the discounted sale exactly. Receipts, payment reports, the recent-sales dashboard and transaction history retain the split breakdown without duplicating the sale.
- **WhatsApp receipts:** POS lets the cashier choose a saved customer (autofilling their phone) or enter a WhatsApp number for a walk-in. The branded PNG uses the uploaded store logo and saved business name, plus receipt number/date, customer, line items, discount, total and split tender amounts when applicable. Supported phones can share the image via the native share sheet; otherwise the PNG is downloaded and attached manually in the customer's WhatsApp chat. A WhatsApp click-to-chat URL cannot attach a local image automatically. Ten-digit local numbers default to India (+91); enter a full country code for other countries.
- Supplier/customer directories, purchase orders and receiving with weighted-average-cost updates.
- Searchable transaction history and partial returns with quantity/refund checks, optional restocking, manual settlement records, stock movements and audit history.
- Admin-only staff-account management: invite app users, assign app roles, activate/deactivate accounts, and reset passwords. Protected APIs reload current account role/status.
- **My Profile:** every signed-in user can update their own name, email and optional phone number, and change their password after confirming the current password. Role, permissions and account status stay protected from self-editing; profile changes are recorded in the audit log.
- **Employee directory and payroll (Phase 6):** a separate Admin-only employee register supports compressed profile photos, phone, joining date, job title, monthly salary and recurring salary due day. Optional Aadhaar is encrypted using AES-256-GCM before storage; the API shows only the final four digits. Monthly payroll is generated once as a salary snapshot and can be marked paid/unpaid with audit history.
- **Employee expenses:** record company-paid expenses with their payment method or schedule a salary deduction for the next calendar month's payroll. Deductions are applied in order and unused amounts carry forward if they exceed that month's salary. A deduction cannot be added to a month whose payroll has already been generated; generate payroll after recording that month's planned deductions.
- Persisted business name, currency, locale, timezone and receipt footer; the sidebar uses the saved business name and stock alerts use each item's configured threshold.
- **Operating Spendings (Phase 11):** Admins and Managers can record, edit and void day-to-day store expenses with date, category, reason, amount, payment method, payee, reference and notes. Voided entries stay in the audit trail and are excluded from totals. Dashboard KPIs, recent spendings, category/payment breakdowns and period filters use saved MySQL records. Employee payroll expenses remain separate to avoid double-counting.
- **Product sales analysis:** period-based item performance includes units sold/returned, gross line sales, proportionally allocated sale discounts, recorded item refunds and net item sales, with a dedicated CSV export.
- GitHub Actions checks the frontend production build and backend JavaScript syntax.

**Phase 11 adds operating spendings and item-level sales analytics; this feature branch is still not a production-readiness certification.** Tax collection remains disabled until its rate/calculation policy is approved; returns record a manual settlement method but do not transfer funds through a payment gateway. End-to-end, multi-device concurrency, rollback and security testing with your local MySQL setup is still required before real-store use.

## Item identifiers
When creating an item, the SKU field is optional. If you leave it blank, the API generates a unique `NX-` SKU at save time. If you enter your own SKU, it must be unique. A **SKU (Stock Keeping Unit)** is your internal code for identifying a product or product variant, for example `CHO-050` for a 50 g chocolate bar or `NX-1001` for a general product code. Each distinct item should have its own unique SKU. A barcode is a separate scannable identifier; it does not have to be the same as the SKU. Item creation also supports an optional product photo: select a JPEG, PNG or WebP image (up to 8 MB before resizing). Photos keep their aspect ratio in a consistent, contain-fit frame; transparent PNG/WebP uploads retain transparency, while opaque photos are compressed to JPEG. The API stores the image in MySQL, so no separate uploads folder is needed.

## Stack
- Frontend: React + Vite + Tailwind CSS, Lucide, Recharts
- Backend: Node.js + Express REST API
- Database: local MySQL 8+
- The browser calls Express; it must never connect directly to MySQL.

## Run locally
Requirements: Node.js 20+ (22 recommended) and MySQL 8+.

### Important: preserve data when switching to `ritvan_pos`
The current database name is `ritvan_pos`. If your existing data is still in the earlier `nexora_pos_cg` schema, migrate a copy before starting the updated API:

1. Stop the API so no sales are written during the copy.
2. In MySQL Workbench, choose **Server → Data Export**, select `nexora_pos_cg` and all its tables, choose **Dump Structure and Data**, and export to a self-contained SQL file. Keep the original export as a backup.
3. Make a **copy** of that export file. In the copy only, change the database name inside its `CREATE DATABASE` and `USE` statements from `nexora_pos_cg` to `ritvan_pos`. Do not replace arbitrary text in table data.
4. Run the edited copy in MySQL Workbench. It should create/populate `ritvan_pos` with your existing tables and records. If your export did not contain a `CREATE DATABASE` statement, first run `CREATE DATABASE ritvan_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;` and then import the edited copy.
5. Compare key table row counts (for example `items`, `sales`, `sale_items`, `payments`, `customers`, `employees`) between the old and new schemas. Keep `nexora_pos_cg` unchanged until the app has been verified against `ritvan_pos`.

Then set `DB_NAME=ritvan_pos` in your local `server/.env` (the local file is not overwritten by Git). Before restarting the API, apply the consolidated installer below to the database you intend to use, then verify `http://localhost:4001/api/health` reports `"database":"connected"`. The installer updates the branding only when the business name is still the untouched default; a custom name such as your store's name is preserved.

For a brand-new installation, skip the data-copy steps, create and select `ritvan_pos`, and use the consolidated installer below. Do not run `schema.sql` separately for this setup.

### 1. Run the single consolidated database script

Use **`database/ritvan-pos-all-in-one.sql`** for both new installations and upgrades. It combines the current schema with the Phase 4–11 changes, including the optional phone field for user profiles and the operating spendings ledger, so you no longer need to run each migration file separately.

**Back up first, even when the data is valuable and the upgrade is expected to be safe.**

For an existing customer's database:
1. Stop the API so no new sale is written during the upgrade.
2. In MySQL Workbench, use **Server → Data Export** to export the complete database with **Dump Structure and Data**. Confirm the export file exists and can be opened.
3. In the schema navigator, select the database that currently contains the customer's live data and make it the active/default schema.
4. Open `database/ritvan-pos-all-in-one.sql` and execute the **entire file once**. Check the selected database name printed at the top before proceeding, then read the complete output and resolve any SQL error.
5. Verify row counts for `items`, `sales`, `sale_items`, `payments`, `customers`, and `employees`. Confirm `http://localhost:4001/api/health` reports `"database":"connected"` before allowing checkout again.

The consolidated script uses `CREATE TABLE IF NOT EXISTS`, adds missing columns/indexes, and creates the `spendings` ledger if it is missing. Existing sales, items, users, customer balances and employee records are not deleted, truncated or overwritten by this addition; voided spending rows are retained rather than deleted. Phase 10 adds `users.phone` only if it is missing; existing users get a `NULL` phone and their current names, emails, passwords, roles and permissions remain intact. The Phase 8 step removes only a unique index on `payments.sale_id` if it exists (the payment rows are kept) so split payments can be saved. The branding step changes the business name only if it is still the default `Nexora Store`; custom names such as `ViharBite` are preserved. MySQL DDL can auto-commit, so the backup is still essential if any SQL error occurs.

**Database-name caution:** this file upgrades whichever schema is selected; it does not copy or rename a database. If the customer's real data is currently in `nexora_pos_cg`, keep `DB_NAME=nexora_pos_cg` in that customer's existing `server/.env` while applying/verifying the upgrade there. Do not point the app at a new empty `ritvan_pos` database and assume the records followed automatically. To move to `ritvan_pos`, export the old database, import a copy into `ritvan_pos`, compare the row counts, then update `DB_NAME` only after successful verification. Keep the original database and backup until you have used the new database successfully.

For a **brand-new installation**, create and select `ritvan_pos` first, then execute the same consolidated file. From a terminal, once the database exists, run:

```bash
mysql -u root -p ritvan_pos < database/ritvan-pos-all-in-one.sql
```

The standalone `schema.sql` and earlier phase migration files remain in the repository for reference/backward compatibility. For a new setup or current upgrade, use the consolidated file rather than running them one by one.

To save an Aadhaar number, add a private 32-byte encryption key to `server/.env`. Generate it in PowerShell from the `server` folder with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output to `EMPLOYEE_PII_ENCRYPTION_KEY=` in `server/.env`, then restart the API. Never commit or share this key; back it up somewhere secure. **If the key is lost, saved Aadhaar values cannot be decrypted.** Aadhaar remains optional—employee profiles and payroll work without it.

### 2. Configure and start the API
In the `server` folder, copy `server/.env.example` to `server/.env` (PowerShell from that folder: `Copy-Item .env.example .env`).

Example local settings:

```dotenv
PORT=4001
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_NAME=ritvan_pos
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
```

Use your actual MySQL password. Generate a JWT secret in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Replace the JWT placeholder with the generated value and keep it private. Start the server:

```bash
npm install
npm run dev
```

Health endpoint: http://localhost:4001/api/health

### 3. Create the first Ritvan Admin login
The MySQL setting `DB_PASSWORD` is **not** the Ritvan application sign-in password.

From the `server` folder, run:

```bash
node src/seed-admin.js "Store Admin" admin@example.com "Your-own-strong-password-12+"
```

Replace the example password with your own unique password of at least 12 characters. **A password like `admin` is rejected**, and the seed script will not create the account. After a successful command, sign in with `admin@example.com` and the exact password used there.

If an account already exists and its password is unknown, reset it from the `server` folder:

```bash
node src/reset-user-password.js admin@example.com "Your-new-strong-password-12+"
```

This changes the password hash for an existing account; it does not create missing accounts or activate disabled accounts. Keep the new password private.

### 4. Start the frontend
In another terminal, enter the `client` folder. Copy `client/.env.example` to `client/.env` if you want to set the API URL explicitly:

```dotenv
VITE_API_URL=http://localhost:4001/api
```

Then:

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`, or `http://localhost:5174` if 5173 is occupied). Local Vite origins are allowed by the API. If you change `JWT_SECRET`, restart the API and sign in again.

## Same-Wi-Fi LAN setup (recommended for nearby devices)

Use this when the PC running Ritvan/MySQL and phones/tablets are connected to the same Wi-Fi. No ngrok tunnel is needed.

1. On the Windows PC running Ritvan, open PowerShell and run `ipconfig`. Find the **IPv4 Address** under the connected Wi-Fi adapter (for example `192.168.1.23`). Use your actual address.
2. In `server/.env`, set `PORT=4001`, `HOST=0.0.0.0`, and `LAN_ACCESS=true`. Keep `DB_HOST=127.0.0.1` because MySQL runs on the same PC.
3. In `client/.env.local` or `client/.env`, set `VITE_HOST=0.0.0.0`, `VITE_PORT=5175`, and `VITE_API_URL=http://localhost:4001/api`. Remove old `NGROK_HOST` and `https://...ngrok-free.app/api` values. Ritvan automatically replaces localhost in this API URL with the private IP when a LAN device opens the frontend.
4. In separate terminals, start Express from `server` with `npm run dev`, and Vite from `client` with `npm run dev -- --host 0.0.0.0 --port 5175`. If Windows Defender Firewall prompts, allow Node.js on **Private networks only**.
5. On the host PC, open `http://localhost:5175`. On a phone/tablet on the same Wi-Fi, open `http://YOUR-PC-IP:5175`, replacing the placeholder with the IPv4 address from step 1.
6. If it cannot connect, first open `http://YOUR-PC-IP:4001/api/health` from that device. It should return JSON with `"status":"ok"` and `"database":"connected"`. If it times out, check Windows Firewall inbound TCP ports 4001 and 5175 on the Private profile, and make sure the device isn't on guest Wi-Fi or blocked by router/AP client isolation.

LAN CORS allows HTTP origins using private IPv4 addresses only when `LAN_ACCESS=true`; exact `CLIENT_ORIGIN` entries continue to work. Do not forward ports 4001/5175 on your router. Use trusted devices and require each user to sign in.

## Optional remote testing with ngrok

For devices **not** on the same Wi-Fi, use separate ngrok tunnels. Set `NGROK_HOST` to the exact frontend hostname, set `VITE_API_URL` to the HTTPS API tunnel URL ending in `/api`, add the exact frontend HTTPS origin to `CLIENT_ORIGIN`, and restart both services. Do not mix the ngrok API URL with the same-Wi-Fi setup.

## Confirmed v1 business rules
- One business and one store.
- One configurable base currency; no foreign-exchange conversion. Changing the currency setting changes labels, not historical amounts.
- Tax is disabled by default and cannot yet be enabled until a tax rate/rules policy is implemented.
- Only Admin/Manager can apply discounts or override prices; reasons and audit records are required.
- Khata / credit sales are allowed only for registered active customers. A credit sale adds the full discounted total to the customer's outstanding balance; repayments may be partial or full and cannot exceed the balance. Walk-in customers must pay in full. Repayments are logged, and no payment gateway is triggered.
- Weighted-average-cost valuation; cost is updated when purchases are received.
- Negative stock is blocked by default. An Admin override creates an audit record and reconciliation entry; an Admin must reconcile the physical count.
- Stock changes use a movement ledger, and money uses DECIMAL database fields.
- Historical sale cost snapshots are retained. Gross profit is withheld if provisional cost snapshots affect the selected report period. Net profit is not reported without an expenses module.

## Known limitations and decisions
- Manual return/refund settlement is recorded for a selected method (Cash/UPI/Card); no payment gateway is called.
- Khata repayments reduce the customer's overall balance; repayment allocation to individual invoices is not yet implemented. The standard return workflow blocks credit-sale returns while that customer has any outstanding Khata balance; settle the account first. A dedicated credit-note/Khata adjustment flow is still needed for returns against an outstanding account.
- Freight capitalization into WAC remains blocked until the policy is approved.
- A returned item restocked into inventory uses the original sale cost snapshot for the WAC update. Lines whose cost snapshot is provisional from a negative-stock override are blocked from restocking until that cost-basis policy is resolved; unresolved negative stock must also be reconciled first.
- Damaged-stock write-offs are Admin-only and logged; full expense/write-off reporting remains incomplete.
- Staff password resets and role changes are audited; disabled accounts are denied API requests.
- Printing now uses an explicit receipt-only layout for POS completion and transaction history; verify paper size and printer scaling in the browser print dialog.
- Thermal receipt hardware, tax rules, and full audit-log browsing remain incomplete.

## Before real store use
Run the frontend build and backend syntax CI, then test the workflows against a disposable/local MySQL database: seed login, role restrictions, item creation, purchase receipt/WAC, sale/idempotency, partial returns, concurrent stock changes, reconciliation and rollback behavior. Complete a security review and back up business data before production use.

## Security reminders
- Never commit `.env`, passwords, tokens, keys, or real customer/business exports.
- Use a strong unique JWT secret and application passwords.
- The UI is not the security boundary; the server enforces roles and account status.
- The feature branch is still a draft and should not be used for live sales until end-to-end verification is complete. Employee/payroll workflows also require testing against a disposable MySQL database, including salary-deduction carry-forward and duplicate payroll generation.


## Return lookup note

For returns, enter the full receipt/sale ID or the final four characters of the receipt number (letters and digits, e.g. `D275`). Four numeric digits also match the last four digits of the numeric sale ID. If multiple sales share that suffix, the API asks for the full identifier rather than selecting one.
