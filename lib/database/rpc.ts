import 'server-only';
import { db, newId, nowIso } from '@/lib/database/db';
import type { LocalUser } from '@/lib/database/auth';

export class DatabaseFunctionError extends Error {
  constructor(message: string, public code = '22023') { super(message); this.name = 'DatabaseFunctionError'; }
}
function fail(message: string, code = '22023'): never { throw new DatabaseFunctionError(message, code); }
function adminOnly(user: LocalUser | null): asserts user is LocalUser {
  if (!user) fail('Sign in with an administrator account.', '28000');
  if (user.profile?.role !== 'admin') fail('Administrator access is required.', '42501');
}
type OrderRow = {
  id: string; user_id: string; order_number: string; status: string;
  payment_method: string; payment_status: string; subtotal: number | string;
  shipping_amount: number | string; tax_amount: number | string; total_amount: number | string;
  cancelled_at: string | null; delivered_at: string | null; updated_at: string;
};
type ProductRow = { id: string; name: string; category: string; image: string; price: number | string; stock: number };
type ReturnRow = {
  id: string; order_id: string; user_id: string; reason: string; description: string;
  status: string; refund_status: string; refund_amount: number | string | null;
  refund_reference: string | null; admin_note: string | null; resolved_at: string | null;
};
function notify(userId: string, orderId: string | null, type: string, title: string, message: string, href = '/orders') {
  db.prepare(`INSERT INTO customer_notifications(id,user_id,order_id,notification_type,title,message,href) VALUES(?,?,?,?,?,?,?)`)
    .run(newId(), userId, orderId, type, title, message, href);
}
function getOrder(id: string) {
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id) as OrderRow | undefined;
  if (!row) fail('Order not found.', 'P0002');
  return row;
}
function addOrderEvent(orderId: string, status: string, note: string | null, actorId: string | null) {
  db.prepare('INSERT INTO order_status_events(id,order_id,status,note,actor_id) VALUES(?,?,?,?,?)').run(newId(), orderId, status, note, actorId);
}
function restoreOrderStock(orderId: string) {
  const items = db.prepare('SELECT product_id,quantity FROM order_items WHERE order_id=? AND product_id IS NOT NULL').all(orderId) as Array<{ product_id: string; quantity: number }>;
  const update = db.prepare('UPDATE products SET stock=stock+?, updated_at=? WHERE id=?');
  for (const item of items) update.run(item.quantity, nowIso(), item.product_id);
}

export function executeRpc(name: string, args: Record<string, unknown>, user: LocalUser | null): unknown {
  if (name === 'is_shop_admin') return user?.profile?.role === 'admin';
  if (name === 'admin_adjust_product_stock') {
    adminOnly(user);
    const id = String(args.p_product_id ?? ''); const delta = Number(args.p_delta);
    if (!Number.isInteger(delta) || delta === 0) fail('Stock adjustment must be a non-zero integer.');
    const result = db.prepare('UPDATE products SET stock=MAX(0,stock+?),updated_at=? WHERE id=? AND is_active=1').run(delta, nowIso(), id);
    if (result.changes === 0) fail('Active product was not found.', 'P0002');
    return db.prepare('SELECT * FROM products WHERE id=?').get(id);
  }
  if (name === 'create_shop_order') {
    if (!user) fail('You must be signed in to place an order.', '28000');
    const requestId = String(args.p_checkout_request_id ?? '');
    const itemsInput = args.p_items;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) fail('Checkout request identifier is invalid.');
    const old = db.prepare('SELECT * FROM orders WHERE user_id=? AND checkout_request_id=?').get(user.id, requestId) as OrderRow | undefined;
    if (old) return { id: old.id, order_number: old.order_number, status: old.status, subtotal: old.subtotal, shipping_amount: old.shipping_amount, tax_amount: old.tax_amount, total_amount: old.total_amount, payment_method: old.payment_method, payment_status: old.payment_status, already_processed: true };
    const lines = Array.isArray(itemsInput) ? itemsInput as Array<{ product_id?: string; quantity?: number }> : [];
    if (!lines.length || lines.length > 30) fail('A checkout must contain between 1 and 30 product lines.');
    const customerName = String(args.p_customer_name ?? '').trim();
    const phone = String(args.p_customer_phone ?? '');
    const line1 = String(args.p_address_line1 ?? '').trim();
    const line2 = args.p_address_line2 == null ? null : String(args.p_address_line2).trim() || null;
    const city = String(args.p_city ?? '').trim(); const state = String(args.p_state ?? '').trim(); const pincode = String(args.p_pincode ?? '');
    const delivery = String(args.p_delivery_method ?? '');
    if (customerName.length < 2 || customerName.length > 100) fail('Enter a valid recipient name (2 to 100 characters).');
    if (!/^\d{10}$/.test(phone)) fail('Enter a valid 10-digit phone number.');
    if (line1.length < 5 || line1.length > 200 || (line2 && line2.length > 200) || city.length < 2 || city.length > 100 || state.length < 2 || state.length > 100 || !/^\d{6}$/.test(pincode)) fail('Enter a complete delivery address with a valid 6-digit PIN code.');
    if (!['standard','express'].includes(delivery)) fail('Choose a supported delivery method.');
    const grouped = new Map<string, number>();
    for (const line of lines) {
      if (!line.product_id || !Number.isInteger(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 20) fail('One or more cart lines are invalid.');
      grouped.set(line.product_id, (grouped.get(line.product_id) ?? 0) + Number(line.quantity));
    }
    let subtotal = 0;
    const productRows: Array<{ product: ProductRow; quantity: number }> = [];
    for (const [productId, quantity] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (quantity > 20) fail('The combined quantity for one product must be between 1 and 20.');
      const product = db.prepare('SELECT * FROM products WHERE id=? AND is_active=1').get(productId) as ProductRow | undefined;
      if (!product) fail('A product in your cart is no longer available.', 'P0002');
      if (product.stock < quantity) fail(`Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${quantity}.`, 'P0001');
      subtotal += Number(product.price) * quantity;
      productRows.push({ product, quantity });
    }
    const shipping = delivery === 'express' ? 199 : subtotal >= 1999 ? 0 : 99;
    const total = subtotal + shipping;
    const orderId = newId(); const suffix = orderId.replaceAll('-', '').slice(0, 10).toUpperCase();
    const orderNumber = `SS-${suffix}`; const invoiceNumber = `SS-INV-${suffix}`; const timestamp = nowIso();
    db.transaction(() => {
      db.prepare(`INSERT INTO orders(id,order_number,invoice_number,checkout_request_id,user_id,customer_name,customer_email,customer_phone,address_line1,address_line2,city,state,pincode,delivery_method,status,payment_method,payment_status,subtotal,discount_amount,shipping_amount,tax_amount,total_amount,placed_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'order_placed','cod','pending',?,0,?,0,?,?,?)`).run(
        orderId, orderNumber, invoiceNumber, requestId, user.id, customerName, user.email, phone, line1, line2, city, state, pincode, delivery, subtotal, shipping, total, timestamp, timestamp,
      );
      for (const { product, quantity } of productRows) {
        const reserved = db.prepare('UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND is_active=1 AND stock>=?').run(quantity, timestamp, product.id, quantity);
        if (reserved.changes !== 1) fail(`Stock changed while placing your order for ${product.name}. Refresh your cart and try again.`, 'P0001');
        db.prepare(`INSERT INTO order_items(id,order_id,product_id,product_name,product_category,product_image,unit_price,quantity,line_total) VALUES(?,?,?,?,?,?,?,?,?)`)
          .run(newId(), orderId, product.id, product.name, product.category, product.image, product.price, quantity, Number(product.price) * quantity);
      }
      addOrderEvent(orderId, 'order_placed', 'Order placed by customer.', user.id);
      notify(user.id, orderId, 'order_placed', 'Order placed successfully', `Your order ${orderNumber} has been received. Payment is due in cash on delivery.`, `/orders?id=${orderId}`);
    })();
    return { id: orderId, order_number: orderNumber, status: 'order_placed', subtotal, shipping_amount: shipping, tax_amount: 0, total_amount: total, payment_method: 'cod', payment_status: 'pending', already_processed: false };
  }
  if (name === 'customer_cancel_shop_order') {
    if (!user) fail('Sign in to cancel this order.', '28000');
    const id = String(args.p_order_id ?? ''); const order = getOrder(id);
    if (order.user_id !== user.id && user.profile?.role !== 'admin') fail('Order not found.', 'P0002');
    if (!['order_placed','confirmed','packed'].includes(order.status)) fail('This order can no longer be cancelled online. Contact customer support.');
    db.transaction(() => {
      restoreOrderStock(id);
      db.prepare("UPDATE orders SET status='cancelled',cancelled_at=?,updated_at=? WHERE id=?").run(nowIso(), nowIso(), id);
      addOrderEvent(id, 'cancelled', String(args.p_reason ?? 'Cancelled by customer before shipment.'), user.id);
      notify(order.user_id, id, 'order_status', 'Order cancelled', `Your order ${order.order_number} has been cancelled.`, `/orders?id=${id}`);
    })();
    return { id, order_number: order.order_number, status: 'cancelled' };
  }
  if (name === 'admin_update_shop_order_status') {
    adminOnly(user);
    const id = String(args.p_order_id ?? ''); const next = String(args.p_status ?? ''); const note = String(args.p_note ?? '').slice(0,500);
    const order = getOrder(id);
    if (!['confirmed','packed','shipped','out_for_delivery','delivered','cancelled'].includes(next)) fail('Choose a valid order status.');
    if (order.status === next) return { id, order_number: order.order_number, status: order.status };
    const valid: Record<string,string[]> = { order_placed:['confirmed','cancelled'], confirmed:['packed','cancelled'], packed:['shipped','cancelled'], shipped:['out_for_delivery'], out_for_delivery:['delivered'] };
    if (!(valid[order.status] ?? []).includes(next)) fail(`Invalid order transition from ${order.status} to ${next}.`);
    if (next === 'shipped' && !db.prepare('SELECT 1 FROM shipments WHERE order_id=?').get(id)) fail('Save courier and tracking details before marking this order shipped.');
    db.transaction(() => {
      if (next === 'cancelled') restoreOrderStock(id);
      const timestamp = nowIso();
      db.prepare('UPDATE orders SET status=?,cancelled_at=?,delivered_at=?,updated_at=? WHERE id=?').run(next, next === 'cancelled' ? timestamp : order.cancelled_at, next === 'delivered' ? timestamp : order.delivered_at, timestamp, id);
      if (next === 'shipped') db.prepare('UPDATE shipments SET shipped_at=COALESCE(shipped_at,?),updated_at=? WHERE order_id=?').run(timestamp,timestamp,id);
      if (next === 'delivered') db.prepare('UPDATE shipments SET delivered_at=COALESCE(delivered_at,?),updated_at=? WHERE order_id=?').run(timestamp,timestamp,id);
      addOrderEvent(id, next, note || 'Order status updated by store administrator.', user.id);
      notify(order.user_id, id, 'order_status', 'Order status updated', `Your order ${order.order_number} is now ${next.replaceAll('_',' ')}.`, `/orders?id=${id}`);
    })();
    return { id, order_number: order.order_number, status: next };
  }
  if (name === 'admin_mark_cod_collected') {
    adminOnly(user); const id = String(args.p_order_id ?? ''); const order = getOrder(id);
    if (order.payment_method !== 'cod') fail('This order is not a cash-on-delivery order.');
    if (order.status !== 'delivered') fail('COD can only be confirmed after the order is delivered.');
    if (order.payment_status === 'paid') return { id, order_number: order.order_number, payment_status: 'paid', already_processed: true };
    if (order.payment_status !== 'pending') fail('This COD payment is not in a collectible state.');
    db.transaction(() => {
      db.prepare("UPDATE orders SET payment_status='paid',payment_collected_at=?,payment_collected_by=?,updated_at=? WHERE id=?").run(nowIso(),user.id,nowIso(),id);
      notify(order.user_id,id,'cod_collected','Cash payment recorded',`Cash collection for order ${order.order_number} has been recorded.`,`/orders?id=${id}`);
    })();
    return { id, order_number: order.order_number, payment_status: 'paid', already_processed: false };
  }
  if (name === 'admin_save_order_shipment') {
    adminOnly(user); const orderId=String(args.p_order_id ?? ''); const order=getOrder(orderId);
    const carrier=String(args.p_carrier ?? '').trim(); const tracking=String(args.p_tracking_number ?? '').trim(); const url=String(args.p_tracking_url ?? '').trim();
    if (carrier.length<2 || carrier.length>80 || tracking.length<3 || tracking.length>120) fail('Enter a valid courier and tracking number.');
    if (url && !/^https:\/\//i.test(url)) fail('Tracking links must use HTTPS.');
    if (['delivered','cancelled'].includes(order.status)) fail('Tracking details cannot be changed for a completed or cancelled order.');
    let rowId = (db.prepare('SELECT id FROM shipments WHERE order_id=?').get(orderId) as {id:string}|undefined)?.id;
    if (rowId) {
      db.prepare('UPDATE shipments SET carrier=?,tracking_number=?,tracking_url=?,estimated_delivery_at=?,admin_note=?,updated_at=? WHERE id=?').run(carrier,tracking,url||null,args.p_estimated_delivery_at ?? null,args.p_admin_note ?? null,nowIso(),rowId);
    } else {
      rowId=newId();
      db.prepare('INSERT INTO shipments(id,order_id,carrier,tracking_number,tracking_url,estimated_delivery_at,admin_note,created_by) VALUES(?,?,?,?,?,?,?,?)').run(rowId,orderId,carrier,tracking,url||null,args.p_estimated_delivery_at ?? null,args.p_admin_note ?? null,user.id);
    }
    return db.prepare('SELECT * FROM shipments WHERE id=?').get(rowId);
  }
  if (name === 'admin_add_shipment_event') {
    adminOnly(user); const orderId=String(args.p_order_id ?? ''); const order=getOrder(orderId);
    const shipment=db.prepare('SELECT id FROM shipments WHERE order_id=?').get(orderId) as {id:string}|undefined;
    if (!shipment) fail('Save shipment details before adding tracking events.');
    const eventTitle=String(args.p_event_title ?? '').trim();
    if (eventTitle.length < 2 || eventTitle.length > 120) fail('Enter a shipment event title between 2 and 120 characters.');
    const eventId=newId();
    db.prepare('INSERT INTO shipment_events(id,shipment_id,event_title,event_description,location,created_by) VALUES(?,?,?,?,?,?)').run(eventId,shipment.id,eventTitle,String(args.p_event_description ?? '').slice(0,500) || null,String(args.p_location ?? '').slice(0,120) || null,user.id);
    notify(order.user_id,orderId,'shipment_update','Shipment updated',`There is a new delivery update for order ${order.order_number}.`,`/orders?id=${orderId}`);
    return db.prepare('SELECT * FROM shipment_events WHERE id=?').get(eventId);
  }
  if (name === 'customer_create_return_request') {
    if (!user) fail('Sign in to request a return.','28000');
    const orderId=String(args.p_order_id ?? ''); const order=getOrder(orderId);
    if (order.user_id !== user.id) fail('Order not found.','P0002');
    const reason=String(args.p_reason ?? ''); const description=String(args.p_description ?? '').trim();
    if (!['damaged','defective','wrong_item','missing_item','not_as_described','other'].includes(reason)) fail('Choose a valid return reason.');
    if (description.length<10 || description.length>1200) fail('Describe the issue in 10 to 1,200 characters.');
    if (order.status !== 'delivered') fail('A return can only be requested after delivery.');
    const deliveredEvent=db.prepare("SELECT MAX(created_at) AS at FROM order_status_events WHERE order_id=? AND status='delivered'").get(orderId) as {at:string|null};
    const deliveredAt=order.delivered_at || deliveredEvent.at || order.updated_at;
    if (Date.now()-new Date(deliveredAt).getTime() > 7*86400_000) fail('The 7-day return window has expired.');
    const id=newId();
    db.prepare(`INSERT INTO return_requests(id,order_id,user_id,reason,description,refund_status) VALUES(?,?,?,?,?,?)`).run(id,orderId,user.id,reason,description,order.payment_status==='paid'?'pending':'not_required');
    notify(user.id,orderId,'return_request','Return request received',`Your return request for order ${order.order_number} has been received.`,`/orders?id=${orderId}`);
    return { id, order_id: orderId, status: 'requested', refund_status: order.payment_status==='paid'?'pending':'not_required' };
  }
  if (name === 'admin_process_return_request') {
    adminOnly(user); const id=String(args.p_return_id ?? '');
    const row=db.prepare('SELECT * FROM return_requests WHERE id=?').get(id) as ReturnRow | undefined;
    if (!row) fail('Return request not found.','P0002');
    const order=getOrder(row.order_id); const next=String(args.p_status ?? '');
    const transitions:Record<string,string[]>={requested:['approved','rejected'],approved:['received'],received:['completed']};
    if (!(transitions[row.status] ?? []).includes(next)) fail(`Invalid return transition from ${row.status} to ${next}.`);
    let refundStatus=row.refund_status; let amount=Number(row.refund_amount || 0); let reference=row.refund_reference;
    if (next==='approved' && order.payment_status==='paid') refundStatus='pending';
    if (next==='rejected') { refundStatus='not_required'; amount=0; reference=null; }
    if (next==='completed' && order.payment_status==='paid') {
      reference=String(args.p_refund_reference ?? '').trim(); amount=Number(args.p_refund_amount ?? order.total_amount);
      if (reference.length<3) fail('Enter the manual refund reference before completing this paid COD return.');
      if (!Number.isFinite(amount) || amount<=0 || amount>Number(order.total_amount)) fail('Refund amount must be greater than zero and not exceed the order total.');
      refundStatus='completed';
    } else if (next==='completed') { refundStatus='not_required'; amount=0; reference=null; }
    db.transaction(() => {
      if (next==='completed' && order.payment_status==='paid') db.prepare("UPDATE orders SET payment_status='refunded',updated_at=? WHERE id=?").run(nowIso(),order.id);
      db.prepare('UPDATE return_requests SET status=?,refund_status=?,refund_amount=?,refund_reference=?,admin_note=?,updated_at=?,resolved_at=? WHERE id=?').run(next,refundStatus,amount,reference,String(args.p_admin_note ?? '').slice(0,500) || null,nowIso(),['rejected','completed'].includes(next)?nowIso():row.resolved_at,id);
      notify(row.user_id,row.order_id,'return_update','Return request updated',`Your return request for order ${order.order_number} is now ${next}.`,`/orders?id=${order.id}`);
    })();
    return { id, order_id: row.order_id, status: next, refund_status: refundStatus };
  }
  if (name === 'admin_list_shop_analytics') {
    adminOnly(user);
    const base = db.prepare(`SELECT COUNT(*) total_orders,
      SUM(CASE WHEN status NOT IN ('delivered','cancelled') THEN 1 ELSE 0 END) active_orders,
      SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) delivered_orders,
      SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) cancelled_orders,
      SUM(CASE WHEN status<>'cancelled' THEN total_amount ELSE 0 END) gross_sales,
      SUM(CASE WHEN payment_status='paid' AND payment_method='cod' THEN total_amount ELSE 0 END) cod_collected,
      SUM(CASE WHEN payment_status='pending' AND status<>'cancelled' THEN total_amount ELSE 0 END) cod_due FROM orders`).get() as { total_orders: number | null; active_orders: number | null; delivered_orders: number | null; cancelled_orders: number | null; gross_sales: number | null; cod_collected: number | null; cod_due: number | null };
    const open = db.prepare("SELECT COUNT(*) count FROM return_requests WHERE status NOT IN ('rejected','completed')").get() as {count:number};
    const stock = db.prepare('SELECT COUNT(*) count FROM products WHERE is_active=1 AND stock<5').get() as {count:number};
    const monthly = db.prepare(`SELECT strftime('%Y-%m',placed_at) month,COUNT(*) orders,
      SUM(CASE WHEN status<>'cancelled' THEN total_amount ELSE 0 END) sales
      FROM orders WHERE placed_at >= datetime('now','-5 months','start of month') GROUP BY strftime('%Y-%m',placed_at) ORDER BY month`).all();
    return { total_orders:Number(base.total_orders||0), active_orders:Number(base.active_orders||0), delivered_orders:Number(base.delivered_orders||0), cancelled_orders:Number(base.cancelled_orders||0), gross_sales:Number(base.gross_sales||0), cod_collected:Number(base.cod_collected||0), cod_due:Number(base.cod_due||0), open_returns:open.count, low_stock_products:stock.count, monthly };
  }
  fail(`Database function "${name}" is not available.`, '42883');
}
