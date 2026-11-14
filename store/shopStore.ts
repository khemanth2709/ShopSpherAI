'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Address, LocalAnalytics, ProductReview, RecommendationStrategy, ShopUser } from '@/types/domain';

const strategies: RecommendationStrategy[] = ['recently-viewed','similar','category-based','price-based','wishlist-based','cart-based','frequently-bought','trending','personalized'];
const emptyAnalytics = (): LocalAnalytics => ({ recommendationImpressions: 0, recommendationClicks: 0, recommendationConversions: 0, strategyCounts: Object.fromEntries(strategies.map((key) => [key, 0])) as LocalAnalytics['strategyCounts'] });

type ShopState = {
  cart: Record<string, number>;
  wishlist: string[];
  savedForLater: string[];
  recentlyViewed: string[];
  searchHistory: string[];
  reviews: Record<string, ProductReview[]>;
  user: ShopUser | null;
  addresses: Address[];
  analytics: LocalAnalytics;
  hydrated: boolean;
  authReady: boolean;
  setHydrated: (value: boolean) => void;
  setAuthReady: (value: boolean) => void;
  setDatabasePreferences: (preferences: Partial<Pick<ShopState, 'cart' | 'wishlist' | 'savedForLater' | 'recentlyViewed' | 'searchHistory'>>) => void;
  setUser: (user: ShopUser | null) => void;
  logout: () => void;
  addToCart: (productId: string, quantity?: number, stock?: number) => void;
  setQuantity: (productId: string, quantity: number, stock?: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  moveToSaved: (productId: string) => void;
  moveSavedToCart: (productId: string) => void;
  recordViewed: (productId: string) => void;
  recordSearch: (query: string) => void;
  clearSearchHistory: () => void;
  addReview: (review: ProductReview) => void;
  voteReview: (productId: string, reviewId: string, helpful: boolean) => void;
  addAddress: (address: Address) => void;
  removeAddress: (addressId: string) => void;
  setDefaultAddress: (addressId: string) => void;
  trackRecommendation: (strategy: RecommendationStrategy, event: 'impression' | 'click' | 'conversion') => void;
};

export const useShopStore = create<ShopState>()(persist((set) => ({
  cart: {}, wishlist: [], savedForLater: [], recentlyViewed: [], searchHistory: [], reviews: {}, user: null, addresses: [], analytics: emptyAnalytics(), hydrated: false, authReady: false,
  setHydrated: (value) => set({ hydrated: value }),
  setAuthReady: (value) => set({ authReady: value }),
  setDatabasePreferences: (preferences) => set({ ...preferences }),
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, cart: {}, wishlist: [], savedForLater: [], recentlyViewed: [], searchHistory: [], reviews: {}, addresses: [] }),
  addToCart: (productId, quantity = 1, stock = Number.MAX_SAFE_INTEGER) => set((state) => {
    const next = Math.min(stock, (state.cart[productId] || 0) + Math.max(1, quantity));
    return { cart: { ...state.cart, [productId]: next } };
  }),
  setQuantity: (productId, quantity, stock = Number.MAX_SAFE_INTEGER) => set((state) => {
    if (quantity <= 0) { const cart = { ...state.cart }; delete cart[productId]; return { cart }; }
    return { cart: { ...state.cart, [productId]: Math.min(stock, quantity) } };
  }),
  removeFromCart: (productId) => set((state) => { const cart = { ...state.cart }; delete cart[productId]; return { cart }; }),
  clearCart: () => set({ cart: {} }),
  toggleWishlist: (productId) => set((state) => ({ wishlist: state.wishlist.includes(productId) ? state.wishlist.filter((id) => id !== productId) : [productId, ...state.wishlist] })),
  moveToSaved: (productId) => set((state) => { const cart = { ...state.cart }; delete cart[productId]; return { cart, savedForLater: state.savedForLater.includes(productId) ? state.savedForLater : [productId, ...state.savedForLater] }; }),
  moveSavedToCart: (productId) => set((state) => ({ savedForLater: state.savedForLater.filter((id) => id !== productId), cart: { ...state.cart, [productId]: Math.max(1, state.cart[productId] || 1) } })),
  recordViewed: (productId) => set((state) => ({ recentlyViewed: [productId, ...state.recentlyViewed.filter((id) => id !== productId)].slice(0, 30) })),
  recordSearch: (query) => { const clean = query.trim().slice(0, 100); if (clean) set((state) => ({ searchHistory: [clean, ...state.searchHistory.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 10) })); },
  clearSearchHistory: () => set({ searchHistory: [] }),
  addReview: (review) => set((state) => ({ reviews: { ...state.reviews, [review.productId]: [review, ...(state.reviews[review.productId] || []).filter((item) => item.id !== review.id)] } })),
  voteReview: (productId, reviewId, helpful) => set((state) => ({ reviews: { ...state.reviews, [productId]: (state.reviews[productId] || []).map((review) => review.id === reviewId ? { ...review, helpful: review.helpful + (helpful ? 1 : 0), notHelpful: review.notHelpful + (helpful ? 0 : 1) } : review) } })),
  addAddress: (address) => set((state) => ({ addresses: [...state.addresses.map((item) => address.isDefault ? { ...item, isDefault: false } : item), address] })),
  removeAddress: (addressId) => set((state) => ({ addresses: state.addresses.filter((address) => address.id !== addressId) })),
  setDefaultAddress: (addressId) => set((state) => ({ addresses: state.addresses.map((address) => ({ ...address, isDefault: address.id === addressId })) })),
  trackRecommendation: (strategy, event) => set((state) => {
    const analytics = { ...state.analytics, strategyCounts: { ...state.analytics.strategyCounts } };
    if (event === 'impression') { analytics.recommendationImpressions += 1; analytics.strategyCounts[strategy] += 1; }
    if (event === 'click') analytics.recommendationClicks += 1;
    if (event === 'conversion') analytics.recommendationConversions += 1;
    return { analytics };
  }),
}), {
  name: 'shopsphere-prd-state',
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: (state) => ({
    cart: state.cart, wishlist: state.wishlist, savedForLater: state.savedForLater, recentlyViewed: state.recentlyViewed,
    searchHistory: state.searchHistory,
    analytics: state.analytics,
  }) as ShopState,
}));
