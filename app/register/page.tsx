'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, UserRound, LockKeyhole, Sparkles } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { isDatabaseReady } from '@/lib/database/client';
import { registerWithEmail } from '@/services/auth/localAuth';
import { validateNewPassword } from '@/lib/authValidation';
import { useShopStore } from '@/store/shopStore';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const setUser = useShopStore((state) => state.setUser);
  const setAuthReady = useShopStore((state) => state.setAuthReady);
  const configured = isDatabaseReady();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const passwordError = validateNewPassword(password);
    if (passwordError) { setError(passwordError); return; }
    if (password !== confirmPassword) { setError('Your password confirmation does not match.'); return; }
    setBusy(true);
    try {
      const result = await registerWithEmail({ name, email, password });
      if (result.needsEmailConfirmation) setNotice('Your account has been created. Check your inbox and confirm your email before signing in.');
      else if (result.shopUser) { setUser(result.shopUser); setAuthReady(true); router.replace('/account'); router.refresh(); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create your account. Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <PageShell>
      <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-[0_24px_80px_rgba(24,35,29,.08)] md:grid-cols-[.9fr_1.1fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[#e4e9dd] p-10 md:flex">
          <div className="absolute -right-20 -top-16 h-72 w-72 rounded-full border-[38px] border-white/35"/><div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#c6f277]/60 blur-2xl"/>
          <Link href="/" className="relative z-10 flex items-center gap-2 text-lg font-black tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-lime"><Sparkles size={18}/></span> shop<span className="-ml-2 font-normal">sphere</span><sup className="-ml-1 text-[9px] text-moss">AI</sup></Link>
          <div className="relative z-10"><p className="eyebrow text-moss">Join the experience</p><h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-.06em]">Good finds. <span className="font-serif italic font-normal text-moss">Better days.</span></h1><p className="mt-4 max-w-sm text-sm leading-6 text-ink/60">Create one secure account for your wishlist, cart, orders and saved delivery addresses.</p></div>
          <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[.16em] text-ink/45">Private account · Personal shopping</p>
        </div>
        <form onSubmit={submit} className="p-7 sm:p-10 lg:p-12">
          <p className="eyebrow text-moss">Create your account</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Join ShopSphere</h2><p className="mt-2 text-sm text-ink/55">Your account is stored securely in the local SQLite database.</p>
          {!configured && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">SQLite is created automatically when the application starts.</p>}
          <div className="mt-7 space-y-4">
            <label className="block text-xs font-semibold">Full name<span className="mt-2 flex items-center gap-3 rounded-xl border border-ink/10 px-4 focus-within:border-moss"><UserRound size={16} className="text-ink/35"/><input required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" className="h-12 w-full bg-transparent text-sm outline-none"/></span></label>
            <label className="block text-xs font-semibold">Email address<span className="mt-2 flex items-center gap-3 rounded-xl border border-ink/10 px-4 focus-within:border-moss"><Mail size={16} className="text-ink/35"/><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-12 w-full bg-transparent text-sm outline-none"/></span></label>
            <label className="block text-xs font-semibold">Password<span className="mt-2 flex items-center gap-3 rounded-xl border border-ink/10 px-4 focus-within:border-moss"><LockKeyhole size={16} className="text-ink/35"/><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters and a number" className="h-12 w-full bg-transparent text-sm outline-none"/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="text-ink/45">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
            <label className="block text-xs font-semibold">Confirm password<input required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the password again" className="mt-2 h-12 w-full rounded-xl border border-ink/10 px-4 text-sm outline-none focus:border-moss"/></label>
            <p className="text-[10px] text-ink/45">Use at least 8 characters, including a letter and a number.</p>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}
            {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{notice}</p>}
            <button disabled={busy || !configured} className="pill-button w-full bg-ink py-3.5 text-white hover:bg-moss disabled:opacity-50">{busy ? 'Creating account…' : 'Create my account'}</button>
          </div>
          <div className="mt-7 border-t border-ink/10 pt-6 text-center text-xs text-ink/55">Already have an account? <Link className="font-bold text-moss hover:underline" href="/login">Sign in</Link></div>
        </form>
      </section>
    </PageShell>
  );
}
