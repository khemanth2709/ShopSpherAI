import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, signIn } from '@/lib/database/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.password) return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
    const { token, user } = signIn(body.email, body.password);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400 });
    return NextResponse.json({ user }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not sign in.' }, { status: 401 }); }
}
