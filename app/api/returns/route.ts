import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { sendTransactionalEmail } from '@/lib/notifications/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in to view your returns.' }, { status: 401 });
    const { data, error } = await database.from('return_requests').select('*, orders(order_number, total_amount, payment_status, placed_at)').eq('user_id', user.id).order('requested_at', { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ returns: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load returns.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { orderId?: unknown; reason?: unknown; description?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid return request.' }, { status: 400 }); }
  if (typeof body.orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.orderId) || typeof body.reason !== 'string' || typeof body.description !== 'string') {
    return NextResponse.json({ error: 'Order, reason and description are required.' }, { status: 400 });
  }
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in to request a return.' }, { status: 401 });
    const { data, error } = await database.rpc('customer_create_return_request', {
      p_order_id: body.orderId, p_reason: body.reason, p_description: body.description,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'P0002' ? 404 : 400 });
    const { data: order } = await database.from('orders').select('order_number').eq('id', body.orderId).eq('user_id', user.id).single();
    if (user.email && order?.order_number) {
      try {
        await sendTransactionalEmail({
          to: user.email,
          subject: `Return request received · ${order.order_number}`,
          heading: 'We received your return request',
          paragraphs: [`Your return request for order ${order.order_number} has been recorded. The store team will review it and update the status in your ShopSphere account.`, `Reason: ${body.reason.replaceAll('_', ' ')}.`],
          actionLabel: 'View your orders',
          actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/orders`,
        });
      } catch (emailError) { console.error('Return request email failed:', emailError instanceof Error ? emailError.message : 'unknown'); }
    }
    return NextResponse.json({ returnRequest: data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not submit the return request.' }, { status: 500 });
  }
}
