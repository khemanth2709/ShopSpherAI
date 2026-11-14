'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, Clock3, FileText, Package, RefreshCw, Truck } from 'lucide-react';
import PageShell from '@/components/PageShell';
import ProductImage from '@/components/ProductImage';
import EmptyState from '@/components/EmptyState';
import RequireAuth from '@/components/RequireAuth';
import { formatPrice } from '@/lib/products';
import { createClient, isDatabaseReady } from '@/lib/database/client';
import { useShopStore } from '@/store/shopStore';
import { canRequestReturn } from '@/lib/orderWorkflow';

const ORDER_STEPS = [
  { value: 'order_placed', label: 'Order placed' }, { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' }, { value: 'shipped', label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for delivery' }, { value: 'delivered', label: 'Delivered' },
] as const;

type OrderItem = { id: string; product_id: string | null; product_name: string; product_category: string; product_image: string; unit_price: number | string; quantity: number; line_total: number | string };
type OrderEvent = { id: string; status: string; note: string | null; created_at: string };
type ShipmentEvent = { id: string; event_title: string; event_description: string | null; location: string | null; event_at: string };
type Shipment = { id: string; carrier: string; tracking_number: string; tracking_url: string | null; estimated_delivery_at: string | null; shipment_events: ShipmentEvent[] };
type ReturnRequest = { id: string; reason: string; description: string; status: string; refund_status: string; refund_amount: number | string; requested_at: string; admin_note: string | null };
type OrderRecord = {
  id: string; order_number: string; invoice_number: string | null; placed_at: string; customer_name: string; customer_email: string; customer_phone: string;
  address_line1: string; address_line2: string | null; city: string; state: string; pincode: string; delivery_method: string;
  status: string; payment_method: string; payment_status: string; payment_collected_at: string | null; delivered_at: string | null; updated_at: string;
  subtotal: number | string; shipping_amount: number | string; tax_amount: number | string; total_amount: number | string;
  order_items: OrderItem[]; order_status_events: OrderEvent[]; shipments: Shipment | Shipment[] | null; return_requests: ReturnRequest | ReturnRequest[] | null;
};
function statusLabel(status: string) { return ORDER_STEPS.find((step) => step.value === status)?.label ?? (status === 'cancelled' ? 'Cancelled' : status.replaceAll('_', ' ')); }
function asShipment(value: OrderRecord['shipments']): Shipment | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function asReturn(value: OrderRecord['return_requests']): ReturnRequest | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }

function OrdersContent() {
  const userId = useShopStore((state) => state.user?.id);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [returnTarget, setReturnTarget] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('damaged');
  const [returnDescription, setReturnDescription] = useState('');

  const loadOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' });
      const payload = await response.json() as { orders?: OrderRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not load your orders.');
      setOrders(payload.orders ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load your orders.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    setSelectedId(new URLSearchParams(window.location.search).get('id'));
    void loadOrders();
    if (!userId || !isDatabaseReady()) return;
    const database = createClient();
    const channel = database.channel(`shopsphere-customer-orders-${userId}`)
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, () => { void loadOrders(true); })
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'shipments' }, () => { void loadOrders(true); })
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'return_requests', filter: `user_id=eq.${userId}` }, () => { void loadOrders(true); })
      .subscribe();
    return () => { void database.removeChannel(channel); };
  }, [loadOrders, userId]);

  const visibleOrders = useMemo(() => !selectedId ? orders : orders.filter((order) => order.id === selectedId || order.order_number === selectedId), [orders, selectedId]);

  async function cancelOrder(order: OrderRecord) {
    if (!window.confirm(`Cancel order ${order.order_number}? Stock will be returned to inventory.`)) return;
    setBusyOrder(order.id); setNotice(''); setError('');
    try {
      const response = await fetch(`/api/orders/${order.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Cancelled by customer from My Orders.' }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not cancel this order.');
      setNotice(`Order ${order.order_number} was cancelled.`); await loadOrders(true);
    } catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel this order.'); }
    finally { setBusyOrder(null); }
  }

  async function submitReturn(order: OrderRecord) {
    if (returnDescription.trim().length < 10) { setError('Describe the issue in at least 10 characters.'); return; }
    setBusyOrder(order.id); setNotice(''); setError('');
    try {
      const response = await fetch('/api/returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, reason: returnReason, description: returnDescription.trim() }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not submit your return request.');
      setNotice(`Return request submitted for ${order.order_number}.`); setReturnTarget(null); setReturnDescription(''); await loadOrders(true);
    } catch (returnError) { setError(returnError instanceof Error ? returnError.message : 'Could not submit your return request.'); }
    finally { setBusyOrder(null); }
  }

  return <PageShell>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-moss">Your purchases</p><h1 className="mt-2 text-3xl font-semibold">Orders & tracking</h1><p className="mt-2 text-sm text-ink/55">Track courier details, delivery events, receipts and return requests.</p></div><div className="flex gap-2"><Link href="/notifications" className="pill-button border border-ink/10"><Bell size={14}/> Notifications</Link><button type="button" onClick={() => void loadOrders(true)} disabled={refreshing} className="pill-button border border-ink/10"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}/> Refresh</button></div></div>
    {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading && <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-6 text-sm text-ink/55">Loading your order history…</div>}
    {error && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    {!loading && !error && visibleOrders.length === 0 && <div className="mt-8"><EmptyState title={selectedId ? 'Order not found' : 'No orders yet'} message={selectedId ? 'This order does not exist or does not belong to your account.' : 'When you place an order, its details and fulfilment history will appear here.'}/><div className="mt-4 text-center"><Link href="/#shop" className="text-sm font-semibold text-moss underline underline-offset-4">Explore products</Link></div></div>}
    {!loading && !error && visibleOrders.length > 0 && <div className="mt-8 space-y-5">{visibleOrders.map((order) => {
      const cancelled = order.status === 'cancelled';
      const stepIndex = ORDER_STEPS.findIndex((step) => step.value === order.status);
      const events = [...(order.order_status_events ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const shipment = asShipment(order.shipments);
      const returnRequest = asReturn(order.return_requests);
      const address = [order.address_line1, order.address_line2, order.city, order.state, order.pincode].filter(Boolean).join(', ');
      const cancelAllowed = ['order_placed', 'confirmed', 'packed'].includes(order.status);
      const deliveredEventAt = events.find((event) => event.status === 'delivered')?.created_at;
      const canRequestThisOrderReturn = canRequestReturn({ status: order.status, hasExistingRequest: Boolean(returnRequest), deliveredAt: order.delivered_at ?? deliveredEventAt ?? order.updated_at });
      return <article key={order.id} className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-moss">Order reference</p><h2 className="mt-1 text-lg font-bold">{order.order_number}</h2><p className="mt-1 text-xs text-ink/45">Placed {new Date(order.placed_at).toLocaleString('en-IN')}</p></div><div className="text-right"><p className="text-lg font-bold">{formatPrice(Number(order.total_amount))}</p><span className={`mt-1 inline-block rounded-full px-3 py-1 text-[10px] font-semibold ${cancelled ? 'bg-rose-50 text-rose-700' : 'bg-sage text-moss'}`}>{statusLabel(order.status)}</span></div></div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">{(order.order_items ?? []).map((item) => <div key={item.id} className="flex gap-2 rounded-xl bg-cream p-2"><ProductImage src={item.product_image} productId={item.product_id} alt={item.product_name} className="h-12 w-12 rounded-lg object-cover"/><div className="min-w-0"><p className="line-clamp-2 text-[10px] font-semibold">{item.product_name}</p><p className="mt-1 text-[10px] text-ink/45">Qty {item.quantity} · {formatPrice(Number(item.line_total))}</p></div></div>)}</div>
        <div className="mt-7"><div className="flex items-center justify-between"><h3 className="font-semibold">Order progress</h3><span className="text-xs text-ink/50">{cancelled ? 'Cancelled' : `${Math.max(0, stepIndex + 1)} of ${ORDER_STEPS.length}`}</span></div>{!cancelled && <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-moss transition-all" style={{ width: `${Math.max(0, stepIndex) / (ORDER_STEPS.length - 1) * 100}%` }}/></div>}<div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{ORDER_STEPS.map((step, index) => { const event = events.find((entry) => entry.status === step.value); const complete = !cancelled && index <= stepIndex; const Icon = index === 3 || index === 4 ? Truck : index === 2 ? Package : index === 5 ? CheckCircle2 : Clock3; return <div key={step.value} className="flex gap-2"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${complete ? 'bg-lime text-ink' : 'bg-ink/5 text-ink/30'}`}><Icon size={14}/></span><div><p className={`text-[11px] font-semibold ${complete ? '' : 'text-ink/40'}`}>{step.label}</p><p className="mt-1 text-[9px] text-ink/40">{event ? new Date(event.created_at).toLocaleDateString('en-IN') : 'Pending'}</p></div></div>; })}</div>{cancelled && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">This order was cancelled. Reserved inventory was returned to stock.</p>}</div>
        {shipment && <section className="mt-6 rounded-xl border border-moss/20 bg-sage/30 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-moss">Shipment tracking</p><h3 className="mt-1 font-semibold">{shipment.carrier}</h3><p className="mt-1 text-xs text-ink/55">Tracking number: <b>{shipment.tracking_number}</b></p>{shipment.estimated_delivery_at && <p className="mt-1 text-xs text-ink/55">Estimated delivery: {shipment.estimated_delivery_at}</p>}</div>{shipment.tracking_url && <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="pill-button bg-ink text-white">Open courier tracking <Truck size={13}/></a>}</div>{shipment.shipment_events?.length > 0 && <div className="mt-4 space-y-3 border-t border-ink/10 pt-3">{[...shipment.shipment_events].sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime()).map((event) => <div key={event.id} className="flex items-start gap-2"><CheckCircle2 size={13} className="mt-0.5 text-moss"/><div><p className="text-xs font-semibold">{event.event_title}</p><p className="mt-0.5 text-[10px] text-ink/50">{[event.location, new Date(event.event_at).toLocaleString('en-IN')].filter(Boolean).join(' · ')}</p>{event.event_description && <p className="mt-1 text-[10px] text-ink/55">{event.event_description}</p>}</div></div>)}</div>}<p className="mt-3 text-[10px] text-ink/45">Tracking updates are provided by the store unless an external courier tracking page is linked.</p></section>}
        <div className="mt-5 grid gap-3 border-t border-ink/10 pt-4 text-xs sm:grid-cols-2"><div><p className="text-ink/45">Delivery address</p><p className="mt-1 leading-5">{address}</p></div><div><p className="text-ink/45">Payment</p><p className="mt-1">Cash on delivery · {order.payment_status === 'pending' ? 'Payment due on delivery' : order.payment_status === 'paid' ? `Cash collected${order.payment_collected_at ? ` on ${new Date(order.payment_collected_at).toLocaleDateString('en-IN')}` : ''}` : order.payment_status}</p><p className="mt-1 text-ink/45">{order.delivery_method === 'express' ? 'Express' : 'Standard'} delivery</p></div></div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-ink/10 pt-4"><Link href={`/invoices/${order.id}`} className="pill-button border border-ink/10"><FileText size={14}/> Print order receipt</Link>{cancelAllowed && <button type="button" disabled={busyOrder === order.id} onClick={() => void cancelOrder(order)} className="pill-button border border-rose-200 text-rose-700">{busyOrder === order.id ? 'Cancelling…' : 'Cancel order'}</button>}{canRequestThisOrderReturn && <button type="button" onClick={() => setReturnTarget(returnTarget === order.id ? null : order.id)} className="pill-button border border-ink/10">Request a return</button>}</div>
        {returnRequest && <div className="mt-4 rounded-xl bg-cream p-4 text-xs"><p className="font-bold">Return request · {returnRequest.status.replaceAll('_', ' ')}</p><p className="mt-1 text-ink/55">Reason: {returnRequest.reason.replaceAll('_', ' ')} · Refund: {returnRequest.refund_status.replaceAll('_', ' ')}</p>{returnRequest.admin_note && <p className="mt-2 text-ink/55">Store note: {returnRequest.admin_note}</p>}</div>}
        {returnTarget === order.id && <form onSubmit={(event) => { event.preventDefault(); void submitReturn(order); }} className="mt-4 rounded-xl border border-ink/10 p-4"><h3 className="font-semibold">Request a return</h3><p className="mt-1 text-[10px] text-ink/50">Returns are available for seven days after delivery, subject to the store&apos;s return policy.</p><label className="mt-3 block text-xs font-semibold">Reason<select value={returnReason} onChange={(event) => setReturnReason(event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/10 bg-white px-3 py-2.5 text-xs">{[['damaged','Damaged item'],['defective','Defective item'],['wrong_item','Wrong item received'],['missing_item','Missing item'],['not_as_described','Not as described'],['other','Other']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-3 block text-xs font-semibold">Describe the issue<textarea required minLength={10} maxLength={1200} value={returnDescription} onChange={(event) => setReturnDescription(event.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-ink/10 px-3 py-2.5 text-xs" placeholder="Explain what happened (10–1,200 characters)."/></label><div className="mt-3 flex gap-2"><button disabled={busyOrder === order.id} className="pill-button bg-ink text-white">{busyOrder === order.id ? 'Submitting…' : 'Submit return request'}</button><button type="button" onClick={() => setReturnTarget(null)} className="pill-button border border-ink/10">Close</button></div></form>}
      </article>;
    })}</div>}
  </PageShell>;
}
export default function OrdersPage() { return <RequireAuth><OrdersContent/></RequireAuth>; }
