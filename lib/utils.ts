import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function money(amount: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount); }
export function makeId(prefix = 'SS') { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
export function estimateDelivery(days: number) { const date = new Date(); date.setDate(date.getDate() + days); return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
export function productTags(product: { name: string; category: string; description: string; tags?: string[] }) { return [...new Set([...(product.tags || []), product.category.toLowerCase(), ...`${product.name} ${product.description}`.toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 3)])]; }
