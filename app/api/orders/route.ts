import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in to view your orders.' }, { status: 401 });
    const { data, error } = await database
      .from('orders')
      .select('*, order_items(*), order_status_events(*), shipments(*, shipment_events(*)), return_requests(*)')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load your orders.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
