#!/usr/bin/env node
/**
 * Fetches openly licensed, commercial-use product photographs from Openverse,
 * stores optimized local WebP photographs, and assigns them to placeholder
 * catalogue entries in SQLite. Existing supplier/merchant/licensed photos are
 * never overwritten.
 *
 * Usage:
 *   npm run photos:import -- --limit=30
 *   npm run photos:import -- --limit=750 --delay=500
 *   npm run photos:import -- --limit=20 --dry-run
 */
import Database from 'better-sqlite3';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const ROOT = process.cwd();
let openverseAuthorization = '';
let rateLimitExhausted = false;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_LICENSES = new Set(['by', 'by-sa', 'by-nd', 'cc0', 'pdm']);
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'your', 'our', 'set', 'pack', 'piece', 'pieces',
  'everyday', 'daily', 'studio', 'classic', 'minimal', 'essential', 'portable', 'smart',
  'ultra', 'light', 'lightweight', 'soft', 'relaxed', 'modern', 'premium', 'new', 'mini',
  'large', 'small', 'blend', 'finish', 'carry', 'style', 'designed', 'made', 'product',
  'photograph', 'photo', 'of', 'a', 'an', 'performance', 'active', 'creator', 'immersive',
  'elite', 'careplus', 'connected', 'collector', 'pantry', 'artisan', 'playtime',
  'discovery', 'carryall', 'urban', 'explorer', 'signature', 'pro', 'botanical',
]);

function readArgs() {
  const result = { limit: 750, delay: 650, dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') result.dryRun = true;
    else if (arg.startsWith('--limit=')) result.limit = Number(arg.slice(8));
    else if (arg.startsWith('--delay=')) result.delay = Number(arg.slice(8));
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!Number.isInteger(result.limit) || result.limit < 1 || result.limit > 750) {
    throw new Error('--limit must be an integer from 1 to 750.');
  }
  if (!Number.isInteger(result.delay) || result.delay < 0 || result.delay > 10_000) {
    throw new Error('--delay must be an integer from 0 to 10000 milliseconds.');
  }
  return result;
}

async function loadLocalEnv() {
  const envPath = path.join(ROOT, '.env.local');
  try {
    const contents = await readFile(envPath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host === '127.0.0.1' || host === '::1') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normaliseToken(value) {
  const token = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function productKeywords(product) {
  const raw = `${product.brand || ''} ${product.name}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(normaliseToken)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
  return [...new Set(raw)];
}

function imageKeywords(image) {
  const tags = Array.isArray(image.tags)
    ? image.tags.map((tag) => typeof tag === 'string' ? tag : tag?.name || '')
    : [];
  return `${image.title || ''} ${tags.join(' ')}`.toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(normaliseToken)
    .filter(Boolean);
}

const IMAGE_SYNONYMS = {
  headphone: ['headphone', 'headphones', 'headset', 'earphone', 'earphones', 'over-ear headphones'],
  earbud: ['earbud', 'earbuds', 'earphone', 'earphones', 'in-ear headphones'],
  backpack: ['backpack', 'rucksack', 'daypack', 'back pack'],
  sneaker: ['sneaker', 'sneakers', 'shoe', 'shoes', 'footwear', 'trainer'],
  shoe: ['shoe', 'shoes', 'sneaker', 'sneakers', 'footwear', 'trainer'],
  lamp: ['lamp', 'lighting', 'light', 'table lamp', 'floor lamp'],
  light: ['light', 'lamp', 'lighting', 'led light'],
  camera: ['camera', 'photography', 'instant camera', 'film camera'],
  cup: ['cup', 'mug', 'drinkware', 'ceramic cup'],
  tumbler: ['tumbler', 'travel mug', 'thermos', 'bottle'],
  speaker: ['speaker', 'loudspeaker', 'audio speaker'],
  watch: ['watch', 'wristwatch', 'smartwatch'],
  bottle: ['bottle', 'flask', 'water bottle'],
  tote: ['tote', 'tote bag', 'canvas bag'],
  bag: ['bag', 'handbag', 'backpack', 'tote', 'satchel'],
  keyboard: ['keyboard', 'computer keyboard', 'mechanical keyboard', 'keypad'],
  mouse: ['mouse', 'computer mouse', 'gaming mouse'],
  jacket: ['jacket', 'coat', 'outerwear'],
  hoodie: ['hoodie', 'sweatshirt', 'jumper'],
  sunglasses: ['sunglasses', 'eyewear', 'glasses'],
  vase: ['vase', 'flower vase', 'ceramic vase'],
  serum: ['serum', 'skincare', 'skin care', 'cosmetics'],
  cleanser: ['cleanser', 'face wash', 'skincare'],
  moisturiser: ['moisturiser', 'moisturizer', 'lotion', 'skincare'],
  moisturizer: ['moisturizer', 'moisturiser', 'lotion', 'skincare'],
  organiser: ['organiser', 'organizer', 'desk organizer'],
  organizer: ['organizer', 'organiser', 'desk organizer'],
  projector: ['projector', 'mini projector'],
  towel: ['towel', 'bath towel', 'textile'],
  pillow: ['pillow', 'cushion', 'neck pillow'],
  planner: ['planner', 'journal', 'notebook'],
  perfume: ['perfume', 'fragrance', 'eau de parfum'],
  throw: ['throw', 'throw blanket', 'blanket'],
  blanket: ['blanket', 'throw blanket', 'picnic blanket'],
  stand: ['stand', 'holder', 'riser', 'mount'],
  dock: ['dock', 'docking station', 'usb hub', 'hub'],
  hub: ['hub', 'usb hub', 'docking station', 'adapter'],
  adapter: ['adapter', 'usb adapter', 'multiport hub'],
  power: ['power bank', 'portable charger', 'power bank charger'],
  charger: ['charger', 'charging pad', 'wireless charger'],
  pad: ['pad', 'mouse pad', 'charging pad', 'mat'],
  sleeve: ['sleeve', 'laptop sleeve', 'tablet sleeve', 'case'],
  shirt: ['shirt', 'button shirt', 'polo shirt', 'blouse'],
  trousers: ['trousers', 'pants', 'chinos', 'slacks'],
  chinos: ['chinos', 'trousers', 'pants'],
  cardigan: ['cardigan', 'sweater', 'knitwear'],
  scarf: ['scarf', 'winter scarf'],
  beanie: ['beanie', 'knit hat', 'wool hat'],
  mirror: ['mirror', 'wall mirror', 'accent mirror'],
  planter: ['planter', 'plant pot', 'flower pot'],
  bookshelf: ['bookshelf', 'bookcase', 'shelf'],
  shelf: ['shelf', 'shelving', 'wall shelf'],
  table: ['table', 'desk', 'side table'],
  chair: ['chair', 'seat', 'dining chair'],
  basket: ['basket', 'storage basket', 'woven basket'],
  rug: ['rug', 'area rug', 'carpet'],
  curtain: ['curtain', 'drape', 'window curtain'],
  flask: ['flask', 'thermos', 'vacuum bottle'],
  duffel: ['duffel', 'duffle bag', 'gym bag'],
  container: ['container', 'food container', 'storage container'],
  umbrella: ['umbrella', 'folding umbrella'],
  journal: ['journal', 'notebook', 'diary'],
  mat: ['mat', 'yoga mat', 'exercise mat'],
  band: ['resistance band', 'exercise band', 'fitness band'],
  dumbbell: ['dumbbell', 'weights', 'free weights'],
  rope: ['jump rope', 'skipping rope'],
  roller: ['foam roller', 'massage roller'],
  glove: ['gloves', 'training gloves', 'cycling gloves'],
  book: ['book', 'novel', 'handbook', 'guidebook'],
  novel: ['novel', 'book'],
  coffee: ['coffee', 'coffee beans', 'cold brew'],
  tea: ['tea', 'green tea', 'tea leaves'],
  oil: ['olive oil', 'cooking oil'],
  pasta: ['pasta', 'noodles'],
  rice: ['rice', 'basmati rice'],
  oats: ['oats', 'rolled oats', 'oatmeal'],
  chocolate: ['chocolate', 'chocolate bar'],
  honey: ['honey', 'honey jar'],
  game: ['board game', 'tabletop game'],
  toy: ['toy', 'toys', 'plaything'],
  stroller: ['stroller', 'pushchair', 'pram'],
  diaper: ['diaper', 'nappy'],
  leash: ['leash', 'dog lead'],
  collar: ['collar', 'pet collar'],
  bicycle: ['bicycle', 'bike'],
  tyre: ['tyre', 'tire'],
  tire: ['tire', 'tyre'],
  necklace: ['necklace', 'pendant'],
  bracelet: ['bracelet', 'bangle'],
  ring: ['ring', 'jewellery ring'],
  earring: ['earring', 'earrings'],
  soundbar: ['soundbar', 'sound bar'],
  microphone: ['microphone', 'mic'],
  webcam: ['webcam', 'computer camera'],
  tripod: ['tripod', 'camera tripod'],
  lens: ['camera lens', 'lens'],
  printer: ['printer', 'photo printer'],
  toothbrush: ['toothbrush', 'electric toothbrush'],
  flosser: ['water flosser', 'oral irrigator'],
  trimmer: ['trimmer', 'beard trimmer'],
  dryer: ['hair dryer', 'blow dryer'],
  desk: ['desk', 'writing desk', 'computer desk'],
  cabinet: ['cabinet', 'storage cabinet'],
  ottoman: ['ottoman', 'footstool', 'stool'],
  bulb: ['light bulb', 'led bulb'],
  plug: ['smart plug', 'electrical plug', 'socket'],
  doorbell: ['doorbell', 'video doorbell'],
  sensor: ['sensor', 'motion sensor'],
  lock: ['door lock', 'smart lock'],
  vacuum: ['vacuum cleaner', 'robot vacuum'],
  cleaner: ['vacuum cleaner', 'robot vacuum'],
};

function scoreImage(product, image) {
  const keywords = productKeywords(product);
  if (!keywords.length) return 0;
  const available = new Set(imageKeywords(image));
  const title = String(image.title || '').toLowerCase();
  let score = 0;
  for (const word of keywords) {
    const variants = IMAGE_SYNONYMS[word] || [word];
    if (variants.some((variant) => available.has(normaliseToken(variant)) || title.includes(variant))) {
      score += word.length >= 7 ? 4 : 2;
    }
  }
  // A single exact product-specific signal is enough; generic category-only
  // matches are deliberately rejected to avoid attaching unrelated photos.
  return score >= 2 ? score : 0;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: options.redirect || 'error',
        signal: AbortSignal.timeout(25_000),
        headers: { Accept: 'application/json,image/jpeg,image/png,image/webp', 'User-Agent': 'ShopSphereAI/1.0 (local ecommerce catalogue photo importer)', ...(options.headers || {}) },
      });
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const error = new Error(`Openverse rate limit reached (HTTP 429)${retryAfter ? `; Retry-After: ${retryAfter}` : ''}. Re-run later or configure an Openverse API application in .env.local.`);
        error.code = 'OPENVERSE_RATE_LIMIT';
        throw error;
      }
      if ([400, 401, 403].includes(response.status)) {
        const error = new Error(`Image provider rejected the request (HTTP ${response.status}).`);
        error.code = 'OPENVERSE_PERMANENT';
        throw error;
      }
      if ([500, 502, 503, 504].includes(response.status)) {
        const backoff = Math.min(1500 * (2 ** attempt), 30_000);
        if (attempt === 4) throw new Error(`Image provider returned HTTP ${response.status} after retrying.`);
        console.warn(`Provider HTTP ${response.status}; retrying in ${Math.ceil(backoff / 1000)}s…`);
        await wait(backoff);
        continue;
      }
      return response;
    } catch (error) {
      if (error?.code === 'OPENVERSE_RATE_LIMIT' || error?.code === 'OPENVERSE_PERMANENT') throw error;
      lastError = error;
      if (attempt === 4) break;
      await wait(Math.min(1000 * (2 ** attempt), 15_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed.');
}

async function searchPhoto(product, usedSourceUrls = new Set()) {
  const query = [product.brand, product.name, product.category, 'product'].filter(Boolean).join(' ');
  const endpoint = new URL('https://api.openverse.org/v1/images/');
  endpoint.searchParams.set('q', query.slice(0, 190));
  endpoint.searchParams.set('page_size', '20');
  endpoint.searchParams.set('page', '1');
  endpoint.searchParams.set('license_type', 'commercial');
  endpoint.searchParams.set('category', 'photograph');
  endpoint.searchParams.set('size', 'large');
  endpoint.searchParams.set('extension', 'jpg,jpeg,png,webp');
  endpoint.searchParams.set('mature', 'false');

  const response = await fetchWithRetry(endpoint, {
    headers: openverseAuthorization ? { Authorization: openverseAuthorization } : {},
  });
  if (!response.ok) throw new Error(`Openverse search returned HTTP ${response.status}.`);
  for (const [header, value] of response.headers.entries()) {
    if (header.startsWith('x-ratelimit-available-') && header.includes('sustained') && Number(value) <= 0) {
      rateLimitExhausted = true;
    }
  }
  const payload = await response.json();
  const candidates = (payload.results || [])
    .filter((item) => ALLOWED_LICENSES.has(String(item.license || '').toLowerCase()))
    .filter((item) => safeHttpsUrl(item.url) && safeHttpsUrl(item.foreign_landing_url) && safeHttpsUrl(item.license_url))
    .filter((item) => !usedSourceUrls.has(safeHttpsUrl(item.foreign_landing_url)))
    .map((item) => ({ ...item, relevance: scoreImage(product, item) }))
    .filter((item) => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);
  return candidates[0] || null;
}

function sniffImage(buffer, contentType) {
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  if (type === 'image/jpeg' || (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) return 'jpg';
  if (type === 'image/png' || (buffer[0] === 0x89 && buffer.subarray(1, 4).toString() === 'PNG')) return 'png';
  if (type === 'image/webp' || (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')) return 'webp';
  return null;
}

async function downloadPhoto(url) {
  const safeUrl = safeHttpsUrl(url);
  if (!safeUrl) throw new Error('Image URL is not a safe HTTPS URL.');
  const response = await fetchWithRetry(safeUrl, { redirect: 'follow', headers: { Accept: 'image/jpeg,image/png,image/webp' } });
  if (!safeHttpsUrl(response.url)) throw new Error('Image host redirected to an unsafe URL.');
  if (!response.ok) throw new Error(`Image host returned HTTP ${response.status}.`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error('Image is larger than 5 MB.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('Image is empty or larger than 5 MB.');
  const extension = sniffImage(buffer, response.headers.get('content-type'));
  if (!extension) throw new Error('Image host did not return a supported JPEG, PNG or WebP image.');
  return { buffer, extension };
}

function readProductList(database, limit) {
  return database.prepare(`
    SELECT id, name, category, brand, image, image_source
    FROM products
    WHERE is_active = 1
      AND (image IS NULL OR image = '' OR image LIKE '/products/%.svg')
    ORDER BY id
    LIMIT ?
  `).all(limit);
}

async function main() {
  const options = readArgs();
  await loadLocalEnv();
  const databaseFile = path.resolve(process.env.DATABASE_PATH || path.join(ROOT, 'data', 'shopsphere.sqlite'));
  const clientId = process.env.OPENVERSE_CLIENT_ID?.trim();
  const clientSecret = process.env.OPENVERSE_CLIENT_SECRET?.trim();
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error('Set both OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET, or remove both to use the anonymous API tier.');
  }
  if (clientId && clientSecret) {
    const tokenResponse = await fetch('https://api.openverse.org/v1/auth_tokens/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) throw new Error(`Openverse authentication failed (HTTP ${tokenResponse.status}). Check your API application credentials and email verification.`);
    const tokenPayload = await tokenResponse.json();
    if (typeof tokenPayload.access_token !== 'string' || !tokenPayload.access_token) throw new Error('Openverse did not return an access token.');
    openverseAuthorization = `Bearer ${tokenPayload.access_token}`;
    console.log('Openverse API authentication: configured application');
  } else {
    console.log('Openverse API authentication: anonymous (rate-limited; importer will stop when the API quota is exhausted)');
  }

  const database = new Database(databaseFile, { timeout: 10_000 });
  database.pragma('foreign_keys = ON');
  const products = readProductList(database, options.limit);
  const usedSourceUrls = new Set(database.prepare("SELECT image_source_url FROM products WHERE image_source_url IS NOT NULL AND image_source_url != ''").all().map((row) => row.image_source_url));
  if (!products.length) {
    const distribution = database.prepare('SELECT image_source, COUNT(*) AS count FROM products WHERE is_active=1 GROUP BY image_source ORDER BY image_source').all();
    const missingLocalFiles = database.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active=1 AND image LIKE '/uploads/%'").get();
    console.log('No placeholder catalogue products need photographs.');
    console.log('Image-source distribution:', JSON.stringify(distribution));
    console.log(`Products pointing at local uploads: ${missingLocalFiles?.count ?? 0}`);
    console.log('If you expected placeholders, verify that DATABASE_PATH points to the same data\\shopsphere.sqlite used by the running app.');
    database.close();
    return;
  }

  const outputDir = path.join(ROOT, 'public', 'uploads', 'product-images', 'catalog');
  if (!options.dryRun) await mkdir(outputDir, { recursive: true });
  console.log(`Openverse photo import: ${products.length} placeholder products`);
  console.log(`Database: ${databaseFile}`);
  console.log(options.dryRun ? 'Mode: dry run (no files or database rows will be changed)' : `Mode: download to ${outputDir}`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const update = database.prepare(`
    UPDATE products
    SET image = ?, image_source = 'licensed_upload', image_attribution = ?,
        image_source_url = ?, image_license = ?, image_license_url = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND (image IS NULL OR image = '' OR image LIKE '/products/%.svg')
  `);

  try {
    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];
      const label = `[${index + 1}/${products.length}] ${product.id} ${product.name}`;
      try {
        const photo = await searchPhoto(product, usedSourceUrls);
        if (!photo) {
          skipped += 1;
          console.log(`${label} — no sufficiently relevant commercial-use photograph; left unchanged`);
          await wait(options.delay);
          continue;
        }
        const license = String(photo.license).toLowerCase();
        if (!ALLOWED_LICENSES.has(license)) throw new Error(`Disallowed licence: ${license}`);
        const imageUrl = safeHttpsUrl(photo.url);
        const sourceUrl = safeHttpsUrl(photo.foreign_landing_url);
        const licenseUrl = safeHttpsUrl(photo.license_url);
        if (!imageUrl || !sourceUrl || !licenseUrl) throw new Error('Photo source or licence URL is missing.');
        if (options.dryRun) {
          imported += 1;
          console.log(`${label} — would import “${String(photo.title || 'Untitled').slice(0, 90)}” (${license.toUpperCase()})`);
          await wait(options.delay);
          continue;
        }

        const thumbnailUrl = safeHttpsUrl(photo.thumbnail);
        let downloaded;
        try {
          downloaded = await downloadPhoto(thumbnailUrl || imageUrl);
        } catch (thumbnailError) {
          if (!thumbnailUrl || thumbnailUrl === imageUrl) throw thumbnailError;
          console.warn(`${label} — provider thumbnail unavailable; retrying the original source image.`);
          downloaded = await downloadPhoto(imageUrl);
        }
        const optimized = await sharp(downloaded.buffer, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 })
          .toBuffer();
        const filename = `${String(product.id).replace(/[^A-Za-z0-9_-]/g, '_')}-${randomUUID().slice(0, 8)}.webp`;
        const absolutePath = path.join(outputDir, filename);
        const relativeImage = `/uploads/product-images/catalog/${filename}`;
        await writeFile(absolutePath, optimized, { flag: 'wx' });
        try {
          const licenseLabel = `${license.toUpperCase()}${photo.license_version ? ` ${photo.license_version}` : ''}`;
          const result = update.run(
            relativeImage,
            String(photo.creator || 'Unknown creator').slice(0, 120),
            sourceUrl,
            licenseLabel,
            licenseUrl,
            product.id,
          );
          if (result.changes !== 1) throw new Error('Product was changed while importing; the image was not assigned.');
          imported += 1;
          usedSourceUrls.add(sourceUrl);
          console.log(`${label} — imported ${relativeImage} (${licenseLabel})`);
        } catch (error) {
          await unlink(absolutePath).catch(() => {});
          throw error;
        }
      } catch (error) {
        failed += 1;
        console.error(`${label} — ${error instanceof Error ? error.message : 'Import failed'}`);
        if (error instanceof Error && (error.code === 'OPENVERSE_RATE_LIMIT' || error.code === 'OPENVERSE_PERMANENT' || /after retrying|fetch failed|ENOTFOUND|EAI_AGAIN/i.test(error.message))) {
          console.error('Stopping early because the image provider/network is unavailable. Re-run the same command later; already imported photos are preserved.');
          break;
        }
      }
      if (rateLimitExhausted) {
        console.warn('Openverse reports no remaining sustained API requests. Stopping before the next search; re-run later to continue.');
        break;
      }
      await wait(options.delay);
    }
  } finally {
    database.close();
  }

  console.log('\nPhoto import summary');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (no relevant licensed match): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log('Assigned photos include creator, source URL and licence metadata in SQLite.');
  console.log('Run this command again to continue; already assigned photos are never overwritten.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
