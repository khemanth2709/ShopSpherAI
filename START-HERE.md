# ShopSphere AI — Start Here (SQLite Edition)

This version runs on a local SQLite database. **No hosted database account, database URL, or API key is required.** The database is created automatically on first server start at `data/shopsphere.sqlite` (or the path set in `DATABASE_PATH`).

## 1. Requirements

- Windows 10/11, macOS, or Linux
- Node.js 22.14 or later in the Node 22 line (Node 22 LTS)
- npm

Check your versions: `node -v` and `npm -v`.

## 2. Install dependencies

Open PowerShell in the folder containing `package.json` and run:

```powershell
npm install
```

The project uses `better-sqlite3`, a native Node.js SQLite driver. On supported Windows/Node versions npm installs its matching binary. If installation reports a native-build error, install the Microsoft C++ Build Tools and retry `npm install`.

## 3. Create local configuration

Copy the example environment file to `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and change these values before starting the application:

```env
DATABASE_PATH=./data/shopsphere.sqlite
ADMIN_EMAIL=your-own-admin-email@example.com
ADMIN_INITIAL_PASSWORD=Use-A-Unique-Password-12345
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Use your own administrator email and a unique password with 12 to 128 characters. The application refuses to create an administrator with the example placeholder values. The bootstrap administrator is created automatically on first start. Public registration can create customer accounts only. **Do not commit `.env.local` or the SQLite database file.**

## 4. Start ShopSphere

```powershell
npm run dev
```

Open `http://localhost:3000`. On first start, ShopSphere creates the `data` folder, database tables, indexes and the bundled product catalogue. The included catalogue has 750 products in 25 categories (30 products per category). This bundle includes **550 locally stored, AI-generated illustrative WebP product images**; the other 200 products retain their unique product-matched SVG artwork. These images are illustrative catalogue imagery, not manufacturer-provided product photography.

## 5. Sign in

- Customer: create an account using **Create an account** on the login page.
- Administrator: use the email and password configured by `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD`.
- Admin workspace: open `http://localhost:3000/admin`.

If you configure the admin variables after the database already exists, restart the app. The matching email is promoted to administrator. Keep the admin credentials private.

## 6. Verify the database and project

In a second PowerShell window, from the project directory run:

```powershell
npm run db:check
npm run audit:all
npm run audit:source
npm run typecheck
npm test
npm run lint
npm run build
npm audit --omit=dev
```

The health endpoint is `http://localhost:3000/api/health/database`. It reports SQLite integrity, foreign-key status, active product count and user count.

## 7. Database location and backup

Default path: `data/shopsphere.sqlite`. To use a different location, set `DATABASE_PATH` in `.env.local` and restart the app. Stop the application before copying the database for a consistent backup. SQLite may also create `-wal` and `-shm` sidecar files while running; do not delete those while the app is open.

## 8. Local image storage and bundled photos

The 550 bundled WebP photos are stored under `public/product-photos/generated/` and assigned automatically when a new database is seeded. For an existing database, stop the server and run `npm run photos:apply-bundled`, then restart the app. Run `npm run photos:status` to verify local image assignments. Administrator product images are saved under `public/uploads/product-images/` and referenced by local `/uploads/product-images/...` paths. Keep both image folders backed up with the database.

## 9. Password-reset email

In local development, the reset page displays a one-time reset link after a request for an existing account. To send links by email in a production deployment, configure `RESEND_API_KEY` and `EMAIL_FROM` in the server environment and verify the sender domain with Resend. Reset tokens expire after 30 minutes and are single-use.

## 10. Deployment

SQLite needs persistent disk storage. This edition is configured for Railway as a single persistent Node.js service. Attach a volume at `/app/data`, keep one replica, and follow [RAILWAY-DEPLOYMENT.md](./RAILWAY-DEPLOYMENT.md). Do not deploy this SQLite edition to an ephemeral/serverless filesystem.
