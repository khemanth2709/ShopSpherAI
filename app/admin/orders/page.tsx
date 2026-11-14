'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ClipboardList, Package, RefreshCw, Truck } from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import ProductImage from '@/components/ProductImage';
import { formatPrice } from '@/lib/products';
import { createClient, isDatabaseReady } from '@/lib/database/client';
import { canCancelOrder, canConfirmCodCollection, NEXT_ORDER_STATUS, ORDER_STATUS_LABELS } from '@/lib/orderWorkflow';

type OrderItem = { id: string; product_id?: string | null; product_name: string; product_image: string; quantity: number; unit_price: number | string; line_total: number | string };
type OrderEvent = { id: string; status: string; note: string | null; created_at: string };
type ShipmentEvent = { id: string; event_title: string; event_description: string | null; location: string | null; event_at: string };
type Shipment = { id: string; carrier: string; tracking_number: string; tracking_url: string | null; estimated_delivery_at: string | null; shipment_events: ShipmentEvent[] };
type AdminOrder = {
  id: string; order_number: string; placed_at: string; customer_name: string; customer_email: string; customer_phone: string;
  address_line1: string; address_line2: string | null; city: string; state: string; pincode: string; delivery_method: string;
  status: string; payment_method: string; payment_status: string; payment_collected_at: string | null;
  subtotal: number | string; shipping_amount: number | string; tax_amount: number | string; total_amount: number | string;
  order_items: OrderItem[]; order_status_events: OrderEvent[]; shipments: Shipment[] | Shipment | null;
};
type ShipmentForm = { carrier: string; trackingNumber: string; trackingUrl: string; estimatedDeliveryAt: string; note: string };
const emptyShipment: ShipmentForm = { carrier: '', trackingNumber: '', trackingUrl: '', estimatedDeliveryAt: '', note: '' };
function getShipment(order: AdminOrder): Shipment | null { return Array.isArray(order.shipments) ? order.shipments[0] ?? null : order.shipments ?? null; }

function AdminOrdersContent() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [forms, setForms] = useState<Record<string, ShipmentForm>>({});
  const [eventForms, setEventForms] = useState<Record<string, { title: string; description: string; location: string }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const loadOrders = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/orders', { cache: 'no-store' });
      const payload = await response.json() as { orders?: AdminOrder[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not load store orders.');
      const nextOrders = payload.orders ?? [];
      setOrders(nextOrders);
      setForms((current) => {
        const next = { ...current };
        for (const order of nextOrders) {
          const shipment = getShipment(order);
          if (shipment && !next[order.id]) next[order.id] = {
            carrier: shipment.carrier, trackingNumber: shipment.tracking_number, trackingUrl: shipment.tracking_url ?? '',
            estimatedDeliveryAt: shipment.estimated_delivery_at ?? '', note: '',
          };
        }
        return next;
      });
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load store orders.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    void loadOrders();
    if (!isDatabaseReady()) return;
    const database = createClient();
    const channel = database.channel('shopsphere-admin-cod-orders')
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void loadOrders(true); })
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'order_status_events' }, () => { void loadOrders(true); })
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'shipments' }, () => { void loadOrders(true); })
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'return_requests' }, () => { void loadOrders(true); })
      .subscribe();
    return () => { void database.removeChannel(channel); };
  }, [loadOrders]);

  const summary = useMemo(() => ({
    total: orders.length,
    active: orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
    delivered: orders.filter((order) => order.status === 'delivered').length,
    cancelled: orders.filter((order) => order.status === 'cancelled').length,
    codDue: orders.filter((order) => order.payment_method === 'cod' && order.payment_status === 'pending' && order.status !== 'cancelled').reduce((sum, order) => sum + Number(order.total_amount), 0),
  }), [orders]);

  async function updateStatus(order: AdminOrder, status: string) {
    if (status === 'shipped' && !getShipment(order)) { setError('Save courier and tracking details before marking this order shipped.'); return; }
    if (status === 'cancelled' && !window.confirm(`Cancel ${order.order_number}? Reserved stock will be restored.`)) return;
    setBusyOrder(order.id); setNotice(''); setError('');
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not update this order.');
      setNotice(`${order.order_number} updated to ${ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]}.`);
      await loadOrders(true);
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : 'Could not update this order.'); }
    finally { setBusyOrder(null); }
  }

  async function saveShipment(order: AdminOrder) {
    const form = forms[order.id] ?? emptyShipment;
    if (!form.carrier.trim() || !form.trackingNumber.trim()) { setError('Enter both courier name and tracking number.'); return; }
    setBusyOrder(order.id); setNotice(''); setError('');
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/shipment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier: form.carrier, trackingNumber: form.trackingNumber, trackingUrl: form.trackingUrl || null, estimatedDeliveryAt: form.estimatedDeliveryAt || null, note: form.note }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not save tracking details.');
      setNotice(`Tracking details saved for ${order.order_number}.`);
      await loadOrders(true);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save tracking details.'); }
    finally { setBusyOrder(null); }
  }

  async function addShipmentEvent(order: AdminOrder) {
    const form = eventForms[order.id] ?? { title: '', description: '', location: '' };
    if (!form.title.trim()) { setError('Enter a tracking update title.'); return; }
    setBusyOrder(order.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/shipment`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not add the tracking update.');
      setEventForms((current) => ({ ...current, [order.id]: { title: '', description: '', location: '' } }));
      setNotice(`Tracking update added for ${order.order_number}.`);
      await loadOrders(true);
    } catch (eventError) { setError(eventError instanceof Error ? eventError.message : 'Could not add tracking update.'); }
    finally { setBusyOrder(null); }
  }

  async function confirmCodCollected(order: AdminOrder) {
    if (!window.confirm(`Confirm that cash was actually collected for ${order.order_number}? Only confirm after receiving the cash.`)) return;
    setBusyOrder(order.id); setNotice(''); setError('');
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/cash-collection`, { method: 'POST' });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not record the COD payment.');
      setNotice(`COD payment recorded for ${order.order_number}.`);
      await loadOrders(true);
    } catch (paymentError) { setError(paymentError instanceof Error ? paymentError.message : 'Could not record the COD payment.'); }
    finally { setBusyOrder(null); }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f3] text-ink">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-black/[.06] bg-white/90 px-4 backdrop-blur-lg sm:px-7">
        <div><p className="text-xs text-black/45">Workspace / Orders</p><h1 className="mt-0.5 text-base font-bold">Order and delivery management</h1></div>
        <button type="button" onClick={() => void loadOrders(true)} disabled={refreshing} className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/> Refresh</button>
      </header>
      <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 lg:px-9">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-moss"><ArrowLeft size={14}/> Back to store overview</Link><div className="flex flex-wrap gap-2"><Link href="/admin/returns" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold">Return requests</Link><Link href="/admin/analytics" className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold">Store analytics</Link></div></div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-moss">database · COD operations</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Customer orders</h2><p className="mt-2 text-sm text-black/50">Manage fulfilment, courier references, tracking updates and cash collection.</p></div><span className="rounded-full bg-white px-4 py-2 text-xs font-semibold">Cash on Delivery only</span></div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5">{[['All orders', summary.total], ['In progress', summary.active], ['Delivered', summary.delivered], ['Cancelled', summary.cancelled], ['COD due', formatPrice(summary.codDue)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-black/[.06] bg-white p-4"><p className="text-xs text-black/50">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
        {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
        {loading && <div className="mt-6 rounded-2xl border border-black/[.06] bg-white p-6 text-sm text-black/50">Loading orders from database…</div>}
        {!loading && !error && orders.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center"><Package className="mx-auto text-black/30" size={28}/><h3 className="mt-3 font-semibold">No orders yet</h3><p className="mt-2 text-xs text-black/50">Orders placed by signed-in customers appear here.</p></div>}
        {!loading && orders.length > 0 && <div className="mt-6 space-y-4">{orders.map((order) => {
          const next = NEXT_ORDER_STATUS[order.status as keyof typeof NEXT_ORDER_STATUS] ?? null;
          const shipment = getShipment(order);
          const address = [order.address_line1, order.address_line2, order.city, order.state, order.pincode].filter(Boolean).join(', ');
          const events = [...(order.order_status_events ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          const shipmentForm = forms[order.id] ?? (shipment ? { carrier: shipment.carrier, trackingNumber: shipment.tracking_number, trackingUrl: shipment.tracking_url ?? '', estimatedDeliveryAt: shipment.estimated_delivery_at ?? '', note: '' } : emptyShipment);
          const eventForm = eventForms[order.id] ?? { title: '', description: '', location: '' };
          return <article key={order.id} className="rounded-2xl border border-black/[.06] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-widest text-moss">{order.order_number}</p><h3 className="mt-1 text-lg font-bold">{order.customer_name}</h3><p className="mt-1 text-xs text-black/50">{order.customer_email} · {order.customer_phone}</p><p className="mt-1 text-[10px] text-black/40">Placed {new Date(order.placed_at).toLocaleString('en-IN')}</p></div><div className="text-right"><p className="text-xl font-bold">{formatPrice(Number(order.total_amount))}</p><span className="mt-1 inline-block rounded-full bg-sage px-3 py-1 text-[10px] font-bold">{ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}</span><p className="mt-1 text-[10px] text-black/45">COD · {order.payment_status === 'paid' ? 'Cash collected' : 'Payment due'}</p></div></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-black/40">Items ({(order.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0)})</p><div className="mt-2 space-y-2">{(order.order_items ?? []).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#f7f8f5] p-2.5"><ProductImage src={item.product_image} productId={item.product_id} alt={item.product_name} className="h-11 w-11 rounded-lg object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.product_name}</p><p className="mt-1 text-[10px] text-black/45">Qty {item.quantity} × {formatPrice(Number(item.unit_price))}</p></div><b className="text-xs">{formatPrice(Number(item.line_total))}</b></div>)}</div><p className="mt-3 text-xs text-black/55"><b>Deliver to:</b> {address}</p><Link href={`/invoices/${order.id}`} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-moss underline underline-offset-4"><ClipboardList size={13}/> Print order receipt</Link></div>
              <div className="rounded-xl border border-black/[.06] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-black/40">Fulfilment history</p><div className="mt-3 space-y-2">{events.map((event) => <div key={event.id} className="flex items-start gap-2"><CheckCircle2 size={13} className="mt-0.5 text-moss"/><div><p className="text-[11px] font-semibold">{ORDER_STATUS_LABELS[event.status as keyof typeof ORDER_STATUS_LABELS] ?? event.status}</p><p className="text-[9px] text-black/40">{new Date(event.created_at).toLocaleString('en-IN')}</p>{event.note && <p className="mt-0.5 text-[10px] text-black/50">{event.note}</p>}</div></div>)}</div>
                {shipment && <div className="mt-4 rounded-lg bg-sage/40 p-3 text-[10px]"><p className="font-bold">{shipment.carrier} · {shipment.tracking_number}</p>{shipment.estimated_delivery_at && <p className="mt-1 text-black/55">Estimated delivery {shipment.estimated_delivery_at}</p>}{shipment.tracking_url && <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-bold text-moss underline">Open courier tracking</a>}</div>}
                {next && <button type="button" disabled={busyOrder === order.id || (next === 'shipped' && !shipment)} onClick={() => void updateStatus(order, next)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busyOrder === order.id ? 'Updating…' : `Move to ${ORDER_STATUS_LABELS[next]}`}<Truck size={13}/></button>}
                {next === 'shipped' && !shipment && <p className="mt-2 text-[10px] text-amber-700">Save courier and tracking information before shipping this order.</p>}
                {canCancelOrder(order.status) && <button type="button" disabled={busyOrder === order.id} onClick={() => void updateStatus(order, 'cancelled')} className="mt-2 w-full rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Cancel order & restore stock</button>}
                {canConfirmCodCollection({ status: order.status, paymentMethod: 'cod', paymentStatus: order.payment_status }) && <button type="button" disabled={busyOrder === order.id} onClick={() => void confirmCodCollected(order)} className="mt-3 w-full rounded-full bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">Confirm cash collected</button>}
                {order.payment_status === 'paid' && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-center text-[10px] font-semibold text-emerald-800">COD payment recorded{order.payment_collected_at ? ` · ${new Date(order.payment_collected_at).toLocaleString('en-IN')}` : ''}</p>}
              </div>
            </div>
            {order.status !== 'delivered' && order.status !== 'cancelled' && <div className="mt-5 grid gap-3 border-t border-black/[.06] pt-4 lg:grid-cols-[1fr_1fr]">
              <form onSubmit={(event) => { event.preventDefault(); void saveShipment(order); }} className="rounded-xl bg-[#f7f8f5] p-4"><h4 className="text-xs font-bold">Courier and tracking details</h4><div className="mt-3 grid gap-2 sm:grid-cols-2"><input aria-label="Courier name" placeholder="Courier (e.g. India Post)" value={shipmentForm.carrier} onChange={(event) => setForms((current) => ({ ...current, [order.id]: { ...shipmentForm, carrier: event.target.value } }))} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"/><input aria-label="Tracking number" placeholder="Tracking number" value={shipmentForm.trackingNumber} onChange={(event) => setForms((current) => ({ ...current, [order.id]: { ...shipmentForm, trackingNumber: event.target.value } }))} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"/><input aria-label="Tracking URL" type="url" placeholder="https://courier-tracking-link" value={shipmentForm.trackingUrl} onChange={(event) => setForms((current) => ({ ...current, [order.id]: { ...shipmentForm, trackingUrl: event.target.value } }))} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"/><input aria-label="Estimated delivery date" type="date" value={shipmentForm.estimatedDeliveryAt} onChange={(event) => setForms((current) => ({ ...current, [order.id]: { ...shipmentForm, estimatedDeliveryAt: event.target.value } }))} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"/></div><input aria-label="Shipment note" placeholder="Optional note" value={shipmentForm.note} onChange={(event) => setForms((current) => ({ ...current, [order.id]: { ...shipmentForm, note: event.target.value } }))} className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"/><button disabled={busyOrder === order.id} className="mt-3 rounded-full bg-moss px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busyOrder === order.id ? 'Saving…' : shipment ? 'Update tracking details' : 'Save tracking details'}</button></form>
              {shipment && <form onSubmit={(event) => { event.preventDefault(); void addShipmentEvent(order); }} className="rounded-xl bg-[#f7f8f5] p-4"><h4 className="text-xs font-bold">Add a tracking event</h4><input required placeholder="Update (e.g. Arrived at Hyderabad hub)" value={eventForm.title} onChange={(event) => setEventForms((current) => ({ ...current, [order.id]: { ...eventForm, title: event.target.value } }))} className="mt-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"/><div className="mt-2 grid gap-2 sm:grid-cols-2"><input placeholder="Location (optional)" value={eventForm.location} onChange={(event) => setEventForms((current) => ({ ...current, [order.id]: { ...eventForm, location: event.target.value } }))} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"/><input placeholder="Details (optional)" value={eventForm.description} onChange={(event) => setEventForms((current) => ({ ...current, [order.id]: { ...eventForm, description: event.target.value } }))} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs"/></div><button disabled={busyOrder === order.id} className="mt-3 rounded-full border border-black/10 px-4 py-2 text-xs font-bold disabled:opacity-50">Add tracking event</button></form>}
            </div>}
          </article>;
        })}</div>}
        <p className="mt-7 text-[10px] leading-5 text-black/40">Tracking details and events are maintained by the store. Automatic carrier scans require a courier API integration and credentials. COD is collected by the delivery partner and recorded by an administrator after confirmation.</p>
      </div>
    </main>
  );
}
export default function AdminOrdersPage() { return <RequireAuth role="admin"><AdminOrdersContent/></RequireAuth>; }
