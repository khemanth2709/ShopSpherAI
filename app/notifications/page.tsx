'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import PageShell from '@/components/PageShell';
import RequireAuth from '@/components/RequireAuth';
import { createClient, isDatabaseReady } from '@/lib/database/client';
import { useShopStore } from '@/store/shopStore';

type Notification = { id: string; notification_type: string; title: string; message: string; href: string; read_at: string | null; created_at: string };
function NotificationsContent() {
  const userId = useShopStore((state) => state.user?.id);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unread = items.filter((item) => !item.read_at).length;
  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      const payload = await response.json() as { notifications?: Notification[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not load notifications.');
      setItems(payload.notifications ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load notifications.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    if (!userId || !isDatabaseReady()) return;
    const database = createClient();
    const channel = database.channel(`shopsphere-notifications-${userId}`)
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'customer_notifications', filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    return () => { void database.removeChannel(channel); };
  }, [load, userId]);

  async function markRead(id?: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : { markAll: true }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not update notifications.');
      setItems((current) => current.map((item) => (!id || item.id === id) ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : 'Could not update notifications.'); }
    finally { setBusy(false); }
  }

  return <PageShell><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow text-moss">Your ShopSphere updates</p><h1 className="mt-2 text-3xl font-semibold">Notifications</h1><p className="mt-2 text-sm text-ink/55">Order, shipment and return updates for your account.</p></div><div className="flex gap-2"><button onClick={() => void load()} className="pill-button border border-ink/10"><RefreshCw size={14}/> Refresh</button><button disabled={busy || unread === 0} onClick={() => void markRead()} className="pill-button bg-ink text-white disabled:opacity-40"><CheckCheck size={14}/> Mark all read</button></div></div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {loading && <div className="mt-8 rounded-2xl bg-white p-6 text-sm text-ink/50">Loading notifications…</div>}
    {!loading && items.length === 0 && <div className="mt-8 rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center"><Bell className="mx-auto text-ink/30"/><h2 className="mt-3 font-semibold">You&apos;re all caught up</h2><p className="mt-1 text-xs text-ink/50">New order and delivery updates will appear here.</p></div>}
    {!loading && items.length > 0 && <div className="mt-8 space-y-3">{items.map((item) => <article key={item.id} className={`rounded-2xl border p-4 sm:p-5 ${item.read_at ? 'border-ink/10 bg-white' : 'border-moss/30 bg-sage/30'}`}><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.read_at ? 'bg-ink/15' : 'bg-moss'}`}/><div><h2 className="text-sm font-semibold">{item.title}</h2><p className="mt-1 text-xs leading-5 text-ink/60">{item.message}</p><p className="mt-2 text-[10px] text-ink/40">{new Date(item.created_at).toLocaleString('en-IN')}</p><div className="mt-3 flex gap-3"><Link href={item.href || '/orders'} className="text-xs font-bold text-moss underline underline-offset-4">Open update</Link>{!item.read_at && <button onClick={() => void markRead(item.id)} disabled={busy} className="text-xs font-semibold text-ink/55">Mark read</button>}</div></div></div></div></article>)}</div>}
  </PageShell>;
}
export default function NotificationsPage() { return <RequireAuth><NotificationsContent/></RequireAuth>; }
