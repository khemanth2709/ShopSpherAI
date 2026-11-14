import { NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 });
    const { data, error } = await database.from('customer_notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ notifications: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load notifications.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: { id?: unknown; markAll?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid notification update.' }, { status: 400 }); }
  try {
    const database = await createClient();
    const { data: { user }, error: authError } = await database.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in to update notifications.' }, { status: 401 });
    const query = database.from('customer_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id);
    const result = body.markAll === true ? await query.is('read_at', null) : typeof body.id === 'string' ? await query.eq('id', body.id) : null;
    if (!result) return NextResponse.json({ error: 'Provide a notification ID or markAll=true.' }, { status: 400 });
    if (result.error) throw result.error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update notification.' }, { status: 500 });
  }
}
