'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import { updateAccountPassword } from '@/services/auth/localAuth';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const resetToken = new URLSearchParams(window.location.search).get('token') || '';
    setToken(resetToken);
    if (!resetToken) { setReady(true); return; }
    fetch(`/api/auth/password-reset/confirm?token=${encodeURIComponent(resetToken)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { valid?: boolean }) => { if (alive) { setValidToken(body.valid === true); setReady(true); } })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!token || !validToken) { setError('This reset link is invalid or expired. Request a new link.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      await updateAccountPassword(password, token);
      setSuccess(true);
      window.setTimeout(() => router.replace('/login?password=updated'), 900);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the password. Request a new reset link.'); }
    finally { setBusy(false); }
  }

  return <PageShell><section className="mx-auto max-w-lg rounded-[2rem] border border-ink/10 bg-white p-7 shadow-sm sm:p-10"><p className="eyebrow text-moss">Secure account recovery</p><h1 className="mt-3 text-3xl font-semibold">Set a new password</h1><p className="mt-2 text-sm leading-6 text-ink/55">Choose a new password for your ShopSphere account.</p>{!ready ? <div className="mt-7 h-28 animate-pulse rounded-xl bg-cream"/> : !validToken ? <div role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">This reset link is invalid or expired. Request a fresh link from <Link href="/forgot-password" className="font-bold underline">Forgot password</Link>.</div> : <form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-xs font-semibold">New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-ink/10 px-4 text-sm outline-none focus:border-moss"/></label><label className="block text-xs font-semibold">Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-ink/10 px-4 text-sm outline-none focus:border-moss"/></label><p className="text-[10px] text-ink/45">At least 8 characters, including a letter and a number.</p>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}{success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">Password updated. Redirecting to sign in…</p>}<button disabled={busy || success} className="pill-button w-full bg-ink text-white disabled:opacity-50">{busy ? 'Updating…' : 'Update password'}</button></form>}<p className="mt-6 text-center text-xs text-ink/55"><Link href="/login" className="font-bold text-moss">Back to sign in</Link></p></section></PageShell>;
}
