import type { Product } from '@/lib/products';
import type { RecommendationSignal, RecommendationStrategy } from '@/types/domain';
import { productTags } from '@/lib/utils';

export type RecommendationResult = { product: Product; score: number; reason: string; strategy: RecommendationStrategy };

const WEIGHTS = { category: 0.2, price: 0.15, tags: 0.15, rating: 0.1, recent: 0.15, wishlist: 0.12, cart: 0.13 } as const;
const unique = (items: string[]) => [...new Set(items)];
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function signalsProducts(products: Product[], ids: string[]) { const wanted = new Set(ids); return products.filter((product) => wanted.has(product.id)); }
function dominantCategory(items: Product[]) { const counts = new Map<string, number>(); items.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1)); return [...counts.entries()].sort((a,b) => b[1] - a[1])[0]?.[0]; }
function normalizeRating(rating: number) { return Math.max(0, Math.min(1, rating / 5)); }
function scoreProduct(candidate: Product, products: Product[], signal: RecommendationSignal) {
  const viewed = signalsProducts(products, signal.viewed); const wished = signalsProducts(products, signal.wishlist); const cart = signalsProducts(products, signal.cartIds);
  const allActivity = [...viewed, ...wished, ...cart];
  const favoredCategory = dominantCategory(allActivity);
  const categoryScore = favoredCategory ? (candidate.category === favoredCategory ? 1 : 0.18) : 0.35;
  const targetPrice = average(allActivity.map((item) => item.price));
  const priceScore = targetPrice ? Math.max(0, 1 - Math.abs(candidate.price - targetPrice) / Math.max(targetPrice, 1)) : 0.5;
  const sourceTags = new Set(allActivity.flatMap((item) => productTags(item)));
  const candidateTags = productTags(candidate);
  const overlap = candidateTags.filter((tag) => sourceTags.has(tag)).length;
  const tagScore = sourceTags.size ? Math.min(1, overlap / Math.max(3, candidateTags.length * 0.35)) : 0.25;
  const recentScore = viewed.length ? (viewed.some((item) => item.category === candidate.category) ? 1 : 0.1) : 0.25;
  const wishlistScore = wished.length ? (wished.some((item) => item.category === candidate.category) ? 1 : 0.08) : 0.2;
  const cartScore = cart.length ? (cart.some((item) => item.category === candidate.category) ? 1 : 0.08) : 0.2;
  const ratingScore = normalizeRating(candidate.rating);
  const score = WEIGHTS.category * categoryScore + WEIGHTS.price * priceScore + WEIGHTS.tags * tagScore + WEIGHTS.rating * ratingScore + WEIGHTS.recent * recentScore + WEIGHTS.wishlist * wishlistScore + WEIGHTS.cart * cartScore;
  return { score, components: { categoryScore, priceScore, tagScore, ratingScore, recentScore, wishlistScore, cartScore } };
}

function reasonFor(strategy: RecommendationStrategy, product: Product, signal: RecommendationSignal, seed?: Product) {
  switch (strategy) {
    case 'recently-viewed': return 'Based on your recent browsing';
    case 'similar': return seed ? `Similar category, tags or price to ${seed.name}` : 'Similar category and product tags';
    case 'category-based': return `Matches your interest in ${product.category}`;
    case 'price-based': return 'Close to the price range you usually explore';
    case 'wishlist-based': return 'Related to items you saved';
    case 'cart-based': return 'Pairs with something in your cart';
    case 'frequently-bought': return 'Commonly paired in our mock purchase patterns';
    case 'trending': return 'Trending by popularity and rating signals';
    default: return signal.viewed.length || signal.wishlist.length || signal.cartIds.length ? 'Ranked from your browsing, saved items and cart activity' : 'Popular pick while we learn your preferences';
  }
}

export function getRecommendations(products: Product[], signal: RecommendationSignal, strategy: RecommendationStrategy = 'personalized', options: { seedId?: string; limit?: number } = {}): RecommendationResult[] {
  const limit = options.limit ?? 8;
  const activityIds = unique([...signal.viewed, ...signal.wishlist, ...signal.cartIds]);
  const activity = signalsProducts(products, activityIds);
  const seed = products.find((product) => product.id === options.seedId) || activity[0];
  let pool = products.filter((product) => product.stock > 0 && product.id !== options.seedId);
  if (strategy === 'recently-viewed') {
    const recent = signal.viewed.map((id) => products.find((item) => item.id === id)).filter((item): item is Product => Boolean(item));
    if (recent.length) return recent.map((product) => ({ product, score: 1, reason: 'You viewed this recently', strategy })).slice(0, limit);
    strategy = 'trending';
  }
  if (strategy === 'similar' && seed) pool = pool.filter((product) => product.id !== seed.id && (product.category === seed.category || productTags(product).some((tag) => productTags(seed).includes(tag))));
  if (strategy === 'category-based') { const category = dominantCategory(activity); if (category) pool = pool.filter((product) => product.category === category); }
  if (strategy === 'price-based' && activity.length) { const center = average(activity.map((item) => item.price)); pool = pool.sort((a, b) => Math.abs(a.price - center) - Math.abs(b.price - center)); }
  if (strategy === 'wishlist-based' && signal.wishlist.length) { const wished = signalsProducts(products, signal.wishlist); pool = pool.filter((candidate) => wished.some((item) => item.category === candidate.category || productTags(item).some((tag) => productTags(candidate).includes(tag)))); }
  if (strategy === 'cart-based' && signal.cartIds.length) { const cartItems = signalsProducts(products, signal.cartIds); pool = pool.filter((candidate) => cartItems.some((item) => item.category === candidate.category || productTags(item).some((tag) => productTags(candidate).includes(tag)))); }
  if (strategy === 'frequently-bought' && seed) { pool = pool.filter((candidate) => candidate.category !== seed.category && productTags(candidate).some((tag) => productTags(seed).includes(tag))); }
  if (strategy === 'trending') pool = pool.sort((a, b) => (b.rating * Math.log10(b.reviews + 1)) - (a.rating * Math.log10(a.reviews + 1)));
  const scored = pool.map((product) => { const { score } = scoreProduct(product, products, signal); const trendingBoost = (product.rating / 5) * 0.12 + Math.min(product.reviews, 500) / 500 * 0.1; const strategyBoost = strategy === 'trending' ? trendingBoost : 0; return { product, score: score + strategyBoost, reason: reasonFor(strategy, product, signal, seed), strategy }; });
  scored.sort((a, b) => b.score - a.score || b.product.rating - a.product.rating);
  return scored.slice(0, limit);
}

export const recommendationWeights = WEIGHTS;
export function buildRecommendationSignal(input: { viewed: string[]; wishlist: string[]; cart: Record<string, number>; searchHistory: string[]; orders: Array<{ items: Array<{ productId: string }> }> }): RecommendationSignal {
  return { viewed: input.viewed, wishlist: input.wishlist, cartIds: Object.keys(input.cart).filter((id) => input.cart[id] > 0), searchHistory: input.searchHistory, orderProductIds: input.orders.flatMap((order) => order.items.map((item) => item.productId)) };
}
