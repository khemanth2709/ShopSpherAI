/* eslint-disable @typescript-eslint/no-explicit-any -- The browser adapter preserves a dynamic query-compatible result contract for existing typed UI consumers. */
'use client';

type Filter = { column: string; operator: string; value: unknown };
type Order = { column: string; ascending: boolean };
type QuerySpec = { table: string; action: 'select'|'insert'|'update'|'delete'|'upsert'; values?: unknown; filters: Filter[]; orders: Order[]; limit?: number; offset?: number; columns?: string; single?: 'single'|'maybeSingle'; onConflict?: string };

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (typeof body.error === 'string') body.error = { message: body.error };
  if (!response.ok && !body.error) body.error = { message: 'The local database request failed.' };
  return body;
}
class BrowserQuery implements PromiseLike<{data:any;error:any}> {
  private spec: QuerySpec;
  constructor(table: string) { this.spec={table,action:'select',filters:[],orders:[]}; }
  select(columns='*') { this.spec.columns=columns; return this; }
  insert(values: unknown) { this.spec.action='insert'; this.spec.values=values; return this; }
  update(values: unknown) { this.spec.action='update'; this.spec.values=values; return this; }
  delete() { this.spec.action='delete'; return this; }
  upsert(values: unknown, options?: {onConflict?: string}) { this.spec.action='upsert'; this.spec.values=values; this.spec.onConflict=options?.onConflict; return this; }
  eq(column:string,value:unknown) { this.spec.filters.push({column,operator:'eq',value}); return this; }
  neq(column:string,value:unknown) { this.spec.filters.push({column,operator:'neq',value}); return this; }
  gt(column:string,value:unknown) { this.spec.filters.push({column,operator:'gt',value}); return this; }
  gte(column:string,value:unknown) { this.spec.filters.push({column,operator:'gte',value}); return this; }
  lt(column:string,value:unknown) { this.spec.filters.push({column,operator:'lt',value}); return this; }
  lte(column:string,value:unknown) { this.spec.filters.push({column,operator:'lte',value}); return this; }
  is(column:string,value:unknown) { this.spec.filters.push({column,operator:'is',value}); return this; }
  ilike(column:string,value:unknown) { this.spec.filters.push({column,operator:'ilike',value}); return this; }
  in(column:string,values:unknown[]) { this.spec.filters.push({column,operator:'in',value:values}); return this; }
  order(column:string,options?:{ascending?:boolean}) { this.spec.orders.push({column,ascending:options?.ascending!==false}); return this; }
  limit(value:number) { this.spec.limit=value; return this; }
  range(from:number,to:number) { this.spec.offset=from; this.spec.limit=Math.max(0,to-from+1); return this; }
  single() { this.spec.single='single'; return this; }
  maybeSingle() { this.spec.single='maybeSingle'; return this; }
  then<TResult1={data:any;error:any},TResult2=never>(onfulfilled?:((value:{data:any;error:any})=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2> {
    const spec = { ...this.spec };
    const request = postJson('/api/localdb/query', spec).then((body) => {
      if (spec.action !== 'select' && !body.error) dispatchDatabaseChange(spec.table, spec.action, body.data);
      return body;
    });
    return request.then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

function authUserFromPayload(payload: any) { return payload?.user ?? null; }
function dispatchAuthChange(user: any) { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('shopsphere:auth-change', { detail: { user } })); }
function dispatchDatabaseChange(table: string, action: string, data: unknown) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('shopsphere:sqlite-change', { detail: { table, action, new: data } }));
}

export function isDatabaseReady() { return true; }
export function createClient() {
  const auth = {
    async getUser() { const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}); const body=await response.json().catch(()=>({})); return {data:{user:authUserFromPayload(body)},error:response.ok?null:{message:body.error||'Could not restore session.'}}; },
    async getSession() { const result=await auth.getUser(); return {data:{session:result.data.user?{user:result.data.user}:null},error:result.error}; },
    async signInWithPassword(input:{email:string;password:string}) { const body=await postJson('/api/auth/login',input); if(body.user) dispatchAuthChange(body.user); return {data:{user:body.user??null,session:body.user?{user:body.user}:null},error:body.error??null}; },
    async signUp(input:{email:string;password:string;options?:{data?:{full_name?:string}}}) { const body=await postJson('/api/auth/register',{email:input.email,password:input.password,name:input.options?.data?.full_name}); if(body.user) dispatchAuthChange(body.user); return {data:{user:body.user??null,session:body.user?{user:body.user}:null},error:body.error??null}; },
    async signOut() { const body=await postJson('/api/auth/logout',{}); if(!body.error) dispatchAuthChange(null); return {error:body.error??null}; },
    async resetPasswordForEmail(email:string) { const body=await postJson('/api/auth/password-reset',{email}); return {data:body,error:body.error??null}; },
    async updateUser(input:{password:string;token?:string}) { const body=await postJson('/api/auth/password-reset/confirm',input); if(!body.error) dispatchAuthChange(null); return {error:body.error??null}; },
    onAuthStateChange(callback:(event:string,session:any)=>void) {
      const listener=(event:Event)=>{ const detail=(event as CustomEvent).detail; callback(detail.user?'SIGNED_IN':'SIGNED_OUT',detail.user?{user:detail.user}:null); };
      if(typeof window!=='undefined') window.addEventListener('shopsphere:auth-change',listener);
      return {data:{subscription:{unsubscribe(){ if(typeof window!=='undefined') window.removeEventListener('shopsphere:auth-change',listener); }}}};
    },
  };
  const storage = { from(bucket:string) { return {
    async upload(filePath:string,file:File|Blob,_options?:{contentType?:string;upsert?:boolean}) {
      const form=new FormData(); form.append('file',file); form.append('path',filePath); form.append('bucket',bucket);
      const response=await fetch('/api/local-storage/upload',{method:'POST',body:form,credentials:'same-origin'}); const body=await response.json().catch(()=>({}));
      return {data:body.data??null,error:body.error??null};
    },
    getPublicUrl(filePath:string) { return {data:{publicUrl:`/uploads/product-images/${filePath.replace(/^\/+/, '')}`}}; },
    async remove(paths:string[]) { return postJson('/api/local-storage/remove',{bucket,paths}); },
  }; } };
  return {
    auth,
    from(table:string) { return new BrowserQuery(table); },
    async rpc(name:string,args:Record<string,unknown>={}) {
      const body=await postJson('/api/localdb/rpc',{name,args});
      if (!body.error) {
        const affected: Record<string, string[]> = {
          create_shop_order: ['orders','order_items','order_status_events','products','customer_notifications'],
          customer_cancel_shop_order: ['orders','order_status_events','products','customer_notifications'],
          admin_update_shop_order_status: ['orders','order_status_events','shipments','customer_notifications'],
          admin_save_order_shipment: ['shipments'], admin_add_shipment_event: ['shipment_events','customer_notifications'],
          admin_mark_cod_collected: ['orders','customer_notifications'], customer_create_return_request: ['return_requests','customer_notifications'],
          admin_process_return_request: ['return_requests','orders','customer_notifications'], admin_adjust_product_stock: ['products'],
        };
        for (const table of affected[name] ?? []) dispatchDatabaseChange(table, 'rpc', body.data);
      }
      return {data:body.data??null,error:body.error??null};
    },
    storage,
    channel(_name?: string) {
      const subscriptions: Array<{ table?: string; callback: (payload: any) => void }> = [];
      let listener: ((event: Event) => void) | null = null;
      const channel = {
        on(_event: string, config: { table?: string; [key: string]: unknown } = {}, callback?: (payload: any) => void) {
          if (callback) subscriptions.push({ table: config.table, callback });
          return channel;
        },
        subscribe() {
          if (typeof window !== 'undefined' && !listener) {
            listener = (event: Event) => {
              const detail = (event as CustomEvent).detail;
              subscriptions.filter((entry) => !entry.table || entry.table === detail?.table).forEach((entry) => entry.callback(detail));
            };
            window.addEventListener('shopsphere:sqlite-change', listener);
          }
          return channel;
        },
        unsubscribe() {
          if (typeof window !== 'undefined' && listener) window.removeEventListener('shopsphere:sqlite-change', listener);
          listener = null;
          subscriptions.length = 0;
          return 'ok';
        },
      };
      return channel;
    },
    async removeChannel(channel?: { unsubscribe?: () => unknown }) { return channel?.unsubscribe?.() ?? 'ok'; },
  };
}
