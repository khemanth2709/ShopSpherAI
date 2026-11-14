import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in with an administrator account.' }, { status: 401 });
    const { data: isAdmin, error: roleError } = await database.rpc('is_shop_admin');
    if (roleError || !isAdmin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    const { data, error } = await database
      .from('orders')
      .select('*, order_items(*), order_status_events(*), shipments(*, shipment_events(*)), return_requests(*)')
      .order('placed_at', { ascending: false })
      .limit(250);
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load store orders.' }, { status: 500 });
  }
}
