'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, Mail, ShoppingBag, Sparkles } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { isDatabaseReady } from '@/lib/database/client';
import { signInWithEmail } from '@/services/auth/localAuth';
import { safeInternalPath } from '@/lib/authValidation';
import { useShopStore } from '@/store/shopStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState('/account');
  const router = useRouter();
  const setUser = useShopStore((state) => state.setUser);
  const setAuthReady = useShopStore((state) => state.setAuthReady);
  const configured = isDatabaseReady();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeInternalPath(params.get('next')));
    const callbackError = params.get('error');
    if (callbackError) setError(callbackError);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await signInWithEmail(email, password);
      setUser(user);
      setAuthReady(true);
      router.replace(nextPath);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Check your email and password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-[0_24px_80px_rgba(24,35,29,.08)] md:grid-cols-[.95fr_1.05fr]">
        <div className="relative flex min-h-[330px] flex-col justify-between overflow-hidden bg-[#e4e9dd] p-7 sm:p-10">
          <div className="absolute -right-16 -top-14 h-64 w-64 rounded-full border-[34px] border-white/30" />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#c6f277]/55 blur-2xl" />
          <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-2 text-lg font-black tracking-tight"> <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-lime"><Sparkles size={18}/></span> shop<span className="-ml-2 font-normal">sphere</span><sup className="-ml-1 text-[9px] text-moss">AI</sup></Link>
          <div className="relative z-10 mt-14">
            <span className="rounded-full border border-ink/10 bg-white/65 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.2em]">Your space. Your picks.</span>
            <h1 className="mt-5 max-w-sm text-4xl font-semibold leading-[1.02] tracking-[-.06em] sm:text-5xl">A better way to shop, <span className="font-serif italic font-normal text-moss">together.</span></h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-ink/60">Sign in to keep your cart, wishlist, orders and delivery details connected to your account.</p>
          </div>
          <p className="relative z-10 mt-10 text-[10px] font-semibold uppercase tracking-[.16em] text-ink/45">Secure customer accounts · Local SQLite database</p>
        </div>
        <form onSubmit={submit} className="p-7 sm:p-10 lg:p-12">
          <p className="eyebrow text-moss">Welcome back</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to ShopSphere</h2>
          <p className="mt-2 text-sm text-ink/55">Use the email and password associated with your account.</p>
          {!configured && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">SQLite is configured automatically. Set the first administrator credentials in <code>.env.local</code> before using the admin workspace.</p>}
          <div className="mt-7 space-y-4">
            <label className="block text-xs font-semibold">Email address
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-ink/10 px-4 focus-within:border-moss"><Mail size={16} className="text-ink/35"/><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-12 w-full bg-transparent text-sm outline-none"/></span>
            </label>
            <label className="block text-xs font-semibold">Password
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-ink/10 px-4 focus-within:border-moss"><LockKeyhole size={16} className="text-ink/35"/><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 w-full bg-transparent text-sm outline-none"/><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="text-ink/45 hover:text-ink">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>
            </label>
            <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-semibold text-moss hover:underline">Forgot password?</Link></div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}
            <button disabled={busy || !configured} className="pill-button w-full bg-ink py-3.5 text-white hover:bg-moss disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in to your account'} <ShoppingBag size={15}/></button>
          </div>
          <div className="mt-7 border-t border-ink/10 pt-6 text-center text-xs text-ink/55">New to ShopSphere? <Link className="font-bold text-moss hover:underline" href="/register">Create an account</Link></div>
          <p className="mt-5 text-center text-[10px] leading-5 text-ink/40">Your password is securely hashed and verified by the ShopSphere authentication service. Never share your password.</p>
        </form>
      </section>
    </PageShell>
  );
}
