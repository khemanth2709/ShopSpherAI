'use client';

import Link from 'next/link';
import { Bookmark, Minus, Plus, Trash2 } from 'lucide-react';
import PageShell from '@/components/PageShell';
import EmptyState from '@/components/EmptyState';
import ProductImage from '@/components/ProductImage';
import RecommendationRail from '@/components/RecommendationRail';
import { useProducts } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/products';
import { useShopStore } from '@/store/shopStore';

export default function CartPage() {
  const cart = useShopStore((state) => state.cart);
  const setQuantity = useShopStore((state) => state.setQuantity);
  const remove = useShopStore((state) => state.removeFromCart);
  const move = useShopStore((state) => state.moveToSaved);
  const { products, isLoading, dataSource, fallbackNotice } = useProducts();
  const items = Object.entries(cart).map(([id, quantity]) => ({
    product: products.find((product) => product.id === id), id, quantity,
  }));
  const availableItems = items.filter((item) => item.product);
  const subtotal = availableItems.reduce((sum, item) => sum + item.product!.price * item.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= 1999 ? 0 : 99;
  const hasUnavailable = items.some((item) => !item.product);
  const hasStockIssue = availableItems.some((item) => item.quantity > item.product!.stock);
  const hasQuantityLimit = items.some((item) => item.quantity > 20);
  const liveCatalogue = dataSource === 'sqlite';

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-moss">Your selection</p><h1 className="mt-2 text-3xl font-semibold">Shopping cart <span className="text-ink/35">({items.length})</span></h1></div><Link href="/#shop" className="text-sm font-semibold text-moss">Continue shopping →</Link></div>
      {isLoading && <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-6 text-sm text-ink/55">Loading the live catalogue…</div>}
      {!isLoading && !items.length && <EmptyState title="Your cart is taking a little break" message="Save something you love and it will appear here." />}
      {!isLoading && items.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {items.map(({ product, id, quantity }) => (
              <article key={id} className="flex gap-4 rounded-2xl border border-ink/[.08] bg-white p-4">
                {product ? <ProductImage src={product.image} productId={product.id} alt={product.name} className="h-28 w-24 rounded-xl bg-sage object-cover" /> : <div className="flex h-28 w-24 items-center justify-center rounded-xl bg-slate-100 text-[10px] text-slate-500">Unavailable</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-moss">{product?.category ?? 'Unavailable product'}</p>
                  <h2 className="mt-1 font-semibold">{product?.name ?? id}</h2>
                  {product && <><p className="mt-2 font-bold">{formatPrice(product.price)}</p><p className="mt-1 text-[10px] text-ink/45">{product.stock} in stock</p></>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {product && <div className="flex items-center rounded-full border border-ink/10"><button aria-label="Decrease quantity" onClick={() => setQuantity(id, quantity - 1, product.stock)} className="p-2"><Minus size={13} /></button><span className="min-w-7 text-center text-xs">{quantity}</span><button aria-label="Increase quantity" disabled={quantity >= Math.min(20, product.stock)} onClick={() => setQuantity(id, quantity + 1, product.stock)} className="p-2 disabled:opacity-30"><Plus size={13} /></button></div>}
                    <button onClick={() => move(id)} className="flex items-center gap-1 text-xs text-ink/55"><Bookmark size={13} /> Save for later</button>
                    <button onClick={() => remove(id)} className="flex items-center gap-1 text-xs text-rose-600"><Trash2 size={13} /> Remove</button>
                  </div>
                  {product && quantity > product.stock && <p role="alert" className="mt-2 text-xs text-rose-600">Quantity exceeds current stock. Update to continue.</p>}
                  {quantity > 20 && <p role="alert" className="mt-2 text-xs text-rose-600">Maximum 20 units per product per order.</p>}
                </div>
                {product && <p className="shrink-0 text-sm font-bold">{formatPrice(product.price * quantity)}</p>}
              </article>
            ))}
          </div>
          <aside className="h-fit rounded-2xl border border-ink/[.08] bg-white p-5">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <div className="mt-5 space-y-3 text-sm">
              <p className="flex justify-between"><span className="text-ink/55">Subtotal</span><b>{formatPrice(subtotal)}</b></p>
              <p className="flex justify-between"><span className="text-ink/55">Standard shipping estimate</span><b>{shipping ? formatPrice(shipping) : 'Free'}</b></p>
              <p className="flex justify-between"><span className="text-ink/55">Tax</span><b>Not configured</b></p>
              <div className="border-t border-ink/10 pt-4"><p className="flex justify-between text-base"><span>Total before tax</span><b>{formatPrice(subtotal + shipping)}</b></p></div>
            </div>
            {hasUnavailable && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-[10px] text-rose-700">Remove unavailable products before checkout.</p>}
            {hasStockIssue && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-[10px] text-rose-700">Adjust quantities to match current stock.</p>}
            {hasQuantityLimit && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-[10px] text-rose-700">Maximum 20 units per product per order.</p>}
            {!liveCatalogue && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-[10px] text-amber-800">{fallbackNotice || 'The live catalogue is unavailable. Checkout is paused.'}</p>}
            {liveCatalogue && !hasUnavailable && !hasStockIssue && !hasQuantityLimit ? <Link href="/checkout" className="pill-button mt-5 w-full bg-ink text-white hover:bg-moss">Continue to checkout</Link> : <button type="button" disabled className="pill-button mt-5 w-full bg-ink text-white opacity-40">Checkout unavailable</button>}
            <p className="mt-3 text-center text-[10px] leading-5 text-ink/40">Cash on Delivery is available at checkout. Applicable GST/tax settings are still a launch requirement.</p>
          </aside>
        </div>
      )}
      <RecommendationRail products={products} strategy="cart-based" limit={5} />
    </PageShell>
  );
}
