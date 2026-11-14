import type { Product } from '@/lib/products';

export type UserRole = 'customer' | 'admin';
export type ShopUser = { id: string; name: string; email: string; role: UserRole; phone?: string };
export type Address = { id: string; label: string; name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string; isDefault?: boolean };
export type ProductReview = { id: string; productId: string; userId: string; userName: string; rating: number; title: string; body: string; createdAt: string; helpful: number; notHelpful: number; verifiedPurchase: boolean };
export type RecommendationStrategy = 'recently-viewed' | 'similar' | 'category-based' | 'price-based' | 'wishlist-based' | 'cart-based' | 'frequently-bought' | 'trending' | 'personalized';
export type RecommendationSignal = { viewed: string[]; wishlist: string[]; cartIds: string[]; searchHistory: string[]; orderProductIds: string[] };
export type CartLine = { productId: string; quantity: number; addedAt: string };
export type LocalAnalytics = { recommendationImpressions: number; recommendationClicks: number; recommendationConversions: number; strategyCounts: Record<RecommendationStrategy, number> };
export type CatalogProduct = Product & { source?: 'local' | 'cache' | 'sqlite' };
