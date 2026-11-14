import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSession, SESSION_COOKIE } from '@/lib/database/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST() {
  const store = await cookies();
  revokeSession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
