# Deploy ShopSphere AI to Railway

This release uses **Next.js + SQLite on a single persistent Node.js service**. It is not a serverless/Vercel deployment. Keep the service at one replica because all application instances must use the same local SQLite database file.

## Before deployment

1. Use Node.js 22.14 or later in the Node 22 line.
2. Run `npm install` from the project root. Commit the generated `package-lock.json` before deploying so Railway can use a repeatable dependency tree.
3. Run `npm run verify:release` and fix any reported failure before pushing.
4. Never commit `.env.local`, a real administrator password, or a SQLite database file.

## Railway configuration

The included `railway.json` configures Railpack, `npm run build`, the Next.js start command, and `/api/health/database` as the health check.

Add these variables to the Railway service before the first deployment:

```env
RAILPACK_NODE_VERSION=22
DATABASE_PATH=/app/data/shopsphere.sqlite
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_INITIAL_PASSWORD=use-a-unique-password-of-12-or-more-characters
NEXT_PUBLIC_SITE_URL=https://replace-after-domain-generation
```

`ADMIN_INITIAL_PASSWORD` must be 12–128 characters. Do not use the example value. Store it securely; do not paste it into source files or commit it to GitHub.

## Persistent storage

Create and attach a Railway Volume mounted at `/app/data`. This keeps the SQLite database when a deployment is replaced. The app creates the database and seeds its product catalogue automatically on its first start.

For persistence of administrator-uploaded product images, create a second volume mounted at `/app/public/uploads/product-images`. Bundled images under `public/product-photos/generated` are part of the source release and do not need a volume. Without the second volume, administrator-uploaded images may be lost when Railway replaces the container.

Keep **one replica**. Do not run multiple replicas against the same SQLite database file.

## Deploy and verify

1. Create a new Railway project and choose **Deploy from GitHub repo**.
2. Select this repository and the `main` branch.
3. Set the service root directory to `/` (the folder containing `package.json` and `railway.json`).
4. Confirm the Build Command and Start Command are sourced from `railway.json`. If you configure them manually, use `npm run build` and `npm run start -- --hostname 0.0.0.0 --port $PORT` respectively.
5. Add the variables above and attach the persistent volume(s).
6. Set the service to one replica and deploy.
7. Once the deployment is healthy, open **Settings → Networking → Generate Domain**.
8. Replace `NEXT_PUBLIC_SITE_URL` with the generated HTTPS domain and redeploy if Railway asks for it.
9. Visit the site, then open `/api/health/database`. The response should have `"ok": true`, `"integrity": "ok"`, and `"foreignKeyViolations": 0`.
10. Sign in using the configured administrator email and initial password. Change the password after the first sign-in if the application prompts you to do so.

## Notes

- The bundled catalogue contains 750 products in 25 categories. It includes 550 AI-generated illustrative WebP images and 200 product-matched SVG fallback illustrations. These are not manufacturer-authenticated SKU photographs.
- Checkout in this edition supports Cash on Delivery. No Razorpay or other online-payment secret is required for the included checkout flow.
- Configure `RESEND_API_KEY` and `EMAIL_FROM` only when a verified Resend sender is available and production password-reset/order emails are required.
- Back up the SQLite database and uploaded images together. Stop writes before making a manual SQLite file copy.
