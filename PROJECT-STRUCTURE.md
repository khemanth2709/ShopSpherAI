# Project structure

- `app/` — Next.js App Router pages, layouts and API routes.
- `components/` — Storefront, account, admin, product, checkout and UI components.
- `lib/database/` — SQLite schema/bootstrap, local auth/session handling, secure query adapter and transactional business operations.
- `data/` — Local JSON assets and the automatically generated SQLite database (the `.sqlite` file is ignored by Git).
- `public/products/` — Bundled product artwork.
- `public/uploads/product-images/` — Administrator-uploaded product photos (ignored except `.gitkeep`).
- `services/` — Product catalogue mapping, authentication helpers, recommendations and assistant logic.
- `store/` — Zustand client state for cart, wishlist and preference cache.
- `tests/` — Unit tests.
- `scripts/` — Catalogue, source and SQLite verification scripts.

The SQLite schema is created from `lib/database/db.ts`. The default database file is `data/shopsphere.sqlite`.
