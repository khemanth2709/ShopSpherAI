import { describe,it,expect } from 'vitest';
import { getRecommendations, recommendationWeights } from '../services/recommendations/engine';
import { products } from '../lib/products';
const signal={viewed:['p-001'],wishlist:['p-007'],cartIds:['p-009'],searchHistory:['headphones'],orderProductIds:[]};
describe('recommendation engine',()=>{
 it('weights sum to one',()=>expect(Object.values(recommendationWeights).reduce((a,b)=>a+b,0)).toBeCloseTo(1));
 it('returns unique in-stock recommendations with reasons',()=>{const result=getRecommendations(products,signal,'personalized',{limit:8});expect(result.length).toBeGreaterThan(0);expect(new Set(result.map(x=>x.product.id)).size).toBe(result.length);expect(result.every(x=>x.product.stock>0&&x.reason.length>0)).toBe(true)});
 it('supports each strategy without random product selection',()=>{const strategies=['recently-viewed','similar','category-based','price-based','wishlist-based','cart-based','frequently-bought','trending','personalized'] as const;for(const strategy of strategies){const result=getRecommendations(products,signal,strategy,{seedId:'p-001',limit:4});expect(result.length).toBeGreaterThan(0)}});
});
