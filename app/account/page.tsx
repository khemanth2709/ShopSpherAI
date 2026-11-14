'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageShell from '@/components/PageShell';
import ProductImage from '@/components/ProductImage';
import RequireAuth from '@/components/RequireAuth';
import RecommendationRail from '@/components/RecommendationRail';
import { useShopStore } from '@/store/shopStore';
import { products, formatPrice } from '@/lib/products';
import { createClient } from '@/lib/database/client';
import { signOutFromLocal } from '@/services/auth/localAuth';
import type { Address } from '@/types/domain';

type AddressRow = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
};

function fromAddressRow(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    name: row.recipient_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2 || '',
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    isDefault: row.is_default,
  };
}

function AccountContent() {
  const user = useShopStore((state) => state.user);
  const logout = useShopStore((state) => state.logout);
  const setUser = useShopStore((state) => state.setUser);
  const viewed = useShopStore((state) => state.recentlyViewed);
  const wishlist = useShopStore((state) => state.wishlist);
  const searchHistory = useShopStore((state) => state.searchHistory);
  const resetSearchHistory = useShopStore((state) => state.clearSearchHistory);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [ordersCount, setOrdersCount] = useState(0);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressForm, setAddressForm] = useState({ label: 'Home', name: user?.name || '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [name, setName] = useState(user?.name || '');
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const router = useRouter();
  const database = useMemo(() => createClient(), []);

  const viewedProducts = viewed.map((id) => products.find((product) => product.id === id)).filter((product): product is typeof products[number] => Boolean(product));
  const activity = viewedProducts;

  const userName = user?.name;
  useEffect(() => {
    if (!userName) return;
    setName(userName);
    setAddressForm((current) => ({ ...current, name: userName }));
  }, [userName]);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetch('/api/orders', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { orders?: unknown[] };
        if (response.ok && active) setOrdersCount(payload.orders?.length ?? 0);
      })
      .catch((error) => console.warn('Could not load the account order count.', error));
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function loadAddresses() {
      const { data, error } = await database
        .from('user_addresses')
        .select('id,label,recipient_name,phone,line1,line2,city,state,pincode,is_default')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!active) return;
      if (error) {
        setAddressError(`Could not load saved addresses: ${error.message}. Confirm that the local SQLite database is available.`);
      } else {
        setAddresses((data || []).map((row: AddressRow) => fromAddressRow(row)));
        setAddressError('');
      }
      setAddressesLoading(false);
    }

    void loadAddresses();
    const channel = database
      .channel(`user-addresses-${userId}`)
      .on('sqlite_changes', {
        event: '*', schema: 'public', table: 'user_addresses', filter: `user_id=eq.${userId}`, 
      }, () => { void loadAddresses(); })
      .subscribe();

    return () => {
      active = false;
      void database.removeChannel(channel);
    };
  }, [database, userId]);

  async function saveProfile() {
    if (!user) return;
    setProfileError('');
    const fullName = name.trim();
    if (fullName.length < 2) {
      setProfileError('Enter a name with at least two characters.');
      return;
    }
    setProfileBusy(true);
    try {
      const { error } = await database.from('profiles').update({ full_name: fullName }).eq('id', user.id);
      if (error) throw error;
      setUser({ ...user, name: fullName });
      setSaved(true);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not update your profile.');
    } finally {
      setProfileBusy(false);
    }
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (!/^\d{10}$/.test(addressForm.phone) || !/^\d{6}$/.test(addressForm.pincode)) {
      setAddressError('Enter a valid 10-digit phone number and 6-digit PIN code.');
      return;
    }
    setAddressBusy(true);
    setAddressError('');
    try {
      const isDefault = addresses.length === 0;
      if (isDefault) {
        const { error: resetError } = await database.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
        if (resetError) throw resetError;
      }
      const { data, error } = await database.from('user_addresses').insert({
        user_id: user.id,
        label: addressForm.label.trim() || 'Address',
        recipient_name: addressForm.name.trim(),
        phone: addressForm.phone,
        line1: addressForm.line1.trim(),
        line2: addressForm.line2.trim() || null,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.pincode,
        is_default: isDefault,
      }).select('id,label,recipient_name,phone,line1,line2,city,state,pincode,is_default').single();
      if (error) throw error;
      setAddresses((current) => [fromAddressRow(data as AddressRow), ...current.map((item) => isDefault ? { ...item, isDefault: false } : item)]);
      setAddressForm({ label: 'Home', name: user.name, phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : 'Could not save this address.');
    } finally {
      setAddressBusy(false);
    }
  }

  async function deleteAddress(addressId: string) {
    setAddressError('');
    const { error } = await database.from('user_addresses').delete().eq('id', addressId);
    if (error) setAddressError(error.message);
    else setAddresses((current) => current.filter((address) => address.id !== addressId));
  }

  async function makeDefaultAddress(addressId: string) {
    if (!user) return;
    setAddressError('');
    const { error: clearError } = await database.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
    if (clearError) { setAddressError(clearError.message); return; }
    const { error } = await database.from('user_addresses').update({ is_default: true }).eq('id', addressId);
    if (error) setAddressError(error.message);
    else setAddresses((current) => current.map((address) => ({ ...address, isDefault: address.id === addressId })));
  }

  async function signOut() {
    setSignOutBusy(true);
    try {
      await signOutFromLocal();
      logout();
      router.replace('/');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setSignOutBusy(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <p className="eyebrow text-moss">Your space</p>
      <h1 className="mt-2 text-3xl font-semibold">Account dashboard</h1>
      <p className="mt-2 text-sm text-ink/55">Your profile and shopping preferences are stored with your local ShopSphere account.</p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold">Profile</h2>
          <label className="mt-4 block text-xs font-semibold">Display name
            <input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-3 text-sm" />
          </label>
          <p className="mt-3 text-xs text-ink/50">{user.email}</p>
          <p className="mt-2 text-xs text-ink/50">Role: {user.role}</p>
          <button onClick={() => void saveProfile()} disabled={profileBusy} className="pill-button mt-4 bg-ink px-4 py-2.5 text-xs text-white disabled:opacity-50">{profileBusy ? 'Saving…' : 'Save profile'}</button>
          {saved && <p role="status" className="mt-2 text-xs text-moss">Profile saved to your account.</p>}
          {profileError && <p role="alert" className="mt-2 text-xs text-rose-600">{profileError}</p>}
          <button onClick={() => void signOut()} disabled={signOutBusy} className="mt-4 block text-xs font-semibold text-rose-600 disabled:opacity-50">{signOutBusy ? 'Signing out…' : 'Sign out'}</button>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link href="/orders" className="rounded-xl bg-sage/50 p-3"><b className="block text-xl">{ordersCount}</b><span className="text-[10px] text-ink/55">Orders on your account</span></Link>
            <Link href="/wishlist" className="rounded-xl bg-sage/50 p-3"><b className="block text-xl">{wishlist.length}</b><span className="text-[10px] text-ink/55">Wishlist items</span></Link><Link href="/notifications" className="rounded-xl bg-sage/50 p-3"><b className="block text-xl">Updates</b><span className="text-[10px] text-ink/55">Order notifications</span></Link>
          </div>
        </section>

        <section id="preferences" className="rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-semibold">Why these recommendations?</h2>
          <p className="mt-2 text-xs leading-5 text-ink/55">Your cart, wishlist, saved items, browsing history, and search history are saved to your account in the local SQLite database.</p>
          <div className="mt-5">
            <p className="text-xs font-bold">Recently viewed</p>
            {activity.length ? <div className="mt-3 space-y-2">{activity.slice(0, 5).map((product) => <div key={product.id} className="flex items-center gap-3 rounded-xl bg-cream p-2"><ProductImage src={product.image} productId={product.id} alt={product.name} className="h-10 w-10 rounded-lg object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.name}</p><p className="text-[10px] text-ink/45">{product.category} · {formatPrice(product.price)}</p></div></div>)}</div> : <p className="mt-2 text-xs text-ink/45">No views recorded yet. Browse products to build a signal.</p>}
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between"><p className="text-xs font-bold">Recent searches</p><button onClick={resetSearchHistory} className="text-[10px] font-semibold text-moss">Clear history</button></div>
            <div className="mt-2 flex flex-wrap gap-2">{searchHistory.length ? searchHistory.map((query) => <span key={query} className="rounded-full bg-sage px-3 py-1.5 text-[10px]">{query}</span>) : <span className="text-xs text-ink/45">No recent searches.</span>}</div>
          </div>
          <p className="mt-5 rounded-xl bg-sage/40 p-3 text-xs leading-5">Current preference summary: {activity.length ? `you viewed ${activity.slice(0, 2).map((product) => product.name).join(' and ')}; typical viewed price range is ₹${Math.min(...activity.map((product) => product.price)).toLocaleString('en-IN')}–₹${Math.max(...activity.map((product) => product.price)).toLocaleString('en-IN')}.` : 'there is not enough activity yet, so recommendations fall back to popular products.'}</p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Saved addresses</h2><p className="mt-1 text-xs text-ink/50">Saved securely to your account and saved in the local SQLite database on this server.</p></div>
          <span className="rounded-full bg-sage px-3 py-1 text-[10px]">{addresses.length} saved</span>
        </div>
        {addressError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{addressError}</p>}
        {addressesLoading ? <p className="mt-4 text-xs text-ink/45">Loading your saved addresses…</p> : addresses.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{addresses.map((address) => <article key={address.id} className="rounded-xl border border-ink/10 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold">{address.label} {address.isDefault && <span className="ml-1 rounded-full bg-lime px-2 py-0.5 text-[9px]">Default</span>}</p><p className="mt-2 text-xs leading-5 text-ink/60">{address.name}, {address.phone}<br/>{address.line1}{address.line2 ? `, ${address.line2}` : ''}<br/>{address.city}, {address.state} {address.pincode}</p></div><button onClick={() => void deleteAddress(address.id)} className="text-[10px] font-semibold text-rose-600">Delete</button></div>{!address.isDefault && <button onClick={() => void makeDefaultAddress(address.id)} className="mt-3 text-[10px] font-bold text-moss">Set as default</button>}</article>)}</div>}
        <form onSubmit={saveAddress} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([['label', 'Label'], ['name', 'Recipient name'], ['phone', '10-digit phone'], ['line1', 'Address line'], ['line2', 'Landmark (optional)'], ['city', 'City'], ['state', 'State'], ['pincode', '6-digit PIN']] as const).map(([key, label]) => <label key={key} className="block text-xs font-semibold">{label}<input required={key !== 'line2'} value={addressForm[key]} onChange={(event) => setAddressForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-xs" /></label>)}
          <div className="flex items-end"><button disabled={addressBusy} className="pill-button w-full bg-ink px-4 py-2.5 text-xs text-white disabled:opacity-50">{addressBusy ? 'Saving address…' : 'Save address'}</button></div>
        </form>
      </section>
      <RecommendationRail products={products} strategy="personalized" limit={5} />
    </>
  );
}

export default function AccountPage() {
  return <PageShell><RequireAuth><AccountContent /></RequireAuth></PageShell>;
}
