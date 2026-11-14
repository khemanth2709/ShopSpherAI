import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { products } from '@/lib/products';
import ProductReviewPanel from '@/components/ProductReviewPanel';
import { useShopStore } from '@/store/shopStore';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ProductReviewPanel snapshot stability', () => {
  beforeEach(() => {
    useShopStore.setState({ reviews: {}, user: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a product with no stored reviews without an unstable selector snapshot', () => {
    const product = products[0]!;

    render(<ProductReviewPanel product={product} signedIn={false} />);

    expect(screen.getByText('No community reviews yet. Be the first to leave one.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ratings & reviews' })).toBeTruthy();
  });

  it('renders stored reviews when a product has reviews', () => {
    const product = products[0]!;
    useShopStore.setState({
      reviews: {
        [product.id]: [{
          id: 'review-test-1',
          productId: product.id,
          userId: 'user-test',
          userName: 'Test shopper',
          rating: 5,
          title: 'Excellent product',
          body: 'This product worked exactly as described.',
          createdAt: '2026-10-30T10:00:00.000Z',
          helpful: 2,
          notHelpful: 0,
          verifiedPurchase: false,
        }],
      },
    });

    render(<ProductReviewPanel product={product} signedIn={false} />);

    expect(screen.getByText('Excellent product')).toBeTruthy();
    expect(screen.getByText('This product worked exactly as described.')).toBeTruthy();
  });
});
