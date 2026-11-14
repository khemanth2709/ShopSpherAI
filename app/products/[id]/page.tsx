'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import PageShell from '@/components/PageShell';
import ProductDetailLoading from '@/components/ProductDetailLoading';
import ProductDetailClient from '@/components/ProductDetailClient';
import { useProducts } from '@/hooks/useProducts';
import { decodeProductRouteId } from '@/lib/productRouting';

/**
 * Product data is already loaded for the storefront. Reuse the shared React Query
 * cache for instant client-side navigation instead of performing another
 * server round-trip for every product click. Direct links still resolve through
 * useProducts and display the loading skeleton while SQLite is queried.
 */
export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const productId = decodeProductRouteId(params?.id);
  const { products, isLoading, isFetching } = useProducts();
  const product = products.find((item) => item.id === productId);

  if (!productId || (!product && !isLoading && !isFetching)) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <h1 className="text-2xl font-semibold">Product not found</h1>
          <p className="mt-2 text-sm text-ink/55">This product may have been removed from the catalogue.</p>
          <Link href="/#shop" className="pill-button mt-5 inline-flex bg-ink text-white">Back to shopping</Link>
        </div>
      </PageShell>
    );
  }

  if (!product) return <ProductDetailLoading />;
  return <ProductDetailClient product={product} catalogue={products} />;
}
