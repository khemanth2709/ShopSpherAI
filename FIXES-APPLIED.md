# ShopSphere AI — source changes in this handoff

- Replaced the hosted database/auth/storage integration with local SQLite, local password authentication, server sessions, same-origin API routes, and local product image uploads.
- Added the SQLite schema, indexes, first-run 750-product seed, health endpoint, and database integrity check.
- Added server-side commerce operations for COD checkout, stock changes, order cancellation/status, shipment tracking, notifications, and returns.
- Added browser storage polyfills for Vitest so state persistence tests do not depend on a real browser localStorage implementation.
- Kept the existing Next.js storefront and admin/customer pages while redirecting their database calls to the local adapter.
- Removed old hosted-database SDKs, middleware, migrations, and callback routes.
- Updated setup, architecture, testing, deployment, and photo-management instructions for the SQLite edition.

The ZIP is a source-code handoff. A completed dependency installation, full test run, lint run, and production build must be confirmed on the target machine before declaring the release production-verified.
