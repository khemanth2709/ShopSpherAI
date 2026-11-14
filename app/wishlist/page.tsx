'use client';

import PageShell from '@/components/PageShell';
import EmptyState from '@/components/EmptyState';
import ProductCard from '@/components/ProductCard';
import RecommendationRail from '@/components/RecommendationRail';
import { useProducts } from '@/hooks/useProducts';
import { useShopStore } from '@/store/shopStore';

export default function WishlistPage() {
  const wishlist = useShopStore((state) => state.wishlist);
  const { products, isLoading } = useProducts();
  const saved = products.filter((product) => wishlist.includes(product.id));

  return (
    <PageShell>
      <p className="eyebrow text-moss">Saved for later</p>
      <h1 className="mt-2 text-3xl font-semibold">Your wishlist</h1>
      <p className="mt-2 text-sm text-ink/55">A shortlist shaped by your taste.</p>
      {isLoading && <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-6 text-sm text-ink/55">Loading saved products…</div>}
      {!isLoading && saved.length > 0 && <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{saved.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      {!isLoading && saved.length === 0 && <EmptyState title="Nothing saved yet" message="Tap the heart on any product to keep it close." />}
      <RecommendationRail products={products} strategy="wishlist-based" limit={5} />
    </PageShell>
  );
}
