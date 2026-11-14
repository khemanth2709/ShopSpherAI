import { categories, products as localProducts, type Product } from '@/lib/products';
import { createClient } from '@/lib/database/client';

const CACHE_KEY = 'shopsphere-sqlite-products-cache';
const PAGE_SIZE = 500;

function productArtworkPath(id: string, storedImage?: string | null): string {
  const candidate = storedImage?.trim();
  // Database-managed supplier photos / admin uploads must override the bundled SVG.
  if (candidate && candidate !== '/products/fallback.svg') return candidate;
  const match = /^p-(\d{3})$/.exec(id);
  if (match) {
    const number = Number(match[1]);
    if (number >= 1 && number <= 750) return `/products/${id}.svg`;
  }
  return '/products/fallback.svg';
}

function cleanCatalogueName(name: string): string {
  return name.replace(/\b([A-Za-z]+)(\s+\1\b)+/gi, '$1').replace(/\s+/g, ' ').trim();
}

export type ProductCatalogSource = 'sqlite' | 'cache' | 'local';
export type ProductCatalogResult = {
  products: Product[];
  source: ProductCatalogSource;
  notice?: string;
};

export type ProductRecord = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  original_price: number | string | null;
  rating: number | string;
  reviews: number;
  badge: string | null;
  color: string;
  image: string;
  image_source?: 'placeholder' | 'merchant_upload' | 'supplier_url' | 'licensed_upload' | 'generated_photo' | null;
  image_attribution?: string | null;
  image_source_url?: string | null;
  image_license?: string | null;
  image_license_url?: string | null;
  description: string;
  stock: number;
  brand: string | null;
  tags: string[] | null;
  variants: string[] | null;
  created_at: string;
};

export function mapProductRecord(row: ProductRecord): Product {
  return {
    id: row.id,
    name: cleanCatalogueName(row.name),
    category: row.category,
    price: Number(row.price),
    ...(row.original_price === null ? {} : { originalPrice: Number(row.original_price) }),
    rating: Number(row.rating),
    reviews: Number(row.reviews || 0),
    ...(row.badge ? { badge: row.badge } : {}),
    color: row.color || 'from-slate-100 to-slate-200',
    image: productArtworkPath(row.id, row.image),
    imageSource: row.image_source || (row.image?.startsWith('https://') ? 'supplier_url' : 'placeholder'),
    ...(row.image_attribution ? { imageAttribution: row.image_attribution } : {}),
    ...(row.image_source_url ? { imageSourceUrl: row.image_source_url } : {}),
    ...(row.image_license ? { imageLicense: row.image_license } : {}),
    ...(row.image_license_url ? { imageLicenseUrl: row.image_license_url } : {}),
    description: row.description || '',
    stock: Number(row.stock || 0),
    ...(row.brand ? { brand: row.brand } : {}),
    tags: Array.isArray(row.tags) ? row.tags : [],
    variants: Array.isArray(row.variants) ? row.variants : [],
    createdAt: row.created_at,
  };
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Product>;
  return typeof item.id === 'string'
    && typeof item.name === 'string'
    && typeof item.category === 'string'
    && typeof item.price === 'number'
    && typeof item.rating === 'number'
    && typeof item.image === 'string'
    && typeof item.description === 'string'
    && typeof item.stock === 'number';
}

function readCachedProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProduct).map((item) => ({ ...item, name: cleanCatalogueName(item.name), image: productArtworkPath(item.id, item.image) })) : [];
  } catch {
    return [];
  }
}

function writeCachedProducts(items: Product[]): void {
  if (typeof window === 'undefined' || items.length === 0) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // Local storage is only an offline convenience; SQLite remains the source of truth.
  }
}

async function fetchSqliteProducts(): Promise<Product[]> {
  const client = createClient();
  const rows: ProductRecord[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client.from('products')
      .select('id,name,category,price,original_price,rating,reviews,badge,color,image,image_source,image_attribution,image_source_url,image_license,image_license_url,description,stock,brand,tags,variants,created_at')
      .eq('is_active', true).order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data || []) as ProductRecord[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (from > 10_000) throw new Error('The product catalogue exceeded the supported page limit.');
  }
  return rows.map(mapProductRecord);
}

/** SQLite is the persistent source of truth; bundled products remain an emergency rendering fallback. */
export async function getProductCatalog(): Promise<ProductCatalogResult> {
  try {
    const databaseProducts = await fetchSqliteProducts();
    if (databaseProducts.length > 0) {
      writeCachedProducts(databaseProducts);
      return { products: databaseProducts, source: 'sqlite' };
    }
    throw new Error('The SQLite product catalogue is empty. Restart the app to run the automatic catalogue seed.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load the SQLite product catalogue.';
    const cached = readCachedProducts();
    if (cached.length > 0) return { products: cached, source: 'cache', notice: `SQLite is currently unavailable (${message}). Showing the last catalogue saved in this browser.` };
    return { products: localProducts, source: 'local', notice: `Could not load products from SQLite (${message}). Showing the bundled 750-product catalogue.` };
  }
}

export async function getProducts(): Promise<Product[]> {
  const result = await getProductCatalog();
  return result.products;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const catalog = await getProductCatalog();
  return catalog.products.find((product) => product.id === id);
}

export { categories };
