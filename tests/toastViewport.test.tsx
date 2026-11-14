import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import ToastViewport from '@/components/ToastViewport';
import { showCartAddedToast, showOrderPlacedToast } from '@/lib/shopToasts';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

describe('ToastViewport customer confirmations', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a visible cart confirmation and a View cart action', () => {
    render(<ToastViewport />);

    act(() => showCartAddedToast('Wireless Headphones', 1, 1));

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Added to your cart')).toBeTruthy();
    expect(screen.getByText(/Wireless Headphones/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View cart' }).getAttribute('href')).toBe('/cart');
  });

  it('shows an order confirmation with the tracking link', () => {
    render(<ToastViewport />);

    act(() => showOrderPlacedToast({ id: 'order-456', order_number: 'SS-2026-00456', total_amount: 1299 }));

    expect(screen.getByText('Your order is confirmed!')).toBeTruthy();
    expect(screen.getByText(/SS-2026-00456/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Track order' }).getAttribute('href')).toBe('/orders?id=order-456');
  });
});
