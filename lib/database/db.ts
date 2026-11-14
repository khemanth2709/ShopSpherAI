import 'server-only';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { products as seedProducts } from '@/lib/products';

const databaseFile = path.resolve(process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'shopsphere.sqlite'));
mkdirSync(path.dirname(databaseFile), { recursive: true });

const globalForDatabase = globalThis as typeof globalThis & { shopSphereDb?: Database.Database };

function createDatabase(): Database.Database {
  const database = new Database(databaseFile, { timeout: 5_000 });
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS user_addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      line1 TEXT NOT NULL,
      line2 TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS addresses_user_idx ON user_addresses(user_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default ON user_addresses(user_id) WHERE is_default = 1;
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      original_price REAL,
      rating REAL NOT NULL DEFAULT 0,
      reviews INTEGER NOT NULL DEFAULT 0,
      badge TEXT,
      color TEXT NOT NULL DEFAULT 'from-slate-100 to-slate-200',
      image TEXT NOT NULL DEFAULT '',
      image_source TEXT NOT NULL DEFAULT 'placeholder',
      image_attribution TEXT,
      image_source_url TEXT,
      image_license TEXT,
      image_license_url TEXT,
      description TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
      brand TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      variants TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS products_category_idx ON products(category, id) WHERE is_active = 1;
    CREATE INDEX IF NOT EXISTS products_name_idx ON products(name COLLATE NOCASE) WHERE is_active = 1;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      invoice_number TEXT NOT NULL UNIQUE,
      checkout_request_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      delivery_method TEXT NOT NULL CHECK(delivery_method IN ('standard','express')),
      status TEXT NOT NULL DEFAULT 'order_placed',
      payment_method TEXT NOT NULL DEFAULT 'cod',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_collected_at TEXT,
      payment_collected_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      shipping_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      placed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      cancelled_at TEXT,
      delivered_at TEXT,
      UNIQUE(user_id, checkout_request_id)
    );
    CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, placed_at DESC);
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status, placed_at DESC);
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      product_category TEXT NOT NULL,
      product_image TEXT NOT NULL DEFAULT '',
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      line_total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
    CREATE TABLE IF NOT EXISTS order_status_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_status_events(order_id, created_at);
    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      carrier TEXT NOT NULL,
      tracking_number TEXT NOT NULL,
      tracking_url TEXT,
      estimated_delivery_at TEXT,
      shipped_at TEXT,
      delivered_at TEXT,
      admin_note TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS shipment_events (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      event_title TEXT NOT NULL,
      event_description TEXT,
      location TEXT,
      event_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS shipment_events_idx ON shipment_events(shipment_id, event_at DESC);
    CREATE TABLE IF NOT EXISTS return_requests (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      reason TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      refund_status TEXT NOT NULL DEFAULT 'not_required',
      refund_amount REAL NOT NULL DEFAULT 0,
      refund_reference TEXT,
      admin_note TEXT,
      requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS returns_user_idx ON return_requests(user_id, requested_at DESC);
    CREATE INDEX IF NOT EXISTS returns_status_idx ON return_requests(status, requested_at DESC);
    CREATE TABLE IF NOT EXISTS customer_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      href TEXT NOT NULL DEFAULT '/orders',
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON customer_notifications(user_id, created_at DESC);
  `);
  seedCatalogue(database);
  return database;
}

function seedCatalogue(database: Database.Database) {
  const count = database.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number };
  if (count.count > 0) return;
  const insert = database.prepare(`INSERT INTO products
    (id,name,category,price,original_price,rating,reviews,badge,color,image,image_source,image_attribution,description,stock,brand,tags,variants,is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  const seedMany = database.transaction(() => {
    for (const product of seedProducts) {
      insert.run(
        product.id, product.name, product.category, product.price, product.originalPrice ?? null,
        product.rating, product.reviews, product.badge ?? null, product.color, product.image,
        product.imageSource ?? 'placeholder', product.imageAttribution ?? null, product.description, product.stock, product.brand ?? null,
        JSON.stringify(product.tags ?? []), JSON.stringify(product.variants ?? []),
      );
    }
  });
  seedMany();
}

export const db = globalForDatabase.shopSphereDb ?? (globalForDatabase.shopSphereDb = createDatabase());
export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();
export const databaseFilePath = databaseFile;

export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function normalizeRow<T extends Record<string, unknown>>(row: T): T {
  const result = { ...row } as Record<string, unknown>;
  for (const key of ['tags', 'variants', 'data']) {
    if (typeof result[key] === 'string') {
      try { result[key] = JSON.parse(result[key] as string); } catch { /* leave malformed text unchanged */ }
    }
  }
  for (const key of ['is_active', 'is_default']) {
    if (typeof result[key] === 'number') result[key] = Boolean(result[key]);
  }
  return result as T;
}
