import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in as an administrator.' }, { status: 401 });
    const { data: isAdmin } = await database.rpc('is_shop_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    const { data, error } = await database.from('return_requests').select('*, orders(order_number, customer_name, customer_email, customer_phone, total_amount, payment_status, status)').order('requested_at', { ascending: false }).limit(150);
    if (error) throw error;
    return NextResponse.json({ returns: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load return requests.' }, { status: 500 });
  }
}
