# ShopSphere AI

A Next.js 15 e-commerce application with a self-contained local SQLite database, local customer/admin authentication, a 750-product catalogue across 25 categories, product recommendations, cash-on-delivery checkout, inventory management, order tracking, returns, notifications, and administrator catalogue tools.

## Quick start (Windows PowerShell)

```powershell
npm install
Copy-Item .env.example .env.local
# Edit .env.local: set ADMIN_EMAIL and a unique ADMIN_INITIAL_PASSWORD
npm run dev
```

Open `http://localhost:3000`. SQLite is created automatically at `data/shopsphere.sqlite`; no separate database server or external database credentials are required.

See [START-HERE.md](./START-HERE.md) for local setup, [RAILWAY-DEPLOYMENT.md](./RAILWAY-DEPLOYMENT.md) for production deployment, and [VALIDATION-STATUS.md](./VALIDATION-STATUS.md) for the checks completed on this package.


## Product photography (bundled and licensed imports)

The project bundles **550 AI-generated illustrative WebP product images** mapped to 550 catalogue entries. The images are generic catalogue illustrations, not Amazon listing downloads or manufacturer-verified SKU photographs; the remaining 200 products retain their original product-matched SVG artwork. See [the latest 200-photo update report](./docs/PHOTO-ADDITIONS-NEXT-200.md) for this release's product-ID mappings and provenance notes.

To replace placeholders with additional real, openly licensed commercial-use photographs from Openverse, run this from the project directory while connected to the internet:

```powershell
npm run photos:import -- --limit=750
```

The importer searches Openverse, only accepts commercial-use licences (CC BY, CC BY-SA, CC BY-ND, CC0 and Public Domain Mark), downloads JPG/PNG/WebP files to `public/uploads/product-images/catalog`, and stores attribution, source and licence metadata in SQLite. It never overwrites existing supplier or administrator-assigned images. Products without a sufficiently relevant match remain on their fallback artwork.

For a test without changing files or database rows:

```powershell
npm run photos:import -- --limit=20 --dry-run
```

The image importer needs internet access. Openverse limits anonymous requests and returns rate-limit headers; the importer spaces requests by 650 milliseconds by default, stops when the sustained quota is exhausted, and is safe to re-run because already assigned photos are skipped. For a larger one-day import, register an Openverse API application, verify its email, and add `OPENVERSE_CLIENT_ID` and `OPENVERSE_CLIENT_SECRET` to `.env.local`; Openverse still applies its published rate limits. Do not scrape or reuse Amazon/Flipkart listing photos unless you have explicit rights from the rights holder or supplier.


## Product photo import and performance

See [FINAL-PHOTO-AND-PERFORMANCE-FIXES.md](./FINAL-PHOTO-AND-PERFORMANCE-FIXES.md) for the local photo status command, licensed bulk importer, WebP optimization, and final Windows verification steps.
