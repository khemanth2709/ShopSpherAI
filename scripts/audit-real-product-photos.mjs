import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'public', 'products', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const ids = new Set();
const photoPaths = new Set();
const problems = [];
let generated = 0;
for (const product of manifest) {
  if (ids.has(product.id)) problems.push(`Duplicate product ID: ${product.id}`);
  ids.add(product.id);
  if (!/^p-\d{3}$/.test(product.id)) problems.push(`Unexpected product ID format: ${product.id}`);
  if (!product.realPhoto) continue;
  generated += 1;
  if (product.photoSource !== 'generated_photo') problems.push(`Unexpected photo source for ${product.id}`);
  if (!product.realPhoto.startsWith('/product-photos/generated/')) problems.push(`Unexpected bundled photo path for ${product.id}`);
  const relative = product.realPhoto.replace(/^\/+/, '');
  const file = path.join(root, 'public', relative);
  if (!fs.existsSync(file)) { problems.push(`Missing product photo: ${product.id} -> ${product.realPhoto}`); continue; }
  if (photoPaths.has(product.realPhoto)) problems.push(`Photo path reused by more than one product: ${product.realPhoto}`);
  photoPaths.add(product.realPhoto);
  const bytes = fs.readFileSync(file);
  if (bytes.length < 8 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') problems.push(`Invalid WebP photo: ${product.realPhoto}`);
}
const fallback = manifest.length - generated;
console.log(`Catalogue products: ${manifest.length}`);
console.log(`Bundled generated product photographs: ${generated}`);
console.log(`Products still using original artwork: ${fallback}`);
console.log(`Unique bundled WebP files: ${photoPaths.size}`);
if (manifest.length !== 750 || ids.size !== 750 || problems.length) {
  console.error(problems.join('\n') || 'Catalogue photo audit failed.');
  process.exit(1);
}
console.log('PASS: all bundled product photographs exist, are valid WebP files, and map to product IDs.');
