'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, MapPin, PackageCheck } from 'lucide-react';
import PageShell from '@/components/PageShell';
import ProductImage from '@/components/ProductImage';
import RequireAuth from '@/components/RequireAuth';
import { formatPrice } from '@/lib/products';
import { useProducts } from '@/hooks/useProducts';
import { useShopStore } from '@/store/shopStore';
import { showOrderPlacedToast } from '@/lib/shopToasts';

type CheckoutForm = { name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string };
type CreatedOrder = { id: string; order_number: string; status: string; subtotal: number | string; shipping_amount: number | string; tax_amount: number | string; total_amount: number | string; payment_status: string; payment_method: 'cod' };
const initialForm: CheckoutForm = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

function CheckoutContent() {
  const cart = useShopStore((state) => state.cart);
  const user = useShopStore((state) => state.user);
  const clearCart = useShopStore((state) => state.clearCart);
  const { products, isLoading: productsLoading, dataSource, fallbackNotice } = useProducts();
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [step, setStep] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const requestId = useRef<string | null>(null);
  const requestStorageKey = user?.id ? `shopsphere:checkout-request:${user.id}` : null;

  useEffect(() => {
    if (!requestStorageKey) { requestId.current = null; return; }
    try {
      const saved = window.sessionStorage.getItem(requestStorageKey);
      requestId.current = saved && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved) ? saved : null;
    } catch { requestId.current = null; }
  }, [requestStorageKey]);

  useEffect(() => {
    if (user?.name) setForm((current) => ({ ...current, name: current.name || user.name }));
  }, [user?.name]);

  const items = useMemo(() => Object.entries(cart).map(([productId, quantity]) => ({
    product: products.find((product) => product.id === productId), productId, quantity,
  })), [cart, products]);
  const missingItems = items.filter((item) => !item.product);
  const quantityLimitExceeded = items.some((item) => item.quantity > 20);
  const validItems = items.filter((item): item is typeof item & { product: NonNullable<typeof item.product> } => Boolean(item.product));
  const subtotal = validItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingEstimate = deliveryMethod === 'express' ? 199 : subtotal >= 1999 ? 0 : 99;
  const canUseLiveCatalogue = dataSource === 'sqlite';

  function updateForm(field: keyof CheckoutForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function validateStep(): string {
    if (step === 1) {
      if (form.name.trim().length < 2) return 'Enter your full name.';
      if (!/^\d{10}$/.test(form.phone.trim())) return 'Enter a valid 10-digit phone number.';
    }
    if (step === 2) {
      if (form.line1.trim().length < 5) return 'Enter your complete delivery address.';
      if (form.city.trim().length < 2 || form.state.trim().length < 2) return 'Enter your city and state.';
      if (!/^\d{6}$/.test(form.pincode.trim())) return 'Enter a valid 6-digit PIN code.';
    }
    return '';
  }
  function continueStep() {
    setError('');
    const validation = validateStep();
    if (validation) { setError(validation); return; }
    setStep((current) => Math.min(4, current + 1));
  }
  function clearCheckoutAttempt() {
    if (requestStorageKey) { try { window.sessionStorage.removeItem(requestStorageKey); } catch { /* Storage is optional. */ } }
    requestId.current = null;
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!Object.keys(cart).length) { setError('Your cart is empty. Add products before checking out.'); return; }
    if (missingItems.length) { setError('Some cart products are no longer in the catalogue. Remove them and try again.'); return; }
    if (quantityLimitExceeded) { setError('The maximum quantity is 20 units per product. Update your cart and try again.'); return; }
    if (!canUseLiveCatalogue) { setError(fallbackNotice || 'The SQLite catalogue is unavailable. Restart the application and reload checkout before placing an order.'); return; }

    if (!requestId.current) {
      requestId.current = crypto.randomUUID();
      if (requestStorageKey) { try { window.sessionStorage.setItem(requestStorageKey, requestId.current); } catch { /* In-memory idempotency remains active. */ } }
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutRequestId: requestId.current,
          items: validItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          customerName: form.name.trim(), customerPhone: form.phone.trim(),
          addressLine1: form.line1.trim(), addressLine2: form.line2.trim(),
          city: form.city.trim(), state: form.state.trim(), pincode: form.pincode.trim(), deliveryMethod,
          paymentMethod: 'cod',
        }),
      });
      const payload = await response.json() as { order?: CreatedOrder; error?: string };
      if (!response.ok || !payload.order) throw new Error(payload.error || 'Could not place your order.');
      setCreatedOrder({ ...payload.order, payment_method: 'cod' });
      showOrderPlacedToast({
        id: payload.order.id,
        order_number: payload.order.order_number,
        total_amount: payload.order.total_amount,
      });
      clearCheckoutAttempt();
      clearCart();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Something went wrong while placing your order.');
    } finally { setSubmitting(false); }
  }

  if (createdOrder) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-ink/10 bg-white p-8 text-center sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lime text-ink"><CheckCircle2 size={30}/></div>
        <p className="eyebrow mt-5 text-moss">Cash-on-delivery order saved</p>
        <h1 className="mt-2 text-3xl font-semibold">Thank you for your order.</h1>
        <p className="mt-3 text-sm text-ink/55">Your order is saved in ShopSphere. Pay the delivery partner in cash when your order arrives.</p>
        <div className="mt-6 rounded-2xl bg-sage/50 p-4 text-left text-sm">
          <p className="flex justify-between gap-3"><span>Order number</span><b>{createdOrder.order_number}</b></p>
          <p className="mt-2 flex justify-between gap-3"><span>Total to pay on delivery</span><b>{formatPrice(Number(createdOrder.total_amount))}</b></p>
          <p className="mt-2 flex justify-between gap-3"><span>Payment status</span><b>Pending · Cash on Delivery</b></p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href={`/orders?id=${createdOrder.id}`} className="pill-button bg-ink text-white">Track your order</Link><Link href="/" className="pill-button border border-ink/10">Continue shopping</Link></div>
      </div>
    );
  }

  if (productsLoading) return <div className="rounded-2xl border border-ink/10 bg-white p-8 text-sm text-ink/55">Loading live product prices and stock…</div>;

  return (
    <>
      <p className="eyebrow text-moss">Secure, server-validated checkout</p>
      <h1 className="mt-2 text-3xl font-semibold">Checkout</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink/55">ShopSphere currently supports Cash on Delivery. Prices, stock and the final order total are validated transactionally by SQLite.</p>
      {!canUseLiveCatalogue && <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><b>Live catalogue required.</b> {fallbackNotice || 'Checkout is paused because the SQLite catalogue is unavailable.'} Reconnect and reload checkout before ordering.</div>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-7">
          <div className="grid grid-cols-4 gap-2">{['Details', 'Address', 'Delivery', 'Review'].map((label, index) => <div key={label}><div className={`h-1.5 rounded-full ${step >= index + 1 ? 'bg-moss' : 'bg-ink/10'}`}/><p className={`mt-2 text-[10px] ${step === index + 1 ? 'font-bold' : 'text-ink/45'}`}>{index + 1}. {label}</p></div>)}</div>
          {step === 1 && <div className="mt-7 space-y-4"><h2 className="text-xl font-semibold">Customer information</h2><label className="block text-xs font-semibold">Full name<input required autoComplete="name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm"/></label><label className="block text-xs font-semibold">Account email<input readOnly value={user?.email || ''} className="mt-2 w-full rounded-xl border border-ink/10 bg-slate-50 px-4 py-3 text-sm text-ink/55"/></label><label className="block text-xs font-semibold">10-digit phone number<input required inputMode="numeric" maxLength={10} autoComplete="tel" value={form.phone} onChange={(event) => updateForm('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm"/></label></div>}
          {step === 2 && <div className="mt-7 space-y-4"><h2 className="text-xl font-semibold">Delivery address</h2><label className="block text-xs font-semibold">Address line<input required autoComplete="address-line1" value={form.line1} onChange={(event) => updateForm('line1', event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm"/></label><label className="block text-xs font-semibold">Apartment / landmark (optional)<input autoComplete="address-line2" value={form.line2} onChange={(event) => updateForm('line2', event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold">City<input required autoComplete="address-level2" value={form.city} onChange={(event) => updateForm('city', event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm"/></label><label className="block text-xs font-semibold">State<input required autoComplete="address-level1" value={form.state} onChange={(event) => updateForm('state', event.target.value)} className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm"/></label></div><label className="block text-xs font-semibold">6-digit PIN code<input required inputMode="numeric" maxLength={6} autoComplete="postal-code" value={form.pincode} onChange={(event) => updateForm('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm"/></label></div>}
          {step === 3 && <div className="mt-7 space-y-3"><h2 className="text-xl font-semibold">Choose delivery</h2><label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${deliveryMethod === 'standard' ? 'border-moss bg-sage/40' : 'border-ink/10'}`}><span className="flex items-center gap-3"><input type="radio" name="delivery" checked={deliveryMethod === 'standard'} onChange={() => setDeliveryMethod('standard')}/><span><b className="block text-sm">Standard delivery</b><span className="text-xs text-ink/50">The store will confirm the estimated delivery date.</span></span></span><b className="text-sm">{subtotal >= 1999 ? 'Free' : formatPrice(99)}</b></label><label className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${deliveryMethod === 'express' ? 'border-moss bg-sage/40' : 'border-ink/10'}`}><span className="flex items-center gap-3"><input type="radio" name="delivery" checked={deliveryMethod === 'express'} onChange={() => setDeliveryMethod('express')}/><span><b className="block text-sm">Express delivery</b><span className="text-xs text-ink/50">Priority processing where available.</span></span></span><b className="text-sm">{formatPrice(199)}</b></label></div>}
          {step === 4 && <form onSubmit={placeOrder} className="mt-7 space-y-4"><h2 className="text-xl font-semibold">Review and place order</h2><div className="rounded-xl border border-ink/10 p-4 text-sm"><p className="font-semibold">Deliver to {form.name}</p><p className="mt-1 text-xs leading-5 text-ink/55">{[form.line1, form.line2, form.city, form.state, form.pincode].filter(Boolean).join(', ')}</p><p className="mt-2 text-xs text-ink/55">{form.phone} · {user?.email}</p></div><div className="rounded-xl border border-moss/30 bg-sage/30 p-4"><div className="flex items-center gap-3"><PackageCheck className="text-moss"/><div><p className="text-sm font-semibold">Cash on Delivery</p><p className="mt-1 text-xs text-ink/55">Pay the delivery partner in cash when your order arrives. No online payment gateway is used.</p></div></div></div>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<div className="flex items-center justify-between gap-3"><button type="button" onClick={() => setStep(3)} className="text-xs font-semibold text-ink/55">Back</button><button type="submit" disabled={submitting || !canUseLiveCatalogue || validItems.length === 0 || missingItems.length > 0 || quantityLimitExceeded} className="pill-button bg-ink text-white disabled:opacity-50">{submitting ? 'Placing your COD order…' : 'Place COD order'}</button></div></form>}
          {step < 4 && <div className="mt-7 flex items-center justify-between"><button type="button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))} className="text-xs font-semibold text-ink/50 disabled:opacity-30">Back</button><button type="button" onClick={continueStep} className="pill-button bg-ink text-white">Continue</button></div>}
          {error && step !== 4 && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        </section>
        <aside className="h-fit rounded-2xl border border-ink/10 bg-white p-5"><h2 className="font-semibold">Order summary</h2><div className="mt-4 space-y-3">{validItems.map((item) => <div key={item.productId} className="flex items-center gap-3"><ProductImage src={item.product.image} productId={item.product.id} alt={item.product.name} className="h-12 w-12 rounded-lg bg-cream object-cover"/><div className="min-w-0 flex-1"><p className="line-clamp-2 text-xs font-semibold">{item.product.name}</p><p className="text-[10px] text-ink/45">Qty {item.quantity}</p></div><b className="text-xs">{formatPrice(item.product.price * item.quantity)}</b></div>)}</div><div className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-xs"><p className="flex justify-between"><span className="text-ink/55">Subtotal</span><b>{formatPrice(subtotal)}</b></p><p className="flex justify-between"><span className="text-ink/55">Shipping estimate</span><b>{shippingEstimate ? formatPrice(shippingEstimate) : 'Free'}</b></p><p className="flex justify-between"><span className="text-ink/55">Tax</span><b>{formatPrice(0)} · not configured</b></p><p className="flex justify-between border-t border-ink/10 pt-3 text-sm"><span className="font-semibold">Estimated total</span><b>{formatPrice(subtotal + shippingEstimate)}</b></p><p className="pt-2 text-[10px] leading-5 text-ink/45">The final total and available stock are recalculated by the database when you place the order.</p></div></aside>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-ink/45"><MapPin size={14}/> Delivery updates will appear in My Orders and in your ShopSphere notifications.</p>
    </>
  );
}

export default function CheckoutPage() { return <PageShell><RequireAuth><CheckoutContent/></RequireAuth></PageShell>; }
