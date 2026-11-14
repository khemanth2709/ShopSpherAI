import { NextResponse } from 'next/server';
import { confirmPasswordReset, isPasswordResetTokenValid } from '@/lib/database/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  return NextResponse.json({ valid: token.length >= 32 && isPasswordResetTokenValid(token) }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown; password?: unknown };
    if (typeof body.token !== 'string' || typeof body.password !== 'string') return NextResponse.json({ error: 'The reset link or new password is missing.' }, { status: 400 });
    confirmPasswordReset(body.token, body.password);
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update password.' }, { status: 400 }); }
}
