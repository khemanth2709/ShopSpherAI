'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import { formatPrice } from '@/lib/products';

type MonthlyRow = { month: string; orders: number; sales: number };
type Analytics = { total_orders: number; active_orders: number; delivered_orders: number; cancelled_orders: number; gross_sales: number; cod_collected: number; cod_due: number; open_returns: number; low_stock_products: number; monthly: MonthlyRow[] };
function monthLabel(value: string) { const [year, month] = value.split('-').map(Number); return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); }
function AnalyticsContent() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { const response = await fetch('/api/admin/analytics', { cache: 'no-store' }); const payload = await response.json() as { analytics?: Analytics; error?: string }; if (!response.ok || !payload.analytics) throw new Error(payload.error || 'Could not load analytics.'); setData(payload.analytics); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load analytics.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const maxSales = Math.max(1, ...(data?.monthly ?? []).map((row) => Number(row.sales)));
  return <RequireAuth role="admin"><main className="min-h-screen bg-[#f5f6f3] text-ink"><header className="flex h-[72px] items-center justify-between border-b border-black/[.06] bg-white px-4 sm:px-7"><div><p className="text-xs text-black/45">Workspace / Analytics</p><h1 className="font-bold">Store performance</h1></div><button onClick={() => void load()} className="pill-button border border-ink/10"><RefreshCw size={14}/> Refresh</button></header><div className="mx-auto max-w-6xl px-4 py-7 sm:px-7"><Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-moss"><ArrowLeft size={14}/> Store overview</Link><div className="mt-5"><p className="eyebrow text-moss">database · COD operations</p><h2 className="mt-2 text-3xl font-semibold">Business analytics</h2><p className="mt-2 text-sm text-ink/55">Order, COD collection, returns and inventory indicators from your database.</p></div>{error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}{loading && <p className="mt-6 rounded-xl bg-white p-5 text-sm">Loading analytics…</p>}{data && <><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Total orders', data.total_orders], ['Active orders', data.active_orders], ['Delivered', data.delivered_orders], ['Cancelled', data.cancelled_orders], ['Gross order value', formatPrice(Number(data.gross_sales))], ['COD collected', formatPrice(Number(data.cod_collected))], ['COD awaiting collection', formatPrice(Number(data.cod_due))], ['Open return requests', data.open_returns], ['Products below 5 units', data.low_stock_products]].map(([label, value]) => <article key={String(label)} className="rounded-2xl border border-ink/10 bg-white p-5"><p className="text-xs text-ink/50">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></article>)}</div><section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 sm:p-6"><h3 className="text-lg font-semibold">Monthly order performance</h3><p className="mt-1 text-xs text-ink/50">Recent six-month sales totals exclude cancelled orders.</p>{data.monthly.length === 0 ? <p className="mt-6 text-sm text-ink/45">No order history yet.</p> : <div className="mt-6 space-y-4">{data.monthly.map((row) => <div key={row.month} className="grid grid-cols-[70px_1fr_90px] items-center gap-3 text-xs"><span className="font-semibold">{monthLabel(row.month)}</span><div className="h-3 overflow-hidden rounded-full bg-ink/5"><div className="h-full rounded-full bg-moss" style={{ width: `${Math.max(2, Number(row.sales) / maxSales * 100)}%` }}/></div><div className="text-right"><b>{formatPrice(Number(row.sales))}</b><p className="text-[9px] text-ink/45">{row.orders} orders</p></div></div>)}</div>}</section><div className="mt-6 flex flex-wrap gap-2"><Link href="/admin/orders" className="pill-button bg-ink text-white">Manage orders</Link><Link href="/admin/returns" className="pill-button border border-ink/10">Manage returns</Link></div><p className="mt-5 text-[10px] leading-5 text-ink/40">Gross order value is the sum of non-cancelled order totals. It is not accounting revenue recognition. Configure GST, refunds, shipping costs and business expenses before using these figures as statutory financial reports.</p></>}</div></main></RequireAuth>;
}
export default function AdminAnalyticsPage() { return <AnalyticsContent/>; }
