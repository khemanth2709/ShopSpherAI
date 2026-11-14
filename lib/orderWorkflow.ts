export type OrderStatus =
  | 'order_placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  order_placed: 'Order placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const NEXT_ORDER_STATUS: Readonly<Record<OrderStatus, OrderStatus | null>> = {
  order_placed: 'confirmed',
  confirmed: 'packed',
  packed: 'shipped',
  shipped: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: null,
  cancelled: null,
};

export function canCancelOrder(status: string): boolean {
  return status === 'order_placed' || status === 'confirmed' || status === 'packed';
}

export function canConfirmCodCollection(input: {
  status: string;
  paymentMethod: string;
  paymentStatus: string;
}): boolean {
  return input.status === 'delivered' && input.paymentMethod === 'cod' && input.paymentStatus === 'pending';
}


export const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function isWithinReturnWindow(deliveredAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!deliveredAt) return false;
  const deliveredTime = deliveredAt instanceof Date ? deliveredAt.getTime() : Date.parse(deliveredAt);
  const currentTime = now.getTime();
  if (!Number.isFinite(deliveredTime) || !Number.isFinite(currentTime)) return false;
  return currentTime >= deliveredTime && currentTime <= deliveredTime + RETURN_WINDOW_MS;
}

export function canRequestReturn(input: {
  status: string;
  hasExistingRequest: boolean;
  deliveredAt: string | Date | null | undefined;
  now?: Date;
}): boolean {
  return input.status === 'delivered' && !input.hasExistingRequest && isWithinReturnWindow(input.deliveredAt, input.now);
}
