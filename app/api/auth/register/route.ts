import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAccount, signIn, SESSION_COOKIE } from '@/lib/database/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; email?: unknown; password?: unknown };
    if (typeof body.name !== 'string' || typeof body.email !== 'string' || typeof body.password !== 'string') return NextResponse.json({ error: 'Enter your name, email and password.' }, { status: 400 });
    createAccount({ name: body.name, email: body.email, password: body.password });
    const { token, user } = signIn(body.email, body.password);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 86400 });
    return NextResponse.json({ user }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create account.' }, { status: 400 }); }
}
