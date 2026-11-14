'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, ShieldCheck, ShoppingBag, Star, Truck } from 'lucide-react';
import PageShell from '@/components/PageShell';
import ProductImage from '@/components/ProductImage';
import { formatPrice } from '@/lib/products';
import type { Product } from '@/lib/products';
import ProductPhotoCredit from '@/components/ProductPhotoCredit';
import { useShopStore } from '@/store/shopStore';
import RecommendationRail from '@/components/RecommendationRail';
import ProductReviewPanel from '@/components/ProductReviewPanel';
import { showCartAddedToast } from '@/lib/shopToasts';

export default function ProductDetailClient({ product, catalogue }: { product: Product; catalogue: Product[] }) {

  const [quantity, setQuantity] = useState(1);
  const toggleWishlist = useShopStore((state) => state.toggleWishlist);
  const wishlist = useShopStore((state) => state.wishlist);
  const addToCart = useShopStore((state) => state.addToCart);
  const recordViewed = useShopStore((state) => state.recordViewed);
  const user = useShopStore((state) => state.user);

  function handleAddToCart() {
    if (!product || product.stock <= 0) return;
    addToCart(product.id, quantity, product.stock);
    const cartCount = Object.values(useShopStore.getState().cart).reduce((total, count) => total + count, 0);
    showCartAddedToast(product.name, quantity, cartCount);
  }

  useEffect(() => {
    recordViewed(product.id);
    setQuantity(1);
  }, [product.id, recordViewed]);


  const relatedProducts = useMemo(
    () => catalogue.filter(
      (item) => item.id !== product.id && item.category === product.category,
    ),
    [catalogue, product.id, product.category],
  );
  const isWishlisted = wishlist.includes(product.id);
  const canIncrease = quantity < product.stock;

  return (
    <PageShell>
      <div className="mb-5 text-xs text-ink/45">
        <Link href="/">Home</Link> /{' '}
        <Link href={`/?category=${encodeURIComponent(product.category)}#shop`}>
          {product.category}
        </Link>{' '}/ {product.name}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-sage">
          <ProductImage key={product.id} src={product.image} productId={product.id} alt={product.name} className="aspect-square w-full object-cover" loading="eager"/>
          <ProductPhotoCredit attribution={product.imageAttribution} sourceUrl={product.imageSourceUrl} license={product.imageLicense} licenseUrl={product.imageLicenseUrl} />
        </div>

        <div className="py-2">
          <p className="eyebrow text-moss">
            {product.category} · {product.brand || 'ShopSphere select'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <Star size={15} fill="#dda83a" stroke="#dda83a" />
            <b>{product.rating.toFixed(1)}</b>
            <span className="text-ink/45">({product.reviews} reviews)</span>
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-2xl font-bold">{formatPrice(product.price)}</span>
            {product.originalPrice ? (
              <span className="text-sm text-ink/40 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            ) : null}
          </div>

          <p className="mt-5 text-sm leading-7 text-ink/60">{product.description}</p>
          <p className={`mt-5 text-xs font-semibold ${product.stock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {product.stock > 0 ? `${product.stock} in stock · Ready to ship` : 'Out of stock'}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center rounded-full border border-ink/10">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="p-3 disabled:opacity-30"
              >
                −
              </button>
              <span className="min-w-8 text-center text-sm" aria-live="polite">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={!canIncrease}
                onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}
                className="p-3 disabled:opacity-30"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={handleAddToCart}
              className="pill-button flex-1 bg-ink text-white disabled:opacity-40"
            >
              <ShoppingBag size={16} /> Add to cart
            </button>

            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={isWishlisted}
              className={`flex h-12 w-12 items-center justify-center rounded-full border ${isWishlisted ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-ink/10 bg-white'}`}
            >
              <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3">
              <Truck size={17} />
              <p className="mt-2 text-xs font-semibold">Delivery estimate</p>
              <p className="mt-1 text-[10px] text-ink/45">Enter your PIN at checkout</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <ShieldCheck size={17} />
              <p className="mt-2 text-xs font-semibold">Cash on Delivery</p>
              <p className="mt-1 text-[10px] text-ink/45">Pay when your order arrives</p>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="text-xl font-semibold">Details & specifications</h2>
        <p className="mt-3 text-sm leading-6 text-ink/60">
          Category: {product.category}. Brand: {product.brand || 'ShopSphere select'}. Tags:{' '}
          {(product.tags || [product.category]).join(', ')}. Stock and prices are checked against the live catalogue at checkout.
        </p>
      </section>

      <ProductReviewPanel product={product} signedIn={Boolean(user)} />
      <RecommendationRail products={relatedProducts} strategy="similar" seedId={product.id} limit={5} />
      <RecommendationRail products={catalogue} strategy="frequently-bought" seedId={product.id} limit={5} />
    </PageShell>
  );
}
