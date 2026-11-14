import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { sendTransactionalEmail } from '@/lib/notifications/email';
import { ORDER_STATUS_LABELS } from '@/lib/orderWorkflow';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'The order identifier is invalid.' }, { status: 400 });
  let body: { status?: unknown; note?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'The status update request was invalid.' }, { status: 400 }); }
  const allowed = ['confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
  if (typeof body.status !== 'string' || !allowed.includes(body.status)) return NextResponse.json({ error: 'Choose a valid order status.' }, { status: 400 });
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') return NextResponse.json({ error: 'The order note must be text.' }, { status: 400 });

  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in with an administrator account.' }, { status: 401 });
    const { data: isAdmin, error: roleError } = await database.rpc('is_shop_admin');
    if (roleError || !isAdmin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    const { data, error } = await database.rpc('admin_update_shop_order_status', {
      p_order_id: id, p_status: body.status, p_note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400 });
    const { data: order } = await database.from('orders').select('order_number, customer_email').eq('id', id).single();
    if (order?.customer_email) {
      try {
        await sendTransactionalEmail({
          to: order.customer_email,
          subject: `Order ${order.order_number} · ${ORDER_STATUS_LABELS[body.status as keyof typeof ORDER_STATUS_LABELS]}`,
          heading: 'Your order status changed',
          paragraphs: [`Order ${order.order_number} is now ${ORDER_STATUS_LABELS[body.status as keyof typeof ORDER_STATUS_LABELS]}.`, typeof body.note === 'string' && body.note ? body.note.slice(0, 500) : 'Sign in to ShopSphere to view your delivery progress.'],
          actionLabel: 'Track your order', actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/orders?id=${id}`,
        });
      } catch (emailError) { console.error('Order status email failed:', emailError instanceof Error ? emailError.message : 'unknown'); }
    }
    return NextResponse.json({ result: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update the order.' }, { status: 500 });
  }
}
