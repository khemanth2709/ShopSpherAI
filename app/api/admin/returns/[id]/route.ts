import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { sendTransactionalEmail } from '@/lib/notifications/email';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid return request identifier.' }, { status: 400 });
  let body: { status?: unknown; note?: unknown; refundReference?: unknown; refundAmount?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid return update.' }, { status: 400 }); }
  if (typeof body.status !== 'string') return NextResponse.json({ error: 'Return status is required.' }, { status: 400 });
  try {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in as an administrator.' }, { status: 401 });
    const { data: isAdmin } = await database.rpc('is_shop_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    const { data, error } = await database.rpc('admin_process_return_request', {
      p_return_id: id,
      p_status: body.status,
      p_admin_note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
      p_refund_reference: typeof body.refundReference === 'string' ? body.refundReference.slice(0, 120) : null,
      p_refund_amount: typeof body.refundAmount === 'number' ? body.refundAmount : null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400 });
    const { data: row } = await database.from('return_requests').select('user_id, orders(order_number, customer_email)').eq('id', id).single();
    const order = Array.isArray(row?.orders) ? row.orders[0] : row?.orders;
    if (order?.customer_email) {
      try { await sendTransactionalEmail({ to: order.customer_email, subject: `Return update for ${order.order_number}`, heading: 'Your return request was updated', paragraphs: [`Return status: ${body.status}.`, typeof body.note === 'string' && body.note ? body.note : 'Sign in to ShopSphere to view the latest return details.'], actionLabel: 'View your orders', actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/orders` }); }
      catch (emailError) { console.error('Return notification email failed:', emailError instanceof Error ? emailError.message : 'unknown'); }
    }
    return NextResponse.json({ result: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update return request.' }, { status: 500 });
  }
}
