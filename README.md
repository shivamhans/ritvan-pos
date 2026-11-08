# Ritvan POS

A single-store point-of-sale and retail operations system built with React, Vite, Tailwind CSS, Express and MySQL 8+. Ritvan keeps checkout, inventory, purchasing, customer credit, returns, staff, payroll and operating spendings in one local-first application.

> **Release branch:** `fix/gross-profit-and-safe-installers`  
> **Important:** This is a local/LAN business application. Run the backup and verification steps before upgrading a database that contains live transactions.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Requirements](#requirements)
- [Choose the correct SQL installer](#choose-the-correct-sql-installer)
- [Fresh installation](#fresh-installation)
- [Upgrade an existing installation](#upgrade-an-existing-installation)
- [Environment configuration](#environment-configuration)
- [Create the first Admin](#create-the-first-admin)
- [Run the application](#run-the-application)
- [Same-Wi-Fi access](#same-wi-fi-access)
- [Business rules and accounting](#business-rules-and-accounting)
- [Gross profit calculation](#gross-profit-calculation)
- [Security and data protection](#security-and-data-protection)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Checks and production limitations](#checks-and-production-limitations)

## Features

### Point of sale
- Product search and cart checkout.
- Cash, UPI, card, Khata and split tenders.
- Two or three distinct payment methods can be combined in one sale.
- Manager/Admin discounts and price overrides with reasons and audit entries.
- Idempotency keys to protect against duplicate checkout submissions.
- Receipt history, receipt lookup, print layout and WhatsApp receipt image sharing.

### Products and inventory
- Product catalogue with SKU, optional barcode, category, price, photo and reorder threshold.
- Automatic SKU generation when SKU is omitted.
- Stock adjustments and damage write-offs.
- Stock movement ledger.
- Negative-stock override restricted to Admin, with reason and reconciliation queue.
- Weighted-average cost (WAC) updated when purchase stock is received.

### Purchasing and suppliers
- Supplier directory and purchase orders.
- Partial receiving.
- Purchase editing/cancellation only before receiving starts.
- Stock and WAC updates performed during receiving.

### Customers and Khata
- Individual and business customer profiles.
- Customer purchase history and business-sales classification.
- Registered active customers can buy on Khata.
- Partial/full repayments by Cash, UPI or Card.
- Ledger-based outstanding balances; overpayments are rejected.

### Returns
- Partial returns against completed sales.
- Quantity and refund limits checked against previous returns.
- Optional restocking and stock movement history.
- Manual Cash/UPI/Card refund settlement record; no payment gateway transfer is initiated.

### Employees and payroll
- Employee directory, contact details, joining date, role, salary, due day and photo.
- Optional Aadhaar encryption using AES-256-GCM.
- Monthly payroll snapshots and paid/unpaid tracking.
- Company-paid employee expenses and salary-deduction expenses.
- Deductions allocated in order, with excess amounts carried forward.

### Spendings and reports
- Record, edit and void operating spendings.
- Date, category, reason, amount, payment method, payee, reference and notes.
- Dashboard KPIs, payment mix, sales trend, recent transactions, top products and stock alerts.
- Period reports and product-level CSV analysis.
- Gross profit uses historical sale cost snapshots. When provisional costs exist, the dashboard now shows a **known-cost gross-profit subtotal** and explicitly reports how many units are excluded instead of replacing the whole metric with “Unavailable”.

## Technology

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Charts/icons | Recharts, Lucide |
| Backend | Node.js, Express |
| Database | MySQL 8+, InnoDB |
| Authentication | JWT |
| Password hashing | bcryptjs |
| API | REST over HTTP |

The browser communicates with Express. It must never connect directly to MySQL.

## Requirements

- Windows 10/11, macOS or Linux.
- Node.js 20+ (Node.js 22 recommended).
- npm.
- MySQL 8.0+.
- MySQL Workbench (recommended for SQL installation and backups).
- A modern browser.

## Choose the correct SQL installer

There are **two different SQL files** in `database/`. Choose based on whether the target database already contains business data.

| File | Use it when | Data behaviour |
|---|---|---|
| `database/fresh.sql` | First-time installation into a new database | Creates/selects `ritvan_pos` and creates the complete current schema |
| `database/overwrite.sql` | Upgrading an existing Ritvan POS database | Adds missing tables/columns/indexes and applies compatibility migrations without intentionally deleting business rows |

**Never use `fresh.sql` to upgrade a live store.**  
**Never assume `overwrite.sql` copies data from another database.** It upgrades only the schema selected in your MySQL session. If your data is in `nexora_pos_cg`, keep using that schema until you deliberately export/import a verified copy.

### What overwrite does and does not do

- Creates missing tables using `CREATE TABLE IF NOT EXISTS`.
- Adds supported missing columns/indexes using guarded migration statements.
- Retains existing sales, sale items, payments, customers, users, purchases, employees, payroll and spending records.
- Removes an old single-column UNIQUE index on `payments.sale_id` only when required for split payments; payment rows are retained.
- Does not drop tables, truncate tables or delete business records.
- Does not copy records between schemas or rename a database.
- MySQL DDL may auto-commit. A backup is mandatory even though the migration is designed to be additive.

## Fresh installation

1. Clone the repository and open its project directory.
2. Start MySQL.
3. Open `database/fresh.sql` in MySQL Workbench and execute the complete script. It creates and selects `ritvan_pos`.
4. Confirm that the selected schema is `ritvan_pos` and that the tables were created.
5. Configure `server/.env` using the [environment configuration](#environment-configuration) section.
6. Install server dependencies and create the first Admin account.
7. Install client dependencies and start both services.

Command-line alternative:

```bash
mysql -u root -p < database/fresh.sql
```

The script creates the database itself. Do not run `schema.sql` or the older phase migrations separately after this fresh install.

## Upgrade an existing installation

This process is intended to preserve the store's existing business data.

### 1. Stop writes and make a verified backup

1. Stop the Ritvan API and prevent checkout from continuing during the upgrade.
2. In MySQL Workbench choose **Server → Data Export**.
3. Select the database that currently contains the live records.
4. Choose **Dump Structure and Data** and export to a self-contained SQL file.
5. Confirm the backup file exists and is readable. Keep an untouched copy somewhere separate.

### 2. Select the actual live database

In MySQL Workbench, set the schema containing the existing Ritvan data as the default schema. Or use:

```sql
USE ritvan_pos;
SELECT DATABASE();
```

Replace `ritvan_pos` with the actual database name if the live data is still in an older schema such as `nexora_pos_cg`.

### 3. Run overwrite.sql

Open `database/overwrite.sql` and execute the **entire file** once against the selected schema. Check the script's target-database safety output before proceeding. Read the complete execution output and resolve any SQL error before restarting the API.

Command-line alternative (replace the database name if necessary):

```bash
mysql -u root -p ritvan_pos < database/overwrite.sql
```

### 4. Verify records before reopening the store

Run:

```sql
SELECT DATABASE();

SELECT 'items' AS table_name, COUNT(*) AS rows_count FROM items
UNION ALL SELECT 'sales', COUNT(*) FROM sales
UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'employee_payroll', COUNT(*) FROM employee_payroll
UNION ALL SELECT 'spendings', COUNT(*) FROM spendings;
```

Compare counts with the backup/previous database where applicable. Then verify the API health endpoint returns both `"status":"ok"` and `"database":"connected"`.

**If the live data is in a different schema:** do not change `DB_NAME` to a newly created empty schema. Keep the current database configured, or separately export/import a copy into the desired new schema and compare record counts before changing the application configuration. The SQL upgrader does not migrate records between databases.

## Environment configuration

### Backend

From the project root:

```powershell
Copy-Item server/.env.example server/.env
```

Example `server/.env`:

```dotenv
PORT=4001
HOST=0.0.0.0
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174
LAN_ACCESS=true

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_NAME=ritvan_pos

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
# Optional; required only to save encrypted Aadhaar values:
EMPLOYEE_PII_ENCRYPTION_KEY=
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Generate the optional 32-byte Aadhaar encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep both values private. Never commit `.env`, JWT secrets, database passwords or encryption keys.

### Frontend

Copy the example file if present:

```powershell
Copy-Item client/.env.example client/.env
```

Example:

```dotenv
VITE_API_URL=http://localhost:4001/api
```

## Create the first Admin

From the project root:

```bash
cd server
npm install
node src/seed-admin.js "Store Admin" admin@example.com "Your-unique-strong-password-12+"
```

Use your own email and a unique password of at least 12 characters. The MySQL password and Ritvan sign-in password are different credentials.

To reset an existing user's password:

```bash
node src/reset-user-password.js admin@example.com "Your-new-strong-password-12+"
```

This resets an existing account; it does not create a missing account or activate a disabled account.

## Run the application

Open two terminals from the project root.

**Terminal 1 — API**

```bash
cd server
npm install
npm run dev
```

Health check: [http://localhost:4001/api/health](http://localhost:4001/api/health)

**Terminal 2 — frontend**

```bash
cd client
npm install
npm run dev
```

Open the Vite URL printed in the terminal, usually [http://localhost:5173](http://localhost:5173).

Root scripts are also available:

```bash
npm run dev:server
npm run dev:client
npm run build:client
npm run start:server
```

## Same-Wi-Fi access

To use Ritvan from phones/tablets connected to the same Wi-Fi as the host PC:

1. On the host PC run `ipconfig` and note the Wi-Fi adapter's IPv4 address (example: `192.168.1.23`).
2. In `server/.env`, set `HOST=0.0.0.0` and `LAN_ACCESS=true`. Keep `DB_HOST=127.0.0.1` when MySQL is on the same PC.
3. In `client/.env`, set `VITE_HOST=0.0.0.0`, `VITE_PORT=5175`, and `VITE_API_URL=http://localhost:4001/api`.
4. Start the API, then start Vite with:

```bash
npm run dev -- --host 0.0.0.0 --port 5175
```

5. Open `http://localhost:5175` on the host PC.
6. Open `http://YOUR-PC-IP:5175` on each phone/tablet. Replace the placeholder with the actual IPv4 address.

If a device cannot connect, test `http://YOUR-PC-IP:4001/api/health` from that device. Check Windows Defender Firewall for private-network access to TCP ports 4001 and 5175, and ensure the Wi-Fi network does not use client isolation or a guest-device restriction.

Do not forward these ports on your router. Use trusted devices and individual user accounts.

## Business rules and accounting

- One business and one store; no multi-tenant isolation or multi-store support.
- One configured currency; changing the currency label does not convert historical values.
- Tax is disabled; tax collection cannot be enabled until the applicable rate and calculation policy are implemented.
- Discounts and price overrides require Admin/Manager permissions and a reason.
- Khata requires a registered active customer. Repayments are ledger entries and cannot exceed the outstanding balance.
- Split tender supports two or three distinct methods: Cash, UPI and Card.
- Inventory uses weighted-average cost. Purchase receipt updates stock and average cost.
- Negative stock is blocked by default. Admin override requires a reason and creates a reconciliation entry.
- Historical sale cost snapshots are retained; reconciliation does not silently rewrite historical costs.
- Returns are partial/full within remaining sold quantity and refund limits. Settlement is recorded manually; no money is moved by a payment gateway.
- Operating spendings and employee payroll expenses remain separate. Dashboard gross profit is not net profit.

## Gross profit calculation

The report uses saved sale-item cost snapshots and completed returns. If every relevant sale/restock line has a verified cost, the dashboard reports the complete gross profit.

When a sale used an Admin negative-stock override, its cost snapshot is marked provisional because the historical cost basis is not fully verified. The dashboard now:
- Calculates gross profit using only verified/non-provisional cost snapshots.
- Excludes provisional-cost quantities from the known-cost COGS calculation.
- Shows the known-cost gross-profit subtotal rather than hiding the entire metric.
- Labels the figure and displays the number of excluded/unverified units.
- Does **not** claim that a partial known-cost subtotal is complete gross profit.

To make the figure complete, an Admin must use the business's documented cost records to establish the correct historical unit cost. A physical quantity reconciliation alone does not establish historical purchase cost.

## Security and data protection

- Passwords are stored as bcrypt hashes.
- Protected API routes enforce authentication, roles and module permissions server-side.
- Employee Aadhaar, when enabled, is encrypted using AES-256-GCM. The API exposes only the final four digits.
- Back up the Aadhaar encryption key separately. If lost, previously encrypted Aadhaar values cannot be recovered.
- Do not expose MySQL directly to client devices.
- Do not expose development ports to the public internet.
- Use unique accounts and strong passwords; remove access for former staff.

## Troubleshooting

| Symptom | Checks |
|---|---|
| API reports database disconnected | Check MySQL service, DB_HOST/PORT/USER/PASSWORD/NAME and selected schema |
| API returns 404 | Confirm the API is on port 4001 and the frontend API URL ends in `/api` |
| CORS error | Add the exact frontend origin to `CLIENT_ORIGIN`; for LAN, enable `LAN_ACCESS=true` |
| Port already in use | Stop the previous Node process or change the port consistently in both configuration and API URL |
| Login fails after JWT secret change | Restart the API and sign in again |
| Dashboard shows no records | Check the selected date range, sale status and database selected by the API |
| Gross profit has an asterisk | Some sale quantities have provisional cost snapshots; the displayed subtotal excludes them |
| Aadhaar cannot be saved | Confirm `EMPLOYEE_PII_ENCRYPTION_KEY` is exactly 64 hexadecimal characters |
| LAN device cannot reach API | Check private-network firewall rules, host IP and Wi-Fi client isolation |
| SQL upgrade reports an error | Keep the API stopped, retain the backup, inspect the exact SQL error and do not continue as if migration succeeded |

## Project structure

```text
ritvan-pos/
├── client/
│   └── src/
│       ├── App.jsx
│       ├── LiveModulePage.jsx
│       ├── EmployeesPage.jsx
│       └── ...
├── server/
│   └── src/
│       ├── index.js
│       ├── db.js
│       ├── middleware/
│       └── routes/
├── database/
│   ├── fresh.sql
│   ├── overwrite.sql
│   ├── schema.sql
│   └── phase migrations/
├── .github/workflows/
└── README.md
```

## Interface and themes

Ritvan POS uses a responsive, workspace-style interface with a compact navigation rail, translucent panels, restrained violet accents, clear page hierarchy and consistent interaction states. The dark theme uses a deep charcoal/plum canvas with violet ambient lighting; the light theme uses a soft neutral canvas with white surfaces and the same violet accent system. Switch themes from the top navigation. The layout adapts for desktop, tablet and mobile widths, including a slide-in mobile navigation drawer. The redesign is presentation-only: it does not change stored business records, API contracts, roles, permissions or accounting calculations.

## Checks and production limitations

GitHub Actions currently checks the frontend production build and backend JavaScript syntax. These checks do not replace integration tests against a real MySQL database.

Before using the application for live business operations, test at least:
- Concurrent checkout and retry/idempotency behaviour.
- Purchase receiving, WAC and negative-stock reconciliation.
- Returns, refunds and restocking.
- Khata repayment and outstanding-balance calculations.
- Payroll deduction carry-forward.
- Database backup restoration.
- LAN connectivity and printer behaviour.

Not currently provided: payment gateway integration, automatic UPI/card collection, enabled GST/tax calculations, freight capitalization, full accounting/P&L, invoice-level Khata repayment allocation, full supplier payment ledger, multi-store/multi-business tenancy or certified thermal-printer integration.

---

Ritvan POS is designed to make daily store operations easier while keeping important business records in MySQL. Back up the database before every upgrade and verify the health endpoint and record counts before reopening checkout.


## Desktop installers and automatic updates

Ritvan POS can be packaged as an installed desktop application for Windows, macOS and Linux. The installed desktop app has a GitHub Releases updater; the existing Vite development launcher is still intended for development and does **not** self-update.

### Release flow

1. Merge a tested change into `main`.
2. GitHub Actions builds platform installers on Windows, macOS and Linux.
3. The workflow publishes a versioned GitHub Release and update metadata.
4. Installed clients check for updates at startup and every six hours.
5. The app downloads the update in the background. An Admin can choose **Install now**, or enable automatic installation after ten minutes of inactivity while on the Dashboard. Automatic mode also installs a downloaded update when the app is quit.

The workflow assigns increasing versions in the `1.0.<GitHub Actions run number>` format. Do not manually reuse a published version/tag. A change pushed to a feature branch does not publish a client release; it must reach `main`.

### Build locally

Use Node.js 22 and install MySQL separately. From the repository root:

```bash
npm install
npm --prefix server install
npm --prefix client install
npm --prefix client run build
```

Then build for the operating system you're currently using:

```bash
npm run dist:win    # Windows; run on Windows
npm run dist:mac    # macOS; run on macOS
npm run dist:linux  # Linux; run on Linux
```

GitHub Actions builds all three platforms. Release files are published in the repository's **Releases** section.

### First desktop launch and local MySQL

- Install the platform installer. MySQL 8+ remains a separately installed local service.
- On first launch, Ritvan creates a private `.env` configuration file in the operating system's Ritvan POS application-data folder. Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` to match the existing store database. The updater does not replace this file.
- For an existing store, configure the **same database name that already holds the live records**. The desktop updater does not run `fresh.sql` or `overwrite.sql` to update the application.
- Keep a separate, tested backup before the first desktop installation. The old source-folder launcher and the installed desktop app are different deployment formats; moving to the installer is a one-time migration of application files/configuration, not a database reset.
- The API binds to loopback in desktop mode. For a multi-device store, keep using a deliberately configured server/LAN deployment rather than assuming the desktop wrapper exposes the API to other devices.

### Database migrations and backups

Future automatic schema changes must be added as numbered JavaScript migrations under `server/src/migrations/scripts/`, for example `001-add-item-source.js`. Each file must export an asynchronous `up({ connection, pool })` function. Never edit a migration after it has been applied; add a new migration instead.

The migration runner records names and SHA-256 checksums in `ritvan_schema_migrations`. Before applying each pending migration it runs `mysqldump` and stores a backup in the app's private data folder. If the backup fails, the migration is not run. If a migration fails, startup stops instead of continuing against a potentially incompatible schema. If `mysqldump` is not on PATH, set `MYSQLDUMP_PATH` in the private `.env` file.

MySQL DDL can auto-commit. A dump is a recovery point, not a guaranteed transactional rollback. Always test a migration on a copy of real data, and verify that the backup can be restored. The updater changes application files; it does not intentionally delete, recreate or overwrite the store database.

### Platform signing and release caveats

- **Windows:** code signing is recommended to reduce SmartScreen warnings and improve publisher verification.
- **macOS:** automatic updates require a signed application. Configure the repository Actions secrets `CSC_LINK` and `CSC_KEY_PASSWORD` with your Apple Developer signing certificate and password before distributing macOS builds. Notarization credentials may also be needed for a polished public release.
- **Linux:** AppImage is the preferred self-updating format. Installing a `.deb` package may require administrator/package-manager permission.
- Keep the GitHub repository public for the current public GitHub Releases feed. Never place a GitHub token, database password or signing certificate in client-side code or commit secrets to the repository.

### Before distributing to paying customers

Test clean installs and updates on each target OS. Test an update with a disposable copy of a populated database, an unavailable MySQL service, a missing `mysqldump` executable, an interrupted download and a failed migration. Confirm checkout is not interrupted and that the database backup can be restored. The workflow and updater implementation must pass CI and real installed-app testing before being treated as production-certified.
