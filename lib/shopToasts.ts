export type ShopToastTone = 'success' | 'error' | 'info';

export type ShopToastPayload = {
  title: string;
  message?: string;
  tone?: ShopToastTone;
  actionLabel?: string;
  actionHref?: string;
  duration?: number;
};

export type ShopToastEventDetail = ShopToastPayload & { id: string };

const SHOP_TOAST_EVENT = 'shopsphere:toast';
let toastSequence = 0;

/** Dispatch a browser-only toast event. Safe to import from client components. */
export function showShopToast(payload: ShopToastPayload): void {
  if (typeof window === 'undefined') return;

  toastSequence += 1;
  const id = `shop-toast-${Date.now()}-${toastSequence}`;
  window.dispatchEvent(new CustomEvent<ShopToastEventDetail>(SHOP_TOAST_EVENT, {
    detail: { id, tone: 'success', duration: 4200, ...payload },
  }));
}

export function showCartAddedToast(productName: string, quantity: number, cartCount: number): void {
  const itemLabel = quantity === 1 ? 'item' : 'items';
  showShopToast({
    title: 'Added to your cart',
    message: `${productName} × ${quantity} ${quantity === 1 ? 'has' : 'have'} been added. Your cart now has ${cartCount} ${itemLabel}.`,
    tone: 'success',
    actionLabel: 'View cart',
    actionHref: '/cart',
  });
}

export function showOrderPlacedToast(order: { id: string; order_number: string; total_amount: number | string }): void {
  const total = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(order.total_amount));

  showShopToast({
    title: 'Your order is confirmed!',
    message: `Order ${order.order_number} has been placed successfully. ${total} is payable on delivery.`,
    tone: 'success',
    actionLabel: 'Track order',
    actionHref: `/orders?id=${encodeURIComponent(order.id)}`,
    duration: 6500,
  });
}
