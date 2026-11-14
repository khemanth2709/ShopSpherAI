import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { products as localProducts } from '@/lib/products';
import { getProductCatalog, mapProductRecord } from '@/services/api/products';

const cachedProduct = {
  id: 'p-cache-1',
  name: 'Cached headphones',
  category: 'Audio',
  price: 2499,
  rating: 4.6,
  reviews: 80,
  color: 'from-slate-100 to-emerald-50',
  image: 'https://example.com/headphones.jpg',
  description: 'A product saved from the last successful SQLite catalogue request.',
  stock: 12,
  brand: 'ShopSphere Audio',
  tags: ['audio'],
  variants: ['Default'],
};

describe('SQLite product catalogue and offline fallback', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('SQLite API is offline for this unit test.')));
  });

  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('uses the bundled 750-product catalogue when the SQLite API is unavailable', async () => {
    const result = await getProductCatalog();
    expect(result.source).toBe('local');
    expect(result.products).toHaveLength(750);
    expect(result.products[0]?.id).toBe(localProducts[0]?.id);
    expect(result.notice).toMatch(/SQLite API is offline/i);
  });

  it('uses the last successful SQLite catalogue cache when offline', async () => {
    window.localStorage.setItem('shopsphere-sqlite-products-cache', JSON.stringify([cachedProduct]));
    const result = await getProductCatalog();
    expect(result.source).toBe('cache');
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe('p-cache-1');
  });

  it('ignores malformed browser cache and returns the bundled catalogue', async () => {
    window.localStorage.setItem('shopsphere-sqlite-products-cache', '{not valid json');
    const result = await getProductCatalog();
    expect(result.source).toBe('local');
    expect(result.products).toHaveLength(750);
  });

  it('maps SQLite snake_case fields into the storefront Product model', () => {
    const product = mapProductRecord({
      id: 'p-live-1', name: 'Live product', category: 'Tech', price: '2499.00',
      original_price: '2999.00', rating: '4.7', reviews: 12, badge: 'NEW',
      color: 'from-slate-100 to-slate-200', image: 'https://example.com/live.jpg',
      image_source: 'supplier_url', image_attribution: 'Photo Creator',
      image_source_url: 'https://images.example.com/source/123', image_license: 'CC BY 4.0',
      image_license_url: 'https://creativecommons.org/licenses/by/4.0/',
      description: 'Stored in SQLite.', stock: 8, brand: 'ShopSphere',
      tags: ['tech'], variants: ['Black'], created_at: '2026-10-31T12:00:00.000Z',
    });
    expect(product.price).toBe(2499);
    expect(product.originalPrice).toBe(2999);
    expect(product.rating).toBe(4.7);
    expect(product.stock).toBe(8);
    expect(product.tags).toEqual(['tech']);
    expect(product.image).toBe('https://example.com/live.jpg');
    expect(product.imageSource).toBe('supplier_url');
    expect(product.imageAttribution).toBe('Photo Creator');
    expect(product.imageSourceUrl).toBe('https://images.example.com/source/123');
    expect(product.imageLicense).toBe('CC BY 4.0');
    expect(product.imageLicenseUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(product.createdAt).toBe('2026-10-31T12:00:00.000Z');
  });


  it('preserves a locally uploaded product photo instead of forcing the bundled SVG', () => {
    const realPhoto = '/uploads/product-images/catalog/p-001/photo.webp';
    const product = mapProductRecord({
      id: 'p-001', name: 'Studio Wireless Headphones', category: 'Tech', price: 6499,
      original_price: null, rating: 4.8, reviews: 20, badge: null,
      color: 'from-slate-100 to-slate-200', image: realPhoto, image_source: 'merchant_upload',
      description: 'Headphones photographed by the store.', stock: 5, brand: null,
      tags: [], variants: [], created_at: '2026-11-08T00:00:00.000Z',
    });
    expect(product.image).toBe(realPhoto);
    expect(product.imageSource).toBe('merchant_upload');
  });

  it('maps a licensed photograph copied into local storage and preserves its credit', () => {
    const product = mapProductRecord({
      id: 'p-003', name: 'Ceramic Table Lamp', category: 'Home', price: 2199,
      original_price: null, rating: 4.8, reviews: 14, badge: null,
      color: 'from-stone-100 to-stone-200',
      image: '/uploads/product-images/catalog/p-003/photo.webp',
      image_source: 'licensed_upload', image_attribution: 'Photographer Name',
      image_source_url: 'https://source.example/photo/123', image_license: 'CC BY 4.0',
      image_license_url: 'https://creativecommons.org/licenses/by/4.0/',
      description: 'A ceramic table lamp.', stock: 10, brand: null,
      tags: [], variants: [], created_at: '2026-11-13T00:00:00.000Z',
    });
    expect(product.imageSource).toBe('licensed_upload');
    expect(product.imageAttribution).toBe('Photographer Name');
    expect(product.imageLicense).toBe('CC BY 4.0');
    expect(product.image).toContain('/uploads/product-images/');
  });

  it('keeps the bundled placeholder for products without a supplied photograph', () => {
    const product = mapProductRecord({
      id: 'p-002', name: 'Everyday Carry Backpack', category: 'Lifestyle', price: 2899,
      original_price: null, rating: 4.7, reviews: 10, badge: null,
      color: 'from-orange-50 to-amber-100', image: '/products/p-002.svg', image_source: 'placeholder',
      description: 'Backpack.', stock: 4, brand: null, tags: [], variants: [], created_at: '2026-11-08T00:00:00.000Z',
    });
    expect(product.image).toBe('/products/p-002.svg');
    expect(product.imageSource).toBe('placeholder');
  });

  it('has exactly 30 seed products in each of 25 categories', () => {
    const perCategory = localProducts.reduce<Record<string, number>>((counts, product) => {
      counts[product.category] = (counts[product.category] || 0) + 1;
      return counts;
    }, {});
    expect(localProducts).toHaveLength(750);
    expect(Object.keys(perCategory)).toHaveLength(25);
    expect(Object.values(perCategory).every((count) => count === 30)).toBe(true);
  });
});
