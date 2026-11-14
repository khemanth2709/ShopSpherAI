import { describe,it,expect } from 'vitest';
import { parseShoppingIntent,applyIntent } from '../services/assistant/intentParser';
import { products } from '../lib/products';
describe('shopping intent parser',()=>{
 it('extracts category and maximum price',()=>{const result=parseShoppingIntent('show me headphones under 5000');expect(result?.category).toBe('Audio');expect(result?.maxPrice).toBe(5000)});
 it('supports conversational cheaper refinement',()=>{const previous=parseShoppingIntent('headphones under 5000');const result=parseShoppingIntent('show me something cheaper',previous||null,products.filter(p=>p.category==='Audio'));expect(result?.category).toBe('Audio');expect(result?.maxPrice).toBe(4000)});
 it('does not return unrelated results for unclear input',()=>{expect(parseShoppingIntent('hmm not sure')).toBeNull()});
 it('filters by price and rating',()=>{const intent=parseShoppingIntent('headphones under 5000 with good ratings');expect(intent).not.toBeNull();const result=applyIntent(products,intent!);expect(result.every(p=>p.price<=5000&&p.rating>=4)).toBe(true)});
});
