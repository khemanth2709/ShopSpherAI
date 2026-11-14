'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Heart, LayoutDashboard, LogIn, LogOut, Search, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import { useShopStore } from '@/store/shopStore';
import { useState } from 'react';
import { categories } from '@/lib/products';
import { signOutFromLocal } from '@/services/auth/localAuth';
import { showShopToast } from '@/lib/shopToasts';

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const cart = useShopStore((s) => s.cart);
  const wishlist = useShopStore((s) => s.wishlist);
  const user = useShopStore((s) => s.user);
  const logout = useShopStore((s) => s.logout);
  const [search, setSearch] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = search.trim();
    if (value) router.push(`/?q=${encodeURIComponent(value)}#shop`);
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutFromLocal();
      logout();
      showShopToast({ title: 'You are signed out', message: 'Your account session has ended securely.', tone: 'success' });
      router.replace('/');
      router.refresh();
    } catch (error) {
      showShopToast({ title: 'Could not sign out', message: error instanceof Error ? error.message : 'Please try again.', tone: 'error' });
    } finally {
      setSigningOut(false);
    }
  }

  return <>
    <div className="bg-ink px-3 py-2 text-center text-[10px] font-semibold tracking-[.13em] text-white sm:text-[11px]">THOUGHTFUL FINDS, SMARTER DISCOVERY <span className="mx-1 text-lime">✳</span> FREE SHIPPING ON ORDERS OVER ₹1,999</div>
    <header className="sticky top-0 z-40 border-b border-ink/[.07] bg-cream/90 backdrop-blur-xl">
      <div className="section-shell flex min-h-[72px] items-center justify-between gap-3 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="ShopSphere home"><span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-lime text-ink"><Sparkles size={19}/></span><span className="text-[18px] font-black tracking-[-.07em]">shop<span className="font-normal">sphere</span><sup className="ml-0.5 text-[9px] font-bold tracking-normal text-moss">AI</sup></span></Link>
        <nav className="hidden items-center gap-5 text-xs font-semibold text-ink/65 lg:flex"><Link className={pathname === '/' ? 'text-ink' : 'hover:text-ink'} href="/#shop">Shop all</Link><Link className="hover:text-ink" href="/#recommendations">For you</Link><Link className="hover:text-ink" href="/orders">Track order</Link><Link className="hover:text-ink" href="/account">My account</Link></nav>
        <form onSubmit={submitSearch} className="hidden h-10 max-w-[290px] flex-1 items-center gap-2 rounded-full border border-ink/10 bg-white px-3.5 md:flex"><Search size={15} className="shrink-0 text-ink/40"/><input aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-xs outline-none placeholder:text-ink/40" placeholder="Search products, brands…"/><button className="text-[10px] font-bold text-moss">Search</button></form>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link href="/wishlist" className="icon-button" aria-label="Wishlist"><Heart size={17}/>{wishlist.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[9px] font-bold">{wishlist.length}</span>}</Link>
          <Link href="/cart" className="icon-button" aria-label="Shopping cart"><ShoppingBag size={17}/>{count > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[9px] font-bold">{count}</span>}</Link>
          {user ? <>
            <Link href="/account" className="icon-button gap-2 px-3" aria-label="My account"><UserRound size={17}/><span className="hidden text-[11px] font-semibold sm:inline">My account</span></Link>
            <button type="button" onClick={() => void handleSignOut()} disabled={signingOut} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 text-[10px] font-bold text-ink transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50" aria-label="Sign out"><LogOut size={14}/><span>{signingOut ? 'Signing out…' : 'Sign out'}</span></button>
          </> : <Link href={`/login?next=${encodeURIComponent(pathname || '/')}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[10px] font-bold text-white transition hover:bg-moss" aria-label="Sign in"><LogIn size={14}/><span>Sign in</span></Link>}
          {user && <Link href="/notifications" className="icon-button" aria-label="Notifications"><Bell size={17}/></Link>}
          {user?.role === 'admin' && <Link href="/admin" className="hidden items-center gap-1 text-[11px] font-bold text-moss xl:flex"><LayoutDashboard size={15}/> Admin</Link>}
        </div>
      </div>
      <div className="border-t border-ink/[.045] bg-white/50"><div className="section-shell flex gap-4 overflow-x-auto py-2.5 text-[10px] font-semibold text-ink/55 [scrollbar-width:none]">{categories.slice(1).map((category) => <Link key={category} href={`/?category=${encodeURIComponent(category)}#shop`} className="shrink-0 transition hover:text-moss">{category}</Link>)}</div></div>
    </header>
  </>;
}
