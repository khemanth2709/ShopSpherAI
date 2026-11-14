'use client';
import { useMemo } from 'react';
import type { Product } from '@/lib/products';
import type { RecommendationStrategy } from '@/types/domain';
import { useShopStore } from '@/store/shopStore';
import { buildRecommendationSignal } from '@/services/recommendations/engine';
import { recommendationService } from '@/services/recommendations/service';
export function useRecommendations(products: Product[], strategy: RecommendationStrategy, options?: { seedId?: string; limit?: number }) {
  const viewed = useShopStore((state) => state.recentlyViewed); const wishlist = useShopStore((state) => state.wishlist); const cart = useShopStore((state) => state.cart); const searchHistory = useShopStore((state) => state.searchHistory);
  const signal = useMemo(() => buildRecommendationSignal({ viewed, wishlist, cart, searchHistory, orders: [] }), [viewed, wishlist, cart, searchHistory]);
  return useMemo(() => recommendationService(products, signal, strategy, options), [products, signal, strategy, options?.seedId, options?.limit]);
}
