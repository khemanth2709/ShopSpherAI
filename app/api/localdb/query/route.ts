import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, getUserFromSession } from '@/lib/database/auth';
import { executeQuery, type QuerySpec } from '@/lib/database/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as QuerySpec;
    const cookieStore = await cookies();
    const user = getUserFromSession(cookieStore.get(SESSION_COOKIE)?.value);
    if (!body || typeof body !== 'object' || typeof body.table !== 'string' || !['select','insert','update','delete','upsert'].includes(body.action)) {
      return NextResponse.json({ data: null, error: { message: 'Invalid local database query.' } }, { status: 400 });
    }
    // Browser-facing queries intentionally expose only customer-safe tables; admin APIs use the server adapter.
    const allowed = new Set(['products','profiles','user_addresses','user_preferences','customer_notifications']);
    if (!allowed.has(body.table)) return NextResponse.json({ data: null, error: { message: 'This table cannot be queried from the browser.' } }, { status: 403 });
    const result = executeQuery({ ...body, filters: Array.isArray(body.filters) ? body.filters : [], orders: Array.isArray(body.orders) ? body.orders : [] }, user);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const cause = error as { message?: string; code?: string };
    return NextResponse.json({ data: null, error: { message: cause.message || 'Database query failed.', code: cause.code } }, { status: 400 });
  }
}
