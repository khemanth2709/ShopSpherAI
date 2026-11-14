import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, getUserFromSession } from '@/lib/database/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const store = await cookies();
  const user = getUserFromSession(store.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ user }, { headers: { 'Cache-Control': 'private, no-store' } });
}
