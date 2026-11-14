import { afterEach, describe, expect, it, vi } from 'vitest';
import { showCartAddedToast, showOrderPlacedToast, showShopToast } from '@/lib/shopToasts';

describe('ShopSphere customer feedback toasts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('announces a product added to the cart with the cart action', () => {
    const listener = vi.fn();
    window.addEventListener('shopsphere:toast', listener);

    showCartAddedToast('Wireless Headphones', 2, 3);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.title).toBe('Added to your cart');
    expect(event.detail.message).toContain('Wireless Headphones × 2');
    expect(event.detail.message).toContain('cart now has 3 items');
    expect(event.detail.actionLabel).toBe('View cart');
    expect(event.detail.actionHref).toBe('/cart');

    window.removeEventListener('shopsphere:toast', listener);
  });

  it('announces an order only with a track-order destination', () => {
    const listener = vi.fn();
    window.addEventListener('shopsphere:toast', listener);

    showOrderPlacedToast({ id: 'order-123', order_number: 'SS-2026-0001', total_amount: 1499 });

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.title).toBe('Your order is confirmed!');
    expect(event.detail.message).toContain('SS-2026-0001');
    expect(event.detail.message).toContain('payable on delivery');
    expect(event.detail.actionLabel).toBe('Track order');
    expect(event.detail.actionHref).toBe('/orders?id=order-123');

    window.removeEventListener('shopsphere:toast', listener);
  });

  it('does not throw during server rendering when window is unavailable', () => {
    expect(() => showShopToast({ title: 'Server-safe notification' })).not.toThrow();
  });
});
