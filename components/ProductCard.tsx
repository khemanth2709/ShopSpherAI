'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Plus, Scale, Star, Eye } from 'lucide-react';
import type { Product } from '@/lib/products';
import { formatPrice } from '@/lib/products';
import { useShopStore } from '@/store/shopStore';
import { showCartAddedToast } from '@/lib/shopToasts';
import ProductImage from '@/components/ProductImage';
import ProductPhotoCredit from '@/components/ProductPhotoCredit';

export default function ProductCard({ product, onQuickView, onCompare, compareSelected = false, reason, strategy }: { product: Product; onQuickView?: (product: Product) => void; onCompare?: (product: Product) => void; compareSelected?: boolean; reason?: string; strategy?: import('@/types/domain').RecommendationStrategy }) {
  const productHref = `/products/${encodeURIComponent(product.id)}`;
  const router = useRouter();
  const prefetchProduct = () => router.prefetch(productHref);
  const wishlist = useShopStore((state) => state.wishlist); const toggleWishlist = useShopStore((state) => state.toggleWishlist); const addToCart = useShopStore((state) => state.addToCart); const track = useShopStore((state) => state.trackRecommendation);
  const wished = wishlist.includes(product.id); const discount = product.originalPrice ? Math.max(1, Math.round((1 - product.price / product.originalPrice) * 100)) : 0;
  function add() {
    if (product.stock <= 0) return;
    addToCart(product.id, 1, product.stock);
    if (strategy) track(strategy, 'conversion');
    const cartCount = Object.values(useShopStore.getState().cart).reduce((total, quantity) => total + quantity, 0);
    showCartAddedToast(product.name, 1, cartCount);
  }
  return <article className="group min-w-0" data-product-card-id={product.id}>
    <div className="relative aspect-[4/4.5] overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-sage/70 to-stone-100">
      <Link href={productHref} prefetch={false} onMouseEnter={prefetchProduct} onFocus={prefetchProduct} onTouchStart={prefetchProduct} aria-label={`View ${product.name}`} className="absolute inset-0 z-0 flex items-center justify-center"><ProductImage src={product.image} productId={product.id} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"/><span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/15 to-transparent p-3 text-[9px] text-white/0">View product</span></Link>
      {product.badge && <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[9px] font-bold tracking-[.12em] text-ink backdrop-blur">{product.badge}</span>}
      {discount > 0 && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-lime px-2.5 py-1 text-[10px] font-bold text-ink">-{discount}%</span>}
      <button onClick={() => toggleWishlist(product.id)} aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`} className={`absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition ${wished ? 'bg-ink text-white' : 'bg-white/90 text-ink hover:bg-white'}`}><Heart size={16} fill={wished ? 'currentColor' : 'none'}/></button>
      <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 opacity-100 transition sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100"><button onClick={() => onQuickView?.(product)} aria-label={`Quick view ${product.name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-sm hover:bg-sage"><Eye size={15}/></button><button onClick={add} disabled={product.stock <= 0} aria-label={`Add ${product.name} to cart`} className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white shadow-sm hover:bg-moss disabled:opacity-40"><Plus size={17}/></button></div>
      {onCompare && <button onClick={() => onCompare(product)} className={`absolute right-2.5 top-14 flex h-8 items-center gap-1 rounded-full px-2.5 text-[9px] font-bold shadow-sm ${compareSelected ? 'bg-lime text-ink' : 'bg-white/90 text-ink hover:bg-white'}`} aria-pressed={compareSelected}><Scale size={12}/> {compareSelected ? 'Selected' : 'Compare'}</button>}
    </div>
    <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-moss">{product.category}</p><Link href={productHref} prefetch={false} onMouseEnter={prefetchProduct} onFocus={prefetchProduct} onTouchStart={prefetchProduct} className="mt-1.5 block line-clamp-1 text-sm font-semibold tracking-[-.02em] hover:text-moss">{product.name}</Link><ProductPhotoCredit attribution={product.imageAttribution} sourceUrl={product.imageSourceUrl} license={product.imageLicense} licenseUrl={product.imageLicenseUrl} className="mt-1"/>{reason && <p className="mt-1 line-clamp-1 text-[10px] text-ink/50">{reason}</p>}<div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-baseline gap-1.5"><span className="text-sm font-bold">{formatPrice(product.price)}</span>{product.originalPrice && <span className="text-[10px] text-ink/40 line-through">{formatPrice(product.originalPrice)}</span>}</div><span className="flex shrink-0 items-center gap-1 text-[10px] text-ink/60"><Star size={11} fill="#dda83a" stroke="#dda83a"/>{product.rating.toFixed(1)}</span></div></div>
  </article>;
}
