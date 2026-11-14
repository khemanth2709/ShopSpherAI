/* eslint-disable @typescript-eslint/no-explicit-any -- The query builder is a compatibility boundary for dynamic SQL projections and nested result shapes. */
import 'server-only';
import { db, newId, normalizeRow, nowIso } from '@/lib/database/db';
import type { LocalUser } from '@/lib/database/auth';

type Filter = { column: string; operator: string; value: unknown };
type Order = { column: string; ascending: boolean };
export type QuerySpec = {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  values?: Record<string, unknown> | Array<Record<string, unknown>>;
  filters: Filter[];
  orders: Order[];
  limit?: number;
  offset?: number;
  columns?: string;
  single?: 'single' | 'maybeSingle';
  onConflict?: string;
};

const TABLE_COLUMNS: Record<string, string[]> = {
  profiles: ['id','full_name','role','created_at','updated_at'],
  user_addresses: ['id','user_id','label','recipient_name','phone','line1','line2','city','state','pincode','is_default','created_at'],
  user_preferences: ['user_id','data','updated_at'],
  products: ['id','name','category','price','original_price','rating','reviews','badge','color','image','image_source','image_attribution','image_source_url','image_license','image_license_url','description','stock','brand','tags','variants','is_active','created_by','created_at','updated_at'],
  orders: ['id','order_number','invoice_number','checkout_request_id','user_id','customer_name','customer_email','customer_phone','address_line1','address_line2','city','state','pincode','delivery_method','status','payment_method','payment_status','payment_collected_at','payment_collected_by','subtotal','discount_amount','shipping_amount','tax_amount','total_amount','placed_at','updated_at','cancelled_at','delivered_at'],
  order_items: ['id','order_id','product_id','product_name','product_category','product_image','unit_price','quantity','line_total','created_at'],
  order_status_events: ['id','order_id','status','note','actor_id','created_at'],
  shipments: ['id','order_id','carrier','tracking_number','tracking_url','estimated_delivery_at','shipped_at','delivered_at','admin_note','created_by','created_at','updated_at'],
  shipment_events: ['id','shipment_id','event_title','event_description','location','event_at','created_by','created_at'],
  return_requests: ['id','order_id','user_id','reason','description','status','refund_status','refund_amount','refund_reference','admin_note','requested_at','updated_at','resolved_at'],
  customer_notifications: ['id','user_id','order_id','notification_type','title','message','href','read_at','created_at'],
};
const JSON_COLUMNS = new Set(['tags','variants','data']);
const BOOLEAN_COLUMNS = new Set(['is_active','is_default']);

function assertTable(table: string) {
  if (!Object.hasOwn(TABLE_COLUMNS, table)) throw new Error(`Database table "${table}" is not available.`);
  return TABLE_COLUMNS[table];
}
function toDbValue(column: string, value: unknown) {
  if (JSON_COLUMNS.has(column)) return JSON.stringify(value ?? (column === 'data' ? {} : []));
  if (BOOLEAN_COLUMNS.has(column)) return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}
function selectedColumns(table: string, columns?: string) {
  const known = assertTable(table);
  if (!columns || columns.trim() === '*' || columns.includes('*')) return known;
  const fields = columns.split(',').map((part) => part.trim()).filter((part) => !part.includes('(') && !part.includes(')'));
  const list = fields.map((field) => field.split(':').pop()!.trim());
  for (const column of list) if (!known.includes(column)) throw new Error(`Unknown column "${column}" on ${table}.`);
  return list.length ? list : known;
}

function buildWhere(spec: QuerySpec, user: LocalUser | null, admin: boolean) {
  const columns = assertTable(spec.table);
  const parts: string[] = [];
  const values: unknown[] = [];
  const filters = [...spec.filters];
  // Enforce row-level ownership in the database adapter itself.
  if (spec.table === 'products' && spec.action === 'select' && !admin) {
    filters.push({ column: 'is_active', operator: 'eq', value: true });
  }
  if (user && !admin) {
    if (spec.table === 'profiles') filters.push({ column: 'id', operator: 'eq', value: user.id });
    if (['user_addresses','user_preferences','customer_notifications','return_requests','orders'].includes(spec.table)) {
      filters.push({ column: 'user_id', operator: 'eq', value: user.id });
    }
    if (['order_items','order_status_events','shipments'].includes(spec.table)) {
      parts.push(`EXISTS (SELECT 1 FROM orders AS owner_order WHERE owner_order.id = ${spec.table}.order_id AND owner_order.user_id = ?)`);
      values.push(user.id);
    }
    if (spec.table === 'shipment_events') {
      parts.push('EXISTS (SELECT 1 FROM shipments AS owner_shipment JOIN orders AS owner_order ON owner_order.id=owner_shipment.order_id WHERE owner_shipment.id=shipment_events.shipment_id AND owner_order.user_id=?)');
      values.push(user.id);
    }
  }
  for (const filter of filters) {
    if (!columns.includes(filter.column)) throw new Error(`Unknown column "${filter.column}" on ${spec.table}.`);
    const column = `"${filter.column}"`;
    if (filter.operator === 'in') {
      const list = Array.isArray(filter.value) ? filter.value : [];
      if (!list.length) { parts.push('1 = 0'); continue; }
      parts.push(`${column} IN (${list.map(() => '?').join(',')})`);
      values.push(...list.map((value) => toDbValue(filter.column, value)));
    } else if (filter.operator === 'is') {
      if (filter.value === null) parts.push(`${column} IS NULL`);
      else { parts.push(`${column} IS ?`); values.push(toDbValue(filter.column, filter.value)); }
    } else if (filter.operator === 'ilike') {
      parts.push(`LOWER(${column}) LIKE LOWER(?)`);
      values.push(String(filter.value).replace(/\*/g, '%'));
    } else {
      const ops: Record<string,string> = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=' };
      const sqlOperator = ops[filter.operator];
      if (!sqlOperator) throw new Error(`Unsupported filter operator "${filter.operator}".`);
      parts.push(`${column} ${sqlOperator} ?`);
      values.push(toDbValue(filter.column, filter.value));
    }
  }
  return { where: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', values };
}

function hydrate(table: string, row: Record<string, unknown>, columns: string): Record<string, unknown> {
  if (table === 'orders' && (columns.includes('order_items') || columns.includes('order_status_events') || columns.includes('shipments') || columns.includes('return_requests'))) {
    const id = row.id as string;
    const order = { ...row };
    if (columns.includes('order_items')) order.order_items = (db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY created_at').all(id) as Record<string, unknown>[]).map(normalizeRow);
    if (columns.includes('order_status_events')) order.order_status_events = (db.prepare('SELECT * FROM order_status_events WHERE order_id=? ORDER BY created_at').all(id) as Record<string, unknown>[]).map(normalizeRow);
    if (columns.includes('shipments')) {
      const shipment = db.prepare('SELECT * FROM shipments WHERE order_id=?').get(id) as Record<string, unknown> | undefined;
      if (shipment) {
        const events = db.prepare('SELECT * FROM shipment_events WHERE shipment_id=? ORDER BY event_at DESC').all(shipment.id) as Record<string, unknown>[];
        order.shipments = [{ ...normalizeRow(shipment), shipment_events: events.map(normalizeRow) }];
      } else order.shipments = [];
    }
    if (columns.includes('return_requests')) order.return_requests = (db.prepare('SELECT * FROM return_requests WHERE order_id=?').all(id) as Record<string, unknown>[]).map(normalizeRow);
    return order;
  }
  if (table === 'return_requests' && columns.includes('orders(')) {
    const order = db.prepare('SELECT order_number,customer_name,customer_email,customer_phone,total_amount,payment_status,status,placed_at FROM orders WHERE id=?').get(row.order_id) as Record<string, unknown> | undefined;
    return { ...row, orders: order ?? null };
  }
  return row;
}

export function executeQuery(spec: QuerySpec, user: LocalUser | null): { data: unknown; error: null } {
  const columns = assertTable(spec.table);
  const isAdmin = user?.profile?.role === 'admin';
  if (['insert','update','delete','upsert'].includes(spec.action) && !user) throw new Error('You must be signed in to make this change.');
  if (spec.table === 'products' && spec.action !== 'select' && !isAdmin) throw new Error('Only administrators can manage products.');
  if (['orders','order_items','order_status_events','shipments','shipment_events','return_requests'].includes(spec.table) && !user) throw new Error('Sign in to access order data.');
  if (['user_addresses','user_preferences','profiles','customer_notifications'].includes(spec.table) && !user) throw new Error('Sign in to access account data.');
  const suppliedValues = Array.isArray(spec.values) ? spec.values[0] : spec.values;
  if (!isAdmin && spec.table === 'profiles' && spec.action !== 'select') throw new Error('Profile records cannot be created or deleted from the customer interface.');
  if (!isAdmin && spec.table === 'profiles' && spec.action === 'update' && suppliedValues && Object.keys(suppliedValues).some((key) => !['full_name','updated_at'].includes(key))) throw new Error('Only the profile display name can be changed.');
  if (!isAdmin && spec.table === 'user_addresses' && spec.action === 'update' && suppliedValues && Object.keys(suppliedValues).some((key) => ['id','user_id','created_at'].includes(key))) throw new Error('Address ownership and identity fields cannot be changed.');
  if (!isAdmin && spec.table === 'user_preferences' && spec.action === 'update' && suppliedValues && Object.keys(suppliedValues).some((key) => !['data','updated_at'].includes(key))) throw new Error('Only saved shopping preferences can be changed.');
  if (!isAdmin && spec.table === 'customer_notifications' && spec.action !== 'select' && spec.action !== 'update') throw new Error('Notifications can only be marked as read.');
  if (!isAdmin && spec.table === 'customer_notifications' && spec.action === 'update' && suppliedValues && Object.keys(suppliedValues).some((key) => !['read_at'].includes(key))) throw new Error('Only notification read status can be changed.');
  if (!isAdmin && ['orders','order_items','order_status_events','shipments','shipment_events','return_requests'].includes(spec.table) && spec.action !== 'select') throw new Error('Order operations must use the secure checkout and store workflows.');
  if (spec.action === 'select') {
    const selected = selectedColumns(spec.table, spec.columns);
    const where = buildWhere(spec, user, isAdmin);
    const orderBy = spec.orders.map((order) => {
      if (!columns.includes(order.column)) throw new Error(`Unknown sort column "${order.column}".`);
      return `"${order.column}" ${order.ascending ? 'ASC' : 'DESC'}`;
    }).join(', ');
    const sql = `SELECT ${selected.map((column) => `"${column}"`).join(', ')} FROM "${spec.table}"${where.where}${orderBy ? ` ORDER BY ${orderBy}` : ''} LIMIT ? OFFSET ?`;
    const rows = db.prepare(sql).all(...([...where.values, Math.max(1, Math.min(spec.limit ?? 10_000, 10_000)), Math.max(0, spec.offset ?? 0)] as never[])) as Record<string, unknown>[];
    const parsed = rows.map((row) => normalizeRow(hydrate(spec.table, row, spec.columns ?? '*')));
    return { data: spec.single ? (parsed[0] ?? null) : parsed, error: null };
  }
  const inputRows = Array.isArray(spec.values) ? spec.values : spec.values ? [spec.values] : [];
  if (spec.action === 'insert' || spec.action === 'upsert') {
    if (!inputRows.length) throw new Error('No data was supplied to insert.');
    const inserted: Record<string, unknown>[] = [];
    const transaction = db.transaction(() => {
      for (const source of inputRows) {
        const value = { ...source };
        if (spec.table === 'user_addresses' && user && !isAdmin) value.user_id = user.id;
        if (spec.table === 'user_preferences' && user && !isAdmin) value.user_id = user.id;
        if (spec.table === 'user_addresses' && value.is_default) {
          db.prepare('UPDATE user_addresses SET is_default=0 WHERE user_id=?').run(value.user_id);
        }
        if (!value.id && columns.includes('id')) value.id = newId();
        if (columns.includes('created_at') && !value.created_at) value.created_at = nowIso();
        if (columns.includes('updated_at') && !value.updated_at) value.updated_at = nowIso();
        const keys = Object.keys(value).filter((key) => columns.includes(key));
        if (keys.length !== Object.keys(value).length) throw new Error('The insert contains unsupported fields.');
        let conflict = '';
        if (spec.action === 'upsert') {
          if (spec.table !== 'user_preferences') throw new Error('Upsert is only available for account preferences.');
          const conflictColumns = (spec.onConflict || 'user_id').split(',').map((column) => column.trim());
          if (!conflictColumns.length || conflictColumns.some((column) => column !== 'user_id')) throw new Error('Invalid upsert conflict target.');
          const updateKeys = keys.filter((key) => !conflictColumns.includes(key));
          conflict = updateKeys.length
            ? ` ON CONFLICT(${conflictColumns.map((column) => `"${column}"`).join(',')}) DO UPDATE SET ${updateKeys.map((key) => `"${key}"=excluded."${key}"`).join(',')}`
            : ` ON CONFLICT(${conflictColumns.map((column) => `"${column}"`).join(',')}) DO NOTHING`;
        }
        const sql = `INSERT INTO "${spec.table}" (${keys.map((key) => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})${conflict}`;
        db.prepare(sql).run(...keys.map((key) => toDbValue(key, value[key])) as never[]);
        const idColumn = columns.includes('id') ? 'id' : spec.table === 'user_preferences' ? 'user_id' : 'id';
        const idValue = value[idColumn] ?? (user?.id ?? null);
        const row = idValue ? db.prepare(`SELECT * FROM "${spec.table}" WHERE "${idColumn}"=?`).get(idValue) as Record<string, unknown> | undefined : undefined;
        if (row) inserted.push(normalizeRow(row));
      }
    });
    transaction();
    return { data: spec.single ? (inserted[0] ?? null) : inserted, error: null };
  }
  if (spec.action === 'update') {
    if (!spec.values || Array.isArray(spec.values)) throw new Error('Update data must be one object.');
    const setKeys = Object.keys(spec.values);
    if (!setKeys.length || setKeys.some((key) => !columns.includes(key))) throw new Error('The update contains unsupported fields.');
    const where = buildWhere(spec, user, isAdmin);
    if (!where.where) throw new Error('Refusing to update rows without a filter.');
    const values = setKeys.map((key) => toDbValue(key, (spec.values as Record<string, unknown>)[key]));
    db.prepare(`UPDATE "${spec.table}" SET ${setKeys.map((key) => `"${key}"=?`).join(', ')}${where.where}`).run(...([...values, ...where.values] as never[]));
    const selected = selectedColumns(spec.table, spec.columns);
    const updatedRows = db.prepare(`SELECT ${selected.map((column) => `"${column}"`).join(', ')} FROM "${spec.table}"${where.where}`).all(...(where.values as never[])) as Record<string, unknown>[];
    const parsed = updatedRows.map((row) => normalizeRow(hydrate(spec.table, row, spec.columns ?? '*')));
    return { data: spec.single ? (parsed[0] ?? null) : parsed, error: null };
  }
  if (spec.action === 'delete') {
    const where = buildWhere(spec, user, isAdmin);
    if (!where.where) throw new Error('Refusing to delete rows without a filter.');
    db.prepare(`DELETE FROM "${spec.table}"${where.where}`).run(...(where.values as never[]));
    return { data: [], error: null };
  }
  throw new Error('Unsupported database operation.');
}

export class LocalQueryBuilder implements PromiseLike<{ data: any; error: { message: string; code?: string } | null }> {
  private spec: QuerySpec;
  constructor(table: string, private executor: (spec: QuerySpec) => Promise<{ data: any; error: { message: string; code?: string } | null }>) {
    this.spec = { table, action: 'select', filters: [], orders: [] };
  }
  select(columns = '*') { this.spec.columns = columns; return this; }
  insert(values: Record<string, unknown> | Array<Record<string, unknown>>) { this.spec.action = 'insert'; this.spec.values = values; return this; }
  update(values: Record<string, unknown>) { this.spec.action = 'update'; this.spec.values = values; return this; }
  delete() { this.spec.action = 'delete'; return this; }
  upsert(values: Record<string, unknown> | Array<Record<string, unknown>>, options?: { onConflict?: string }) { this.spec.action = 'upsert'; this.spec.values = values; this.spec.onConflict = options?.onConflict; return this; }
  eq(column: string, value: unknown) { this.spec.filters.push({ column, operator: 'eq', value }); return this; }
  neq(column: string, value: unknown) { this.spec.filters.push({ column, operator: 'neq', value }); return this; }
  gt(column: string, value: unknown) { this.spec.filters.push({ column, operator: 'gt', value }); return this; }
  gte(column: string, value: unknown) { this.spec.filters.push({ column, operator: 'gte', value }); return this; }
  lt(column: string, value: unknown) { this.spec.filters.push({ column, operator: 'lt', value }); return this; }
  lte(column: string, value: unknown) { this.spec.filters.push({ column, operator: 'lte', value }); return this; }
  is(column: string, value: unknown) { this.spec.filters.push({ column, operator: 'is', value }); return this; }
  ilike(column: string, value: unknown) { this.spec.filters.push({ column, operator: 'ilike', value }); return this; }
  in(column: string, values: unknown[]) { this.spec.filters.push({ column, operator: 'in', value: values }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.spec.orders.push({ column, ascending: options?.ascending !== false }); return this; }
  limit(value: number) { this.spec.limit = value; return this; }
  range(from: number, to: number) { this.spec.offset = from; this.spec.limit = Math.max(0, to - from + 1); return this; }
  single() { this.spec.single = 'single'; return this; }
  maybeSingle() { this.spec.single = 'maybeSingle'; return this; }
  then<TResult1 = { data: any; error: { message: string; code?: string } | null }, TResult2 = never>(onfulfilled?: ((value: { data: any; error: { message: string; code?: string } | null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    return this.executor(this.spec).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}
