import { describe, expect, it } from 'vitest';
import { decodeProductRouteId, findProductByRouteId } from '@/lib/productRouting';

describe('product detail route lookup', () => {
  const catalogue = [
    { id: 'p-001', name: 'Local seed catalogue product' },
    { id: 'p-new-product', name: 'Admin-created database product' },
  ];

  it('resolves a seeded catalogue product', () => {
    expect(findProductByRouteId(catalogue, 'p-001')?.name).toBe('Local seed catalogue product');
  });

  it('resolves an admin-created database product', () => {
    expect(findProductByRouteId(catalogue, 'p-new-product')?.name).toBe('Admin-created database product');
  });

  it('returns undefined for an unknown product ID', () => {
    expect(findProductByRouteId(catalogue, 'missing-product')).toBeUndefined();
  });

  it('decodes an encoded route parameter', () => {
    expect(decodeProductRouteId('product%20with%20spaces')).toBe('product with spaces');
  });

  it('handles missing and malformed route parameters safely', () => {
    expect(decodeProductRouteId(undefined)).toBe('');
    expect(decodeProductRouteId('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
