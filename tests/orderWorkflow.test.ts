import { describe, expect, it } from 'vitest';
import { canCancelOrder, canConfirmCodCollection, canRequestReturn, isWithinReturnWindow, NEXT_ORDER_STATUS, ORDER_STATUS_LABELS } from '@/lib/orderWorkflow';

describe('ShopSphere order workflow', () => {
  it('allows only sequential fulfilment progression', () => {
    expect(NEXT_ORDER_STATUS.order_placed).toBe('confirmed');
    expect(NEXT_ORDER_STATUS.confirmed).toBe('packed');
    expect(NEXT_ORDER_STATUS.packed).toBe('shipped');
    expect(NEXT_ORDER_STATUS.shipped).toBe('out_for_delivery');
    expect(NEXT_ORDER_STATUS.out_for_delivery).toBe('delivered');
    expect(NEXT_ORDER_STATUS.delivered).toBeNull();
    expect(NEXT_ORDER_STATUS.cancelled).toBeNull();
  });

  it('labels every persisted status', () => {
    expect(Object.keys(ORDER_STATUS_LABELS)).toHaveLength(7);
    expect(ORDER_STATUS_LABELS.order_placed).toBe('Order placed');
    expect(ORDER_STATUS_LABELS.cancelled).toBe('Cancelled');
  });

  it('allows cancellation only before shipment', () => {
    expect(canCancelOrder('order_placed')).toBe(true);
    expect(canCancelOrder('confirmed')).toBe(true);
    expect(canCancelOrder('packed')).toBe(true);
    expect(canCancelOrder('shipped')).toBe(false);
    expect(canCancelOrder('delivered')).toBe(false);
    expect(canCancelOrder('cancelled')).toBe(false);
  });

  it('allows COD collection only after delivery while payment is pending', () => {
    expect(canConfirmCodCollection({ status: 'delivered', paymentMethod: 'cod', paymentStatus: 'pending' })).toBe(true);
    expect(canConfirmCodCollection({ status: 'shipped', paymentMethod: 'cod', paymentStatus: 'pending' })).toBe(false);
    expect(canConfirmCodCollection({ status: 'delivered', paymentMethod: 'card', paymentStatus: 'pending' })).toBe(false);
    expect(canConfirmCodCollection({ status: 'delivered', paymentMethod: 'cod', paymentStatus: 'paid' })).toBe(false);
  });
});


describe('ShopSphere COD return policy', () => {
  const deliveredAt = new Date('2026-10-01T12:00:00.000Z');

  it('allows a return within seven days after delivery', () => {
    expect(isWithinReturnWindow(deliveredAt, new Date('2026-10-08T11:59:59.000Z'))).toBe(true);
  });

  it('rejects returns after the seven-day window or before delivery', () => {
    expect(isWithinReturnWindow(deliveredAt, new Date('2026-10-08T12:00:01.000Z'))).toBe(false);
    expect(isWithinReturnWindow(deliveredAt, new Date('2026-10-01T11:59:59.000Z'))).toBe(false);
  });

  it('only offers a return for delivered orders without an existing request', () => {
    expect(canRequestReturn({ status: 'delivered', hasExistingRequest: false, deliveredAt, now: new Date('2026-10-03T12:00:00.000Z') })).toBe(true);
    expect(canRequestReturn({ status: 'shipped', hasExistingRequest: false, deliveredAt, now: new Date('2026-10-03T12:00:00.000Z') })).toBe(false);
    expect(canRequestReturn({ status: 'delivered', hasExistingRequest: true, deliveredAt, now: new Date('2026-10-03T12:00:00.000Z') })).toBe(false);
  });
});
