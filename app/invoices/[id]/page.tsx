import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/database/server';
import { formatPrice } from '@/lib/products';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

type InvoicePageProps = { params: Promise<{ id: string }> };
export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const database = await createClient();
  const { data: { user }, error: authError } = await database.auth.getUser();
  if (authError || !user) redirect(`/login?next=${encodeURIComponent(`/invoices/${id}`)}`);
  const { data: order, error } = await database.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  if (error || !order) notFound();
  const storeName = process.env.NEXT_PUBLIC_STORE_NAME || 'ShopSphere AI';
  const supportEmail = process.env.NEXT_PUBLIC_STORE_SUPPORT_EMAIL || '';
  const supportPhone = process.env.NEXT_PUBLIC_STORE_SUPPORT_PHONE || '';
  const storeAddress = process.env.NEXT_PUBLIC_STORE_ADDRESS || '';
  const address = [order.address_line1, order.address_line2, order.city, order.state, order.pincode].filter(Boolean).join(', ');
  const items = (order.order_items ?? []) as Array<{ id: string; product_name: string; product_category: string; unit_price: number | string; quantity: number; line_total: number | string }>;

  return <main className="min-h-screen bg-[#f5f6f3] px-4 py-8 text-ink print:bg-white print:p-0">
    <div className="no-print mx-auto mb-5 flex max-w-3xl items-center justify-between gap-3"><Link href="/orders" className="text-xs font-semibold text-moss underline underline-offset-4">← Back to orders</Link><PrintButton/></div>
    <article className="mx-auto max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-ink/10 pb-6"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-moss">{storeName}</p><h1 className="mt-2 text-2xl font-semibold">Order receipt</h1><p className="mt-1 text-xs text-ink/50">This is an order receipt, not a GST tax invoice.</p>{storeAddress && <p className="mt-3 max-w-xs text-xs leading-5 text-ink/55">{storeAddress}</p>}</div><div className="text-right"><p className="text-[10px] uppercase tracking-widest text-ink/45">Receipt reference</p><p className="mt-1 font-bold">{order.invoice_number || `SS-INV-${String(order.order_number).replace(/[^A-Za-z0-9]/g, '')}`}</p><p className="mt-3 text-[10px] uppercase tracking-widest text-ink/45">Order number</p><p className="mt-1 font-semibold">{order.order_number}</p><p className="mt-2 text-xs text-ink/50">{new Date(order.placed_at).toLocaleDateString('en-IN')}</p></div></div>
      <div className="grid gap-5 border-b border-ink/10 py-6 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-widest text-ink/45">Billed to</p><p className="mt-2 text-sm font-semibold">{order.customer_name}</p><p className="mt-1 text-xs text-ink/55">{order.customer_email}</p><p className="mt-1 text-xs text-ink/55">{order.customer_phone}</p></div><div><p className="text-[10px] font-bold uppercase tracking-widest text-ink/45">Delivered to</p><p className="mt-2 text-xs leading-5 text-ink/65">{address}</p></div></div>
      <div className="overflow-x-auto py-6"><table className="w-full min-w-[480px] text-left text-xs"><thead><tr className="border-b border-ink/10 text-[10px] uppercase tracking-widest text-ink/45"><th className="pb-3">Item</th><th className="pb-3 text-right">Unit price</th><th className="pb-3 text-right">Qty</th><th className="pb-3 text-right">Amount</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-ink/5"><td className="py-3 pr-3"><p className="font-semibold">{item.product_name}</p><p className="mt-1 text-[10px] text-ink/45">{item.product_category}</p></td><td className="py-3 text-right">{formatPrice(Number(item.unit_price))}</td><td className="py-3 text-right">{item.quantity}</td><td className="py-3 text-right font-semibold">{formatPrice(Number(item.line_total))}</td></tr>)}</tbody></table></div>
      <div className="ml-auto max-w-xs space-y-2 border-t border-ink/10 pt-5 text-xs"><p className="flex justify-between"><span className="text-ink/55">Subtotal</span><b>{formatPrice(Number(order.subtotal))}</b></p><p className="flex justify-between"><span className="text-ink/55">Shipping</span><b>{Number(order.shipping_amount) === 0 ? 'Free' : formatPrice(Number(order.shipping_amount))}</b></p><p className="flex justify-between"><span className="text-ink/55">Tax recorded</span><b>{formatPrice(Number(order.tax_amount))}</b></p><p className="flex justify-between border-t border-ink/10 pt-3 text-base"><span className="font-semibold">Total</span><b>{formatPrice(Number(order.total_amount))}</b></p></div>
      <div className="mt-7 rounded-xl bg-sage/30 p-4 text-xs"><p className="font-semibold">Payment: Cash on Delivery</p><p className="mt-1 text-ink/55">{order.payment_status === 'paid' ? 'Cash collection has been recorded by the store.' : 'Payment is due to the delivery partner when the order is delivered.'}</p><p className="mt-2 text-ink/55">Order status: {String(order.status).replaceAll('_', ' ')}</p></div>
      <div className="mt-8 border-t border-ink/10 pt-5 text-[10px] leading-5 text-ink/45"><p>Thank you for shopping with {storeName}.</p>{supportEmail && <p>Support: {supportEmail}</p>}{supportPhone && <p>Phone: {supportPhone}</p>}<p className="mt-2">Tax amounts are shown as recorded in the order system. Configure applicable GST registration and tax rules before using this receipt as a statutory tax invoice.</p></div>
    </article>
    <style>{`@media print { @page { margin: 14mm; } body { background: #fff !important; } .no-print { display: none !important; } }`}</style>
  </main>;
}
