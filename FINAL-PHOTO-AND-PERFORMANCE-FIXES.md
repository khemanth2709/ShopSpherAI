# ShopSphere AI — final photo and product-navigation fixes

## What changed

- Product cards prefetch a product route only when the pointer hovers or keyboard focus reaches that card. They do not prefetch hundreds of product routes at once. Product details reuse the already-loaded React Query catalogue and do not create a second catalogue subscription.
- The product catalogue query refreshes on browser focus/reconnect, allowing photos imported by the CLI in another terminal to appear without relying on a stale one-minute cache.
- Product detail images are requested eagerly with high fetch priority. Remote image URLs that do not load within 4.5 seconds fall back to the local SKU artwork; failed images then fall back to the generic artwork.
- Openverse import prefers the provider's compressed thumbnail, falls back to the original photo when necessary, validates safe HTTPS redirects, rejects non-commercial licences, avoids reusing a source image, and stops immediately on HTTP 429 instead of retrying a rate-limited request.
- Imported and manually uploaded photos are normalized to WebP (max 1600 x 1600, quality 82) using Sharp. This reduces image transfer time while retaining enough resolution for the product detail page.
- Local product-image files use unique filenames and immutable one-year cache headers, so refreshed photos are not served from an old browser cache.
- Added `npm run photos:status` to show how many products still use placeholder artwork, how many use local uploaded photos, and whether any database image paths point to missing files.

## Use the same local database

Copy your existing `.env.local`, `data/shopsphere.sqlite`, and the complete `public/uploads/product-images` folder into the extracted project folder before starting the app. The database stores paths to imported photographs; copying the database without the corresponding upload folder leaves those records pointing at missing files. Keep a backup and do not overwrite the only copy.

## Install and run

Use Node.js 22.14 or later (the package engine allows Node 22.14 through 26.x):

```powershell
npm install
npm run db:check
npm run photos:status
npm run dev
```

Open `http://localhost:3000`.

## Import licensed product photographs

Use the same project directory and `DATABASE_PATH` as the running application. To avoid SQLite write contention, stop the dev server before running a bulk image import. Then run:

```powershell
npm run photos:import -- --limit=750
npm run photos:status
```

The importer only replaces catalogue placeholder SVG artwork. Existing merchant, supplier, or licensed product photos are preserved. It searches Openverse for commercial-use photographs, uses product-term synonyms to improve matching across the catalogue, downloads compressed thumbnails first, converts them to local WebP, and records the creator, source URL, and licence. A provider rate limit, unavailable network, or lack of a genuinely relevant result can leave some products unchanged; re-run the command later to continue. Check the actual assignment count with `npm run photos:status`. Exact manufacturer photographs should be provided by the product supplier and uploaded through `/admin/product-photos`.

## Production verification

```powershell
npm run audit:all
npm run audit:source
npm run typecheck
npm test
npm run lint
npm run build
npm audit --omit=dev
```

Run the product detail page in production mode (`npm run build` followed by `npm start`) for a realistic navigation-speed check. Next.js development mode compiles a dynamic route on first visit and can be noticeably slower than the production build.

## Verification scope for this handoff

The project source and scripts were syntax-checked and local imports were audited in the packaging environment. The final product-detail optimization, selective hover prefetch, remote-image timeout fallback, and expanded image matching changes have been applied in this release. The full Next.js build, typecheck, lint and browser performance test must be rerun on the target Windows machine after `npm install`; this environment did not have the project's node_modules or a working npm registry connection. No claim is made that 750 real photos are already embedded in the ZIP: the importer retrieves licensed photos when run on the target machine.


## What is not included

The ZIP does not contain 750 downloaded real photographs. Openverse must be reachable from the Windows computer, and the importer may be rate-limited. For exact products/manufacturer photography, use supplier-authorized images in `/admin/product-photos`; generic openly licensed photographs are representative category/product photography, not verified manufacturer SKU images.
