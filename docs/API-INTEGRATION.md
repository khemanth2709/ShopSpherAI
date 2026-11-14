# API and local database integration

ShopSphere uses a local SQLite database through `better-sqlite3`. The application does not require a hosted database account, connection URL, API key, or separate database server.

## Database access

- `lib/database/db.ts` creates the SQLite file, schema, indexes, and initial product catalogue.
- `lib/database/auth.ts` handles local customer/admin accounts, password hashing, reset tokens, and server sessions.
- `lib/database/query.ts` validates table/column names, applies account ownership constraints, and executes supported CRUD operations.
- `lib/database/rpc.ts` contains transactional commerce operations such as checkout, cancellation, stock adjustment, order status changes, shipment updates, and return processing.
- `lib/database/client.ts` is the browser adapter. It sends requests to same-origin Next.js API routes; the database file is never exposed to browser code.

## HTTP endpoints

- `POST /api/localdb/query` handles the restricted customer/browser query surface.
- `POST /api/localdb/rpc` executes named, server-validated business operations.
- `/api/auth/*` handles registration, login, logout, session restoration, and password recovery.
- `/api/health/database` checks SQLite integrity, foreign keys, and catalogue counts.

The browser-facing query endpoint intentionally limits table access. Order and administration workflows go through server-side API routes and validated business operations.

## Product catalogue and local images

The first application start seeds the 750 bundled products (25 categories, 30 products each) into SQLite. Product images are served from the `public` directory. Administrator uploads are written to `public/uploads/product-images/`; only authenticated administrators can upload or remove these files.

## Realtime behavior

SQLite has no built-in browser push channel in this single-process design. The adapter dispatches same-tab browser events after successful mutations so the active tab can refresh. Changes made from another browser/device are visible on the next API refetch or page refresh; they are not pushed instantly between tabs or devices.

## Environment

Copy `.env.example` to `.env.local`. Configure `DATABASE_PATH`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, and the public store details. Never commit `.env.local`, the database file, or private email credentials.
