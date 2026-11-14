#!/usr/bin/env node
import Database from 'better-sqlite3';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
try {
  const envText = await readFile(path.join(root, '.env.local'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
const configuredPath = process.env.DATABASE_PATH || path.join('data', 'shopsphere.sqlite');
const databasePath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(root, configuredPath);
const db = new Database(databasePath, { readonly: true, fileMustExist: true });
try {
  const total = db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active=1').get().count;
  const bySource = db.prepare('SELECT COALESCE(image_source,\'unknown\') AS source, COUNT(*) AS count FROM products WHERE is_active=1 GROUP BY image_source ORDER BY source').all();
  const pending = db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active=1 AND (image IS NULL OR image='' OR image LIKE '/products/%.svg')").get().count;
  const uploaded = db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active=1 AND (image LIKE '/uploads/%' OR image LIKE '/product-photos/%')").get().count;
  const generated = db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active=1 AND image_source='generated_photo'").get().count;
  const broken = db.prepare("SELECT id,image FROM products WHERE is_active=1 AND (image LIKE '/uploads/%' OR image LIKE '/product-photos/%')").all();
  let missingFiles = 0;
  for (const row of broken) {
    const relative = row.image.replace(/^\/+/, '').split('/');
    if (relative.some((part) => part === '..' || part === '.')) { missingFiles += 1; continue; }
    try { await access(path.join(root, 'public', ...relative)); }
    catch { missingFiles += 1; console.warn(`Missing image file: ${row.id} -> ${row.image}`); }
  }
  console.log(`Database: ${databasePath}`);
  console.log(`Active products: ${total}`);
  console.log(`Products with placeholder artwork: ${pending}`);
  console.log(`Products pointing to local photo assets: ${uploaded}`);
  console.log(`Bundled generated photographs assigned: ${generated}`);
  console.log(`Missing uploaded image files: ${missingFiles}`);
  console.log('Image-source distribution:', JSON.stringify(bySource));
  if (pending === total) console.warn('No photos have been imported yet. Run: npm run photos:import -- --limit=750');
  if (missingFiles > 0) process.exitCode = 1;
} finally {
  db.close();
}
