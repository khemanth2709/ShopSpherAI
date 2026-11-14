import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, getUserFromSession } from '@/lib/database/auth';
import { executeRpc } from '@/lib/database/rpc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; args?: unknown };
    if (typeof body.name !== 'string' || !/^[a-z_]{2,80}$/.test(body.name)) return NextResponse.json({ data: null, error: { message: 'Invalid database function.' } }, { status: 400 });
    const cookieStore = await cookies();
    const user = getUserFromSession(cookieStore.get(SESSION_COOKIE)?.value);
    const data = executeRpc(body.name, (body.args && typeof body.args === 'object' ? body.args : {}) as Record<string, unknown>, user);
    return NextResponse.json({ data, error: null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const cause = error as { message?: string; code?: string };
    const status = cause.code === '28000' ? 401 : cause.code === '42501' ? 403 : cause.code === 'P0002' ? 404 : 400;
    return NextResponse.json({ data: null, error: { message: cause.message || 'Database function failed.', code: cause.code || 'SQLITE_ERROR' } }, { status });
  }
}
