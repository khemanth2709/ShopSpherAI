# Customer feedback pop-ups

ShopSphere has a shared, accessible toast viewport mounted in `app/layout.tsx`.

## Events covered

- Product card Add button: shows **Added to your cart**, product name, quantity and cart count, plus a View cart link.
- Product quick view Add button: shows the same confirmation before the dialog closes.
- Product detail Add to cart button: confirms the selected quantity.
- Sphere assistant product Add button: confirms the product was added.
- Checkout: shows **Your order is confirmed!** only after `/api/checkout` returns a successful persisted order. The message includes the order number and COD amount, with a Track order link.

The checkout confirmation is deliberately not shown when validation fails or the API/database rejects the order. The existing order-success page remains available as a durable confirmation.

## Implementation

- `lib/shopToasts.ts`: typed browser event and notification helpers.
- `components/ToastViewport.tsx`: global responsive toast UI, auto-dismiss and manual dismiss.
- `app/layout.tsx`: one global viewport mount.
- `tests/toastViewport.test.tsx`: component tests for cart and confirmed-order messages.

## Manual test

1. Start the app and open the storefront.
2. Click a product card's Add button. A toast should appear at the top-right with the product name and View cart link.
3. Repeat from quick view, product detail, and Sphere assistant.
4. Complete a COD checkout using a valid account and address.
5. Only after the checkout API confirms the database order, a confirmation toast should appear with the order number and Track order link.
6. Simulate a failed checkout (for example, use an unavailable item or disconnect the database). An order-confirmed toast must not appear.
