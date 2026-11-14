import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { sendTransactionalEmail } from '@/lib/notifications/email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid order identifier.' }, { status: 400 });
  let body: { carrier?: unknown; trackingNumber?: unknown; trackingUrl?: unknown; estimatedDeliveryAt?: unknown; note?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid shipment request.' }, { status: 400 }); }
  if (typeof body.carrier !== 'string' || typeof body.trackingNumber !== 'string') return NextResponse.json({ error: 'Courier and tracking number are required.' }, { status: 400 });
  if (body.trackingUrl !== undefined && body.trackingUrl !== null && body.trackingUrl !== '' && (typeof body.trackingUrl !== 'string' || !body.trackingUrl.startsWith('https://'))) {
    return NextResponse.json({ error: 'Tracking URL must begin with https://.' }, { status: 400 });
  }
  if (body.estimatedDeliveryAt && (typeof body.estimatedDeliveryAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.estimatedDeliveryAt))) {
    return NextResponse.json({ error: 'Use YYYY-MM-DD for the estimated delivery date.' }, { status: 400 });
  }
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in as an administrator.' }, { status: 401 });
    const { data: isAdmin } = await database.rpc('is_shop_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    const { data, error } = await database.rpc('admin_save_order_shipment', {
      p_order_id: id,
      p_carrier: body.carrier.trim(),
      p_tracking_number: body.trackingNumber.trim(),
      p_tracking_url: typeof body.trackingUrl === 'string' ? body.trackingUrl.trim() || null : null,
      p_estimated_delivery_at: typeof body.estimatedDeliveryAt === 'string' ? body.estimatedDeliveryAt : null,
      p_admin_note: typeof body.note === 'string' ? body.note.slice(0, 400) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 });
    const { data: order } = await database.from('orders').select('order_number, customer_email').eq('id', id).single();
    if (order?.customer_email) {
      try {
        await sendTransactionalEmail({
          to: order.customer_email,
          subject: `Tracking details for ${order.order_number}`,
          heading: 'Your shipment is being prepared',
          paragraphs: [`Courier: ${body.carrier}`, `Tracking number: ${body.trackingNumber}`, body.estimatedDeliveryAt ? `Estimated delivery: ${body.estimatedDeliveryAt}` : 'Your tracking information has been updated.'],
          actionLabel: 'Track your order', actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/orders?id=${id}`,
        });
      } catch (emailError) { console.error('Shipment email failed:', emailError instanceof Error ? emailError.message : 'unknown'); }
    }
    return NextResponse.json({ shipment: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save shipment details.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: { title?: unknown; description?: unknown; location?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid tracking update.' }, { status: 400 }); }
  if (typeof body.title !== 'string' || body.title.trim().length < 2) return NextResponse.json({ error: 'Enter a tracking update title.' }, { status: 400 });
  try {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in as an administrator.' }, { status: 401 });
    const { data: isAdmin } = await database.rpc('is_shop_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    const { data, error } = await database.rpc('admin_add_shipment_event', {
      p_order_id: id,
      p_event_title: body.title.trim().slice(0, 120),
      p_event_description: typeof body.description === 'string' ? body.description.slice(0, 500) : null,
      p_location: typeof body.location === 'string' ? body.location.slice(0, 120) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 });
    const { data: order } = await database.from('orders').select('order_number, customer_email').eq('id', id).single();
    if (order?.customer_email) {
      try {
        await sendTransactionalEmail({
          to: order.customer_email,
          subject: `Delivery update · ${order.order_number}`,
          heading: body.title.trim().slice(0, 120),
          paragraphs: [typeof body.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 500) : `Your shipment has a new tracking update.${typeof body.location === 'string' && body.location.trim() ? ` Location: ${body.location.trim().slice(0, 120)}.` : ''}`],
          actionLabel: 'Track your order',
          actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/orders?id=${id}`,
        });
      } catch (emailError) { console.error('Shipment event email failed:', emailError instanceof Error ? emailError.message : 'unknown'); }
    }
    return NextResponse.json({ event: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not add tracking update.' }, { status: 500 });
  }
}
