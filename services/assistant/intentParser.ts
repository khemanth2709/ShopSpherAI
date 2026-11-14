import type { Product } from '@/lib/products';
import { categories } from '@/lib/products';

export type ShoppingIntent = { category?: string; maxPrice?: number; minPrice?: number; minRating?: number; color?: string; similarityTo?: string; sort?: 'price-asc' | 'rating-desc'; confidence: number; query: string };
const aliases: Record<string, string> = {
  headphones: 'Audio', earbuds: 'Audio', speakers: 'Audio', earphones: 'Audio', phones: 'Tech', smartphones: 'Tech', laptop: 'Tech', laptops: 'Tech', computers: 'Tech', electronics: 'Tech', clothes: 'Fashion', clothing: 'Fashion', skincare: 'Beauty', cosmetics: 'Beauty', sneakers: 'Footwear', shoes: 'Footwear', trainers: 'Footwear', backpacks: 'Bags & Wallets', bags: 'Bags & Wallets', furniture: 'Furniture', lamps: 'Home', decor: 'Home', cameras: 'Cameras & Photography', games: 'Gaming', gaming: 'Gaming', books: 'Books', pets: 'Pet Supplies', groceries: 'Grocery & Pantry', toys: 'Toys & Games', stationery: 'Office & Stationery', fitness: 'Sports & Fitness', watches: 'Jewelry & Accessories', perfume: 'Beauty', travel: 'Travel & Luggage', kitchenware: 'Kitchen & Dining', garden: 'Garden & Outdoor', car: 'Automotive', automobile: 'Automotive', baby: 'Baby & Kids', smart: 'Smart Home', hygiene: 'Personal Care', wallets: 'Bags & Wallets', jewelry: 'Jewelry & Accessories', audio: 'Audio', tech: 'Tech', fashion: 'Fashion', home: 'Home', beauty: 'Beauty', lifestyle: 'Lifestyle', automotive: 'Automotive', 'pet supplies': 'Pet Supplies', 'grocery & pantry': 'Grocery & Pantry', 'sports & fitness': 'Sports & Fitness', 'kitchen & dining': 'Kitchen & Dining', 'office & stationery': 'Office & Stationery', 'travel & luggage': 'Travel & Luggage', 'jewelry & accessories': 'Jewelry & Accessories', 'cameras & photography': 'Cameras & Photography', 'personal care': 'Personal Care', 'smart home': 'Smart Home', 'toys & games': 'Toys & Games', 'baby & kids': 'Baby & Kids', 'bags & wallets': 'Bags & Wallets', 'garden & outdoor': 'Garden & Outdoor'
};

export function parseShoppingIntent(text: string, previous: ShoppingIntent | null = null, lastResults: Product[] = []): ShoppingIntent | null {
  const query = text.trim().toLowerCase(); if (!query || query.length > 500) return null;
  const intent: ShoppingIntent = { ...(previous || {}), confidence: 0, query };
  const categoryTokens = [...Object.keys(aliases), ...categories.slice(1).map((item) => item.toLowerCase())].sort((a,b) => b.length-a.length);
  const found = categoryTokens.find((token) => new RegExp(`(^|\\W)${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\W)`, 'i').test(query));
  if (found) { intent.category = aliases[found] || categories.find((item) => item.toLowerCase() === found); intent.confidence += 0.55; }
  const moneyMatch = query.match(/(?:under|below|less than|cheaper than|within|budget of|upto|up to|below rs\.?|under rs\.?|₹\s*)\s*(?:₹|rs\.?|inr\s*)?([\d,]+)\s*(k)?/i) || query.match(/(?:₹|rs\.?|inr\s*)\s*([\d,]+)\s*(k)?/i);
  if (moneyMatch) { const parsed = Number(moneyMatch[1].replace(/,/g, '')) * (moneyMatch[2] ? 1000 : 1); if (Number.isFinite(parsed) && parsed > 0) { intent.maxPrice = parsed; intent.confidence += 0.25; } }
  const priceRange = query.match(/(?:between|from)\s*(?:₹|rs\.?\s*)?([\d,]+)\s*(?:and|to|-|–)\s*(?:₹|rs\.?\s*)?([\d,]+)/i);
  if (priceRange) { intent.minPrice = Number(priceRange[1].replace(/,/g,'')); intent.maxPrice = Number(priceRange[2].replace(/,/g,'')); intent.confidence += 0.2; }
  if (/good ratings?|highly rated|top rated|best rated|4\s*stars?/.test(query)) { intent.minRating = 4; intent.confidence += 0.15; }
  const rating = query.match(/(?:rating|rated|at least)\s*(?:of\s*)?([1-5](?:\.\d)?)/); if (rating) { intent.minRating = Math.min(5, Number(rating[1])); intent.confidence += 0.15; }
  if (/better rated|higher rating|best rated/.test(query) && previous) { intent.minRating = Math.min(5, Math.max(previous.minRating || 3.5, 4) + 0.5); intent.confidence += 0.2; }
  const color = ['black','white','blue','red','green','pink','brown','grey','gray','gold','silver','beige'].find((item) => new RegExp(`\\b${item}\\b`).test(query)); if (color) { intent.color = color; intent.confidence += 0.1; }
  if (/cheaper|lower price|less expensive|more affordable/.test(query) && previous) { intent.maxPrice = previous.maxPrice ? Math.round(previous.maxPrice * 0.8) : undefined; intent.minPrice = previous.minPrice; intent.category = previous.category; intent.minRating = previous.minRating; intent.sort = 'price-asc'; intent.confidence += 0.35; }
  if (/more expensive|premium|higher price/.test(query) && previous) { intent.minPrice = previous.maxPrice ? Math.round(previous.maxPrice * 0.7) : previous.minPrice; intent.maxPrice = previous.maxPrice ? Math.round(previous.maxPrice * 1.4) : undefined; intent.category = previous.category; intent.minRating = previous.minRating; intent.confidence += 0.3; }
  if (/more like|similar to|like the second|same as/.test(query) && lastResults.length) { const seed = /second/.test(query) ? lastResults[1] : lastResults[0]; if (seed) { intent.similarityTo = seed.id; intent.category = seed.category; intent.confidence += 0.4; } }
  if (found && previous?.maxPrice && !moneyMatch) intent.maxPrice = previous.maxPrice;
  if (!found && !moneyMatch && !intent.minRating && !intent.color && !intent.similarityTo && !/cheaper|expensive|better rated|higher rating/.test(query)) return null;
  return intent.confidence >= 0.35 ? intent : null;
}

export function applyIntent(products: Product[], intent: ShoppingIntent) {
  let result = products.filter((product) => product.stock > 0);
  if (intent.category) result = result.filter((product) => product.category === intent.category || `${product.name} ${product.category}`.toLowerCase().includes(intent.category!.toLowerCase()));
  if (intent.maxPrice !== undefined) result = result.filter((product) => product.price <= intent.maxPrice!);
  if (intent.minPrice !== undefined) result = result.filter((product) => product.price >= intent.minPrice!);
  if (intent.minRating !== undefined) result = result.filter((product) => product.rating >= intent.minRating!);
  if (intent.color) result = result.filter((product) => `${product.name} ${product.description} ${(product.tags || []).join(' ')}`.toLowerCase().includes(intent.color!) || !product.tags?.length);
  if (intent.sort === 'price-asc') result.sort((a,b) => a.price - b.price); else if (intent.sort === 'rating-desc') result.sort((a,b) => b.rating-a.rating); else result.sort((a,b) => b.rating-a.rating);
  return result.slice(0, 6);
}
