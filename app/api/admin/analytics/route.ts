import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in as an administrator.' }, { status: 401 });
    const { data: isAdmin } = await database.rpc('is_shop_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    const { data, error } = await database.rpc('admin_list_shop_analytics');
    if (error) throw error;
    return NextResponse.json({ analytics: data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load analytics.' }, { status: 500 });
  }
}
