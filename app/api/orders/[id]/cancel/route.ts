import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { sendTransactionalEmail } from '@/lib/notifications/email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid order identifier.' }, { status: 400 });
  let note: string | null = null;
  try {
    const body = await request.json() as { reason?: unknown };
    if (typeof body.reason === 'string') note = body.reason.slice(0, 400);
  } catch { /* Reason is optional. */ }
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in to cancel this order.' }, { status: 401 });
    const { data, error } = await database.rpc('customer_cancel_shop_order', { p_order_id: id, p_reason: note });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'P0002' ? 404 : 400 });
    const { data: order } = await database.from('orders').select('order_number, customer_email').eq('id', id).single();
    if (order?.customer_email) {
      try {
        await sendTransactionalEmail({
          to: order.customer_email,
          subject: `Order ${order.order_number} cancelled`,
          heading: 'Your order was cancelled',
          paragraphs: [`Order ${order.order_number} has been cancelled. Reserved product stock has been returned to inventory.`, note || 'If you need help, contact the store support team.'],
          actionLabel: 'View your orders',
          actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/orders`,
        });
      } catch (emailError) { console.error('Order cancellation email failed:', emailError instanceof Error ? emailError.message : 'unknown'); }
    }
    return NextResponse.json({ result: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not cancel this order.' }, { status: 500 });
  }
}
