import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const dir = path.join(root, 'public', 'products');
const manifestPath = path.join(dir, 'manifest.json');
const products = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ids = new Set();
const hashes = new Map();
const errors = [];
const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const product of products) {
  if (ids.has(product.id)) errors.push(`Duplicate product ID: ${product.id}`);
  ids.add(product.id);
  const file = path.join(dir, `${product.id}.svg`);
  if (!fs.existsSync(file)) { errors.push(`Missing asset: ${product.id}`); continue; }
  const source = fs.readFileSync(file);
  const text = source.toString('utf8');
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  if (hashes.has(hash)) errors.push(`Duplicate artwork: ${product.id} and ${hashes.get(hash)}`);
  hashes.set(hash, product.id);
  if (!text.includes(`data-product-id="${product.id}"`)) errors.push(`Product ID metadata mismatch: ${product.id}`);
  if (!text.includes(`data-product-name="${escapeXml(product.name)}"`)) errors.push(`Product name metadata mismatch: ${product.id}`);
  if (!text.includes(`data-product-category="${escapeXml(product.category.toUpperCase())}"`)) errors.push(`Category metadata mismatch: ${product.id}`);
  if (!product.image.endsWith(`${product.id}.svg`)) errors.push(`Image path mismatch: ${product.id}`);
  if (/https?:\/\//i.test(product.image)) errors.push(`External image URL in manifest: ${product.id}`);
}
const categories = new Set(products.map((product) => product.category));
console.log(`Products: ${products.length}`);
console.log(`Categories: ${categories.size}`);
console.log(`Unique image files: ${hashes.size}`);
if (products.length !== 750 || hashes.size !== 750 || categories.size !== 25 || errors.length) {
  console.error(errors.join('\n') || 'Catalogue audit failed.');
  process.exit(1);
}
console.log('PASS: 750 unique, product- and category-matched local SVG artworks found.');
