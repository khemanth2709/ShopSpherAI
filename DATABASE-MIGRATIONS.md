# SQLite database

This edition no longer uses hosted database migrations. The schema is declared in `lib/database/db.ts` and created idempotently on application startup using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.

The first server start creates `data/shopsphere.sqlite`, applies the schema, and seeds the bundled 750 products if the products table is empty. Existing rows are not overwritten on later starts. Set `DATABASE_PATH` to change the file location.

The health endpoint is `/api/health/database`; the command `npm run db:check` validates an existing database file, product count and referential integrity.

SQLite uses WAL mode and foreign-key enforcement. Keep the database and `public/uploads/product-images/` together when backing up or moving this app. Stop the app before manually copying the database.
