# Deployment note — persistent Node.js host

This edition stores data in a local SQLite file and administrator-uploaded images on local disk. It therefore requires a persistent writable disk mounted to the running Node.js application. A serverless/ephemeral filesystem is not suitable: the database may be lost between invocations or split across instances.

For a single server/container, mount a persistent volume and set `DATABASE_PATH` to a file on that volume. Also set `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, `NEXT_PUBLIC_SITE_URL`, and (for reset email) `RESEND_API_KEY` / `EMAIL_FROM`. Back up the SQLite database and `public/uploads/product-images/` together.

For multiple application instances or significant concurrent write load, migrate to a dedicated database server rather than sharing one SQLite file over an unsupported network filesystem.
