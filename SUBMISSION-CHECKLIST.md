# ShopSphere AI submission checklist

- [ ] Use Node.js 22.14+ (Node 22 or 24 LTS recommended).
- [ ] Run `npm install` successfully.
- [ ] Copy `.env.example` to `.env.local`.
- [ ] Set a unique `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` (12+ characters).
- [ ] Run `npm run dev` and open `http://localhost:3000`.
- [ ] Confirm `/api/health/database` reports `ok: true`, 750 active products and no foreign-key violations.
- [ ] Register a customer and test sign-in/sign-out.
- [ ] Sign in as admin and test product management.
- [ ] Test cart, COD checkout, order history, cancellation, shipment updates, notifications and returns.
- [ ] Run `npm run db:check`, `npm run audit:all`, `npm run audit:source`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` and `npm audit --omit=dev`.
- [ ] Back up `data/shopsphere.sqlite` and `public/uploads/product-images/`.
- [ ] Keep `.env.local`, database files and real customer data out of Git submissions.

Record actual command results before marking the release verified.
