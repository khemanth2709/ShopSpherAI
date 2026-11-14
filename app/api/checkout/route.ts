import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { sendTransactionalEmail } from '@/lib/notifications/email';

export const dynamic = 'force-dynamic';

type CheckoutBody = {
  checkoutRequestId?: unknown;
  items?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
  deliveryMethod?: unknown;
  paymentMethod?: unknown;
};

function isText(value: unknown, max = 200): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: 'The checkout request was not valid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'The checkout request must be a JSON object.' }, { status: 400 });
  }
  if (body.paymentMethod !== undefined && body.paymentMethod !== 'cod') {
    return NextResponse.json({ error: 'ShopSphere currently accepts Cash on Delivery only.' }, { status: 400 });
  }
  if (typeof body.checkoutRequestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.checkoutRequestId)) {
    return NextResponse.json({ error: 'Refresh checkout and try again. The request identifier is invalid.' }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
    return NextResponse.json({ error: 'Your cart must contain between 1 and 30 product lines.' }, { status: 400 });
  }

  const items: Array<{ product_id: string; quantity: number }> = [];
  for (const line of body.items) {
    if (!line || typeof line !== 'object') return NextResponse.json({ error: 'A cart line is invalid.' }, { status: 400 });
    const candidate = line as { productId?: unknown; quantity?: unknown };
    if (!isText(candidate.productId, 100) || !Number.isInteger(candidate.quantity) || Number(candidate.quantity) < 1 || Number(candidate.quantity) > 20) {
      return NextResponse.json({ error: 'A cart line has an invalid product or quantity.' }, { status: 400 });
    }
    items.push({ product_id: candidate.productId.trim(), quantity: Number(candidate.quantity) });
  }

  const requiredText: Array<[keyof CheckoutBody, string, number]> = [
    ['customerName', 'Enter your full name.', 100], ['customerPhone', 'Enter a valid 10-digit phone number.', 10],
    ['addressLine1', 'Enter your delivery address.', 200], ['city', 'Enter your city.', 100],
    ['state', 'Enter your state.', 100], ['pincode', 'Enter a valid 6-digit PIN code.', 6],
  ];
  for (const [key, message, max] of requiredText) {
    if (!isText(body[key], max)) return NextResponse.json({ error: message }, { status: 400 });
  }
  if (!/^\d{10}$/.test(String(body.customerPhone).trim())) return NextResponse.json({ error: 'Enter a valid 10-digit phone number.' }, { status: 400 });
  if (!/^\d{6}$/.test(String(body.pincode).trim())) return NextResponse.json({ error: 'Enter a valid 6-digit PIN code.' }, { status: 400 });
  if (body.addressLine2 !== undefined && body.addressLine2 !== null && typeof body.addressLine2 !== 'string') {
    return NextResponse.json({ error: 'The second address line is invalid.' }, { status: 400 });
  }
  if (body.deliveryMethod !== 'standard' && body.deliveryMethod !== 'express') {
    return NextResponse.json({ error: 'Choose standard or express delivery.' }, { status: 400 });
  }

  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Your session has expired. Sign in again to place the order.' }, { status: 401 });

    const { data, error } = await database.rpc('create_shop_order', {
      p_checkout_request_id: body.checkoutRequestId,
      p_items: items,
      p_customer_name: String(body.customerName).trim(),
      p_customer_phone: String(body.customerPhone).trim(),
      p_address_line1: String(body.addressLine1).trim(),
      p_address_line2: typeof body.addressLine2 === 'string' ? body.addressLine2.trim() : null,
      p_city: String(body.city).trim(),
      p_state: String(body.state).trim(),
      p_pincode: String(body.pincode).trim(),
      p_delivery_method: body.deliveryMethod,
    });

    if (error) {
      const status = error.code === '28000' ? 401 : error.code === '42501' ? 403 : 400;
      return NextResponse.json({ error: error.message || 'Could not create the order.' }, { status });
    }

    const order = data as { id?: string; order_number?: string; total_amount?: number | string; already_processed?: boolean };
    if (user.email && order.id && !order.already_processed) {
      try {
        await sendTransactionalEmail({
          to: user.email,
          subject: `ShopSphere order ${order.order_number ?? ''} received`,
          heading: 'Your order is confirmed',
          paragraphs: [`We received order ${order.order_number ?? ''}. Your payment method is Cash on Delivery.`, `Order total: ₹${Number(order.total_amount ?? 0).toLocaleString('en-IN')}. Please pay the delivery partner when your order arrives.`],
          actionLabel: 'View your orders',
          actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/orders?id=${encodeURIComponent(String(order.id))}`,
        });
      } catch (emailError) {
        console.error('ShopSphere order email could not be sent:', emailError instanceof Error ? emailError.message : 'unknown email error');
      }
    }

    const alreadyProcessed = Boolean(order?.already_processed);
    return NextResponse.json({ order: { ...order, payment_method: 'cod', payment_status: 'pending' } }, {
      status: alreadyProcessed ? 200 : 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected checkout error.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
