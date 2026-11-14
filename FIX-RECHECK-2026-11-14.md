# ShopSphere AI — follow-up fixes

This patch is based on the PowerShell output supplied on 14 November 2026.

## Confirmed from the supplied run

- `npm run db:check`: passed; SQLite integrity is `ok`, 14 tables, 750 active products, and zero foreign-key violations.
- `npm run audit:all`: passed; 750 unique product artworks across 25 categories.
- `npm test`: passed; 9 test files and 37 tests.
- `npm audit --omit=dev`: passed; zero production dependency vulnerabilities.

## Corrected in this follow-up package

- Reworked the RPC error helper into a declaration that participates in TypeScript control-flow narrowing.
- Made the administrator guard an explicit TypeScript assertion and added concrete SQLite row types for orders, products, and returns.
- Added explicit callback row types in the account, admin inventory, and product-photo pages.
- Removed unsupported remote-storage `cacheControl` options from the local file-storage calls.
- Corrected the catalogue source check from the obsolete `database` value to `sqlite`.
- Fixed the `prefer-const` recommendation-engine lint error.
- Removed an unused upload-route import.
- Made `audit:source` normalize both Windows and POSIX path separators and exclude generated `.next` and `node_modules` files.
- Added an ESLint override for `next-env.d.ts`, which Next.js may regenerate with a triple-slash route-types reference.
- Documented the dynamic result compatibility boundary in the SQLite query adapters where the UI still consumes flexible selected-column shapes.

## Checks performed for this patch in this handoff environment

- TypeScript parser/import audit: **109 files; 0 syntax errors; 0 unresolved local imports**.
- Isolated strict TypeScript compile of `lib/database/rpc.ts` with temporary declarations for its two imported modules: **passed**.
- Full application typecheck, Vitest, ESLint, and Next.js production build were not re-run in this handoff environment because package installation could not complete (the package registry timed out). The supplied log already records 37/37 tests and the production dependency audit passing before this patch.

## Run on Windows after extracting

```powershell
npm install
npm run db:check
npm run audit:all
npm run audit:source
npm run typecheck
npm test
npm run lint
npm run build
npm audit --omit=dev
```

Do not run `npm audit fix --force`. Keep `.env.local` private and preserve the `data` directory when backing up the local SQLite database.
