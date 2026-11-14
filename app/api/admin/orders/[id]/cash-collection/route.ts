import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { sendTransactionalEmail } from '@/lib/notifications/email';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'The order identifier is invalid.' }, { status: 400 });
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in with an administrator account.' }, { status: 401 });
    const { data: isAdmin, error: roleError } = await database.rpc('is_shop_admin');
    if (roleError || !isAdmin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    const { data, error } = await database.rpc('admin_mark_cod_collected', { p_order_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400 });
    const { data: order } = await database.from('orders').select('order_number, customer_email, total_amount').eq('id', id).single();
    if (order?.customer_email) {
      try { await sendTransactionalEmail({ to: order.customer_email, subject: `Cash payment received · ${order.order_number}`, heading: 'Cash on delivery payment recorded', paragraphs: [`We recorded cash collection for order ${order.order_number}.`, `Amount recorded: ₹${Number(order.total_amount).toLocaleString('en-IN')}.`], actionLabel: 'View order', actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/orders?id=${id}` }); }
      catch (emailError) { console.error('COD collection email failed:', emailError instanceof Error ? emailError.message : 'unknown'); }
    }
    return NextResponse.json({ result: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not confirm COD collection.' }, { status: 500 });
  }
}
