# Changelog

## Latest 100-photo catalogue expansion

- Added 100 distinct AI-generated WebP product images, expanding the bundle from 92 to 192 product-photo assignments.
- Updated the catalogue manifest, generated-photo manifest, and TypeScript product seed map.
- Updated the existing-database apply script inputs and documentation; existing supplier/admin photos remain protected by the migration predicate.
- Re-ran photo-file and catalogue-artwork audits: 192 valid unique WebP mappings, 750 products, 25 categories, and 558 SVG fallbacks.
- Image assets are illustrative and not manufacturer/supplier-authenticated photography.

## Bundled product photo update

- Expanded the bundled local photo library from 42 to 92 original AI-generated, photorealistic WebP product photos, mapped to matching catalogue product IDs across lifestyle, home, fashion, beauty, technology, fitness, and kitchen categories.
- Product photo paths are included in the catalogue seed, and generated-photo attribution is stored in SQLite.
- Added `npm run photos:apply-bundled` to update an existing database without overwriting merchant, supplier, or licensed photos.
- Added manifest/file verification to `npm run audit:product-photos` and local-path checks to `npm run photos:status`.
- The remaining 708 products retain their unique product-matched SVG artwork until matching supplier or licensed photos are assigned.

## Local SQLite edition

- Replaced remote database, hosted authentication, and cloud storage integrations with a local SQLite implementation.
- Added automatic schema creation, WAL mode, foreign-key enforcement, and 750-product first-run seed.
- Added local customer/admin authentication with salted password hashes, expiring HTTP-only sessions, and one-use password-reset tokens.
- Reimplemented product, profile, address, preference, order, shipment, return, notification, and analytics data access through SQLite.
- Added transactional COD checkout with server-side price/stock validation, inventory updates, and duplicate-request protection.
- Moved administrator product-photo uploads to `public/uploads/product-images/`.
- Added database health and integrity verification tools and documented persistent-disk deployment requirements.
