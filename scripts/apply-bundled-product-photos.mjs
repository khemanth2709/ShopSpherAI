#!/usr/bin/env node
import Database from 'better-sqlite3';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const root = process.cwd();
try {
  const text = await readFile(path.join(root, '.env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch (error) { if (error?.code !== 'ENOENT') throw error; }
const configured = process.env.DATABASE_PATH || path.join('data', 'shopsphere.sqlite');
const dbPath = path.isAbsolute(configured) ? configured : path.resolve(root, configured);
const manifest = JSON.parse(await readFile(path.join(root, 'public', 'products', 'manifest.json'), 'utf8'));
const photos = manifest.filter((p) => p.realPhoto && p.photoSource === 'generated_photo');
const db = new Database(dbPath, { timeout: 10000 });
try {
  const update = db.prepare(`UPDATE products SET image=?, image_source='generated_photo', image_attribution='AI-generated studio product photograph', image_source_url=NULL, image_license=NULL, image_license_url=NULL, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND (image_source='placeholder' OR image LIKE '/products/%.svg')`);
  const tx = db.transaction(() => photos.reduce((count, item) => count + update.run(item.realPhoto, item.id).changes, 0));
  const changed = tx();
  console.log(`Bundled photographs in manifest: ${photos.length}`);
  console.log(`Existing placeholder records updated: ${changed}`);
  console.log('Existing merchant, supplier and licensed photos were preserved.');
} finally { db.close(); }
