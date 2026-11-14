import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const configured = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'shopsphere.sqlite');
const file = path.resolve(configured);
if (!fs.existsSync(file)) {
  console.error(`SQLite database does not exist yet: ${path.relative(process.cwd(), file)}`);
  console.error('Start the app once with npm run dev; the database and catalogue are created automatically.');
  process.exit(1);
}
const db = new Database(file, { readonly: true, fileMustExist: true });
try {
  const integrity = db.prepare('PRAGMA quick_check').get()?.quick_check;
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => row.name);
  const productCounts = db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) AS active FROM products').get();
  const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
  console.log(`Database: ${path.relative(process.cwd(), file)}`);
  console.log(`Integrity: ${integrity}`);
  console.log(`Tables: ${tables.length}`);
  console.log(`Total products: ${productCounts.total}`);
  console.log(`Active products: ${productCounts.active || 0}`);
  console.log(`Foreign-key violations: ${foreignKeys.length}`);
  if (integrity !== 'ok' || foreignKeys.length || productCounts.total < 750) process.exitCode = 1;
  else console.log('PASS: SQLite integrity, foreign keys and at least 750 seeded catalogue rows verified.');
} finally { db.close(); }
