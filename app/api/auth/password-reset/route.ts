import { NextResponse } from 'next/server';
import { createPasswordReset } from '@/lib/database/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown };
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    const token = createPasswordReset(body.email);
    const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const resetUrl = token ? `${base}/reset-password?token=${encodeURIComponent(token)}` : null;
    // In production, configure Resend so the token is delivered privately by email.
    if (token && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      const { sendTransactionalEmail } = await import('@/lib/notifications/email');
      await sendTransactionalEmail({ to: body.email.trim(), subject: 'Reset your ShopSphere password', heading: 'Password reset requested', paragraphs: ['Use the secure link below to choose a new password. This link expires in 30 minutes.'], actionLabel: 'Reset password', actionUrl: resetUrl! });
    }
    return NextResponse.json({ ok: true, resetUrl: process.env.NODE_ENV === 'production' ? undefined : resetUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not start password recovery.' }, { status: 400 }); }
}
