'use client';
import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { Product } from '@/lib/products';
import type { RecommendationStrategy } from '@/types/domain';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useShopStore } from '@/store/shopStore';
import ProductCard from '@/components/ProductCard';
const headings: Record<RecommendationStrategy, { title: string; subtitle: string }> = {
  'recently-viewed': { title: 'Pick up where you left off', subtitle: 'Your latest product views, newest first.' },
  similar: { title: 'Similar products', subtitle: 'Products related by category, price and tags.' },
  'category-based': { title: 'More from your interests', subtitle: 'Chosen from the categories you browse.' },
  'price-based': { title: 'Around your usual budget', subtitle: 'Price similarity based on your recent activity.' },
  'wishlist-based': { title: 'Because of your wishlist', subtitle: 'Related to products you have saved.' },
  'cart-based': { title: 'Complete your setup', subtitle: 'Complementary picks related to your cart.' },
  'frequently-bought': { title: 'Often paired together', subtitle: 'Mock co-purchase signals, explained.' },
  trending: { title: 'Trending right now', subtitle: 'Popularity and rating signals, not random picks.' },
  personalized: { title: 'Recommended for you', subtitle: 'A transparent mix of your activity and product quality.' },
};
export default function RecommendationRail({ products, strategy, seedId, limit = 5 }: { products: Product[]; strategy: RecommendationStrategy; seedId?: string; limit?: number }) {
  const options = useMemo(() => ({ seedId, limit }), [seedId, limit]);
  const recommendations = useRecommendations(products, strategy, options); const track = useShopStore((state) => state.trackRecommendation); const counted = useRef(false);
  useEffect(() => { if (!counted.current && recommendations.length) { counted.current = true; recommendations.forEach(() => track(strategy, 'impression')); } }, [recommendations, strategy, track]);
  if (!recommendations.length) return null;
  const heading = headings[strategy];
  return <section className="section-shell mt-12" aria-label={heading.title}><div className="flex items-end justify-between gap-4"><div><p className="eyebrow text-moss"><Sparkles className="mr-1 inline" size={12}/> Signal-based picks</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.055em] sm:text-3xl">{heading.title}</h2><p className="mt-2 max-w-xl text-xs leading-5 text-ink/55">{heading.subtitle}</p></div>{strategy === 'personalized' && <Link href="/account#preferences" className="hidden shrink-0 text-xs font-bold text-moss underline underline-offset-4 sm:block">Why these picks? <ArrowRight size={13} className="inline"/></Link>}</div><div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5">{recommendations.map(({ product, reason }) => <ProductCard key={product.id} product={product} reason={reason} strategy={strategy}/>)}</div></section>;
}
