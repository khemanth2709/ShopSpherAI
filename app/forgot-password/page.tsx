'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requestPasswordReset } from '@/services/auth/localAuth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try { setResetUrl(await requestPasswordReset(email)); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start password recovery.'); }
    finally { setBusy(false); }
  }

  return <PageShell><section className="mx-auto max-w-lg rounded-[2rem] border border-ink/10 bg-white p-7 shadow-sm sm:p-10"><p className="eyebrow text-moss">Account recovery</p><h1 className="mt-3 text-3xl font-semibold">Forgot your password?</h1><p className="mt-2 text-sm leading-6 text-ink/55">Enter the email address for your ShopSphere account. A secure password-reset link will be generated and, when email delivery is configured, sent to your inbox.</p>{sent ? <div role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">If an account exists for that email, a reset link has been created. Check your inbox and spam folder.{resetUrl && <p className="mt-3 break-all"><Link href={resetUrl} className="font-semibold underline">Open your password-reset link</Link><span className="mt-1 block text-[10px] text-emerald-800">Development mode only. Configure Resend to deliver reset emails in production.</span></p>}</div> : <form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-xs font-semibold">Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-ink/10 px-4 text-sm outline-none focus:border-moss" placeholder="you@example.com"/></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button disabled={busy} className="pill-button w-full bg-ink text-white disabled:opacity-50">{busy ? 'Creating link…' : 'Create reset link'}</button></form>}<p className="mt-6 text-center text-xs text-ink/55"><Link href="/login" className="font-bold text-moss">Back to sign in</Link></p></section></PageShell>;
}
