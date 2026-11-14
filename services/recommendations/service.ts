import type { Product } from '@/lib/products';
import type { RecommendationSignal, RecommendationStrategy } from '@/types/domain';
import { getRecommendations, type RecommendationResult } from './engine';

export interface RecommendationProvider { recommend(products: Product[], signal: RecommendationSignal, strategy: RecommendationStrategy, options?: { seedId?: string; limit?: number }): RecommendationResult[] }
export class MockRecommendationProvider implements RecommendationProvider {
  recommend(products: Product[], signal: RecommendationSignal, strategy: RecommendationStrategy, options?: { seedId?: string; limit?: number }) { return getRecommendations(products, signal, strategy, options); }
}
const provider: RecommendationProvider = new MockRecommendationProvider();
export function recommendationService(products: Product[], signal: RecommendationSignal, strategy: RecommendationStrategy, options?: { seedId?: string; limit?: number }) { return provider.recommend(products, signal, strategy, options); }
export function setRecommendationProvider(next: RecommendationProvider) { Object.assign(provider, next); }
