'use client';
import RequireAuth from '@/components/RequireAuth';
import ProductImage from '@/components/ProductImage';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Bell, Boxes, BarChart3, CircleHelp, ImagePlus, LayoutDashboard, Menu, Package, Plus, Search, Settings2, ShoppingBag, Users, X } from 'lucide-react';
import { categories, formatPrice, type Product } from '@/lib/products';
import { createClient, isDatabaseReady } from '@/lib/database/client';
import { mapProductRecord } from '@/services/api/products';

function AdminDashboard() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('Tech');
  const [newStock, setNewStock] = useState('10');
  const [newImage, setNewImage] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [newDescription, setNewDescription] = useState('A useful everyday product selected for the ShopSphere catalogue.');

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return; }
    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

  function selectProductPhoto(file: File | null) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { notify('Use a JPG, PNG or WebP product photo.'); return; }
    if (file.size > 5 * 1024 * 1024) { notify('Product photos must be 5 MB or smaller.'); return; }
    setPhotoFile(file);
    setNewImage('');
  }

  useEffect(() => {
    let active = true;
    async function loadInventory() {
      if (!isDatabaseReady()) {
        if (active) {
          setInventoryError('The local SQLite database is unavailable. Restart the application and check the server logs.');
          setLoading(false);
        }
        return;
      }
      try {
        const database = createClient();
        const { data, error } = await database
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('id', { ascending: true })
          .range(0, 999);
        if (error) throw error;
        if (active) {
          if (!data || data.length === 0) {
            setItems([]);
            setInventoryError('The local product catalogue is empty. Restart the application to initialize the 750 starter products.');
          } else {
            setItems(data.map((row: Parameters<typeof mapProductRecord>[0]) => mapProductRecord(row)));
            setInventoryError('');
          }
        }
      } catch (error) {
        if (active) setInventoryError(error instanceof Error ? error.message : 'Could not load the database inventory.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadInventory();
    return () => { active = false; };
  }, []);

  const filteredItems = useMemo(() => items.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [items, search]);
  const inventoryValue = items.reduce((sum, item) => sum + item.price * item.stock, 0);
  const totalStock = items.reduce((sum, item) => sum + item.stock, 0);
  const healthyCount = items.filter((item) => item.stock >= 12).length;
  const reorderCount = items.filter((item) => item.stock >= 5 && item.stock < 12).length;
  const lowCount = items.filter((item) => item.stock < 5).length;
  const healthyPercent = items.length ? Math.round((healthyCount / items.length) * 100) : 0;
  const reorderPercent = items.length ? Math.round((reorderCount / items.length) * 100) : 0;
  const lowPercent = Math.max(0, 100 - healthyPercent - reorderPercent);
  const [todayLabel, setTodayLabel] = useState('Live store operations');
  useEffect(() => { setTodayLabel(new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())); }, []);

  async function changeStock(id: string, amount: number) {
    if (!isDatabaseReady()) { notify('The local SQLite database is unavailable. Restart the application and check the server logs.'); return; }
    const current = items.find((item) => item.id === id);
    if (!current) return;
    try {
      const database = createClient();
      const { data, error } = await database.rpc('admin_adjust_product_stock', { p_product_id: id, p_delta: amount });
      if (error) throw error;
      if (!data) throw new Error('The database did not return the updated product.');
      const updated = mapProductRecord(data as Parameters<typeof mapProductRecord>[0]);
      setItems((currentItems) => currentItems.map((item) => item.id === id ? updated : item));
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      notify('Stock updated in database');
    } catch (error) {
      notify(`Stock update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  function openAddProduct() {
    setEditingProduct(null);
    setNewName(''); setNewPrice(''); setNewCategory('Tech'); setNewStock('10');
    setNewImage(''); setPhotoFile(null);
    setNewDescription('A useful everyday product selected for the ShopSphere catalogue.');
    setShowAdd(true);
  }

  function openEditProduct(item: Product) {
    setEditingProduct(item);
    setNewName(item.name); setNewPrice(String(item.price)); setNewCategory(item.category); setNewStock(String(item.stock));
    setNewImage(item.image); setPhotoFile(null); setNewDescription(item.description);
    setShowAdd(true);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(newPrice);
    const stock = Number(newStock);
    if (!newName.trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      notify('Enter a product name, a valid price and a whole-number stock quantity.');
      return;
    }
    if (!isDatabaseReady()) { notify('The local SQLite database is unavailable. Restart the application and check the server logs.'); return; }
    setSaving(true);
    try {
      const database = createClient();
      const productId = editingProduct?.id ?? `p-${crypto.randomUUID()}`;
      let imageValue = newImage.trim() || '/products/fallback.svg';
      let imageSource: 'placeholder' | 'merchant_upload' | 'supplier_url' | 'licensed_upload' | 'generated_photo' = imageValue.startsWith('https://') ? 'supplier_url' : 'placeholder';
      if (imageValue.startsWith('http://')) throw new Error('Use an HTTPS supplier image URL.');
      if (photoFile) {
        const extension = photoFile.type === 'image/jpeg' ? 'jpg' : photoFile.type === 'image/png' ? 'png' : 'webp';
        const storagePath = `${productId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const upload = await database.storage.from('product-images').upload(storagePath, photoFile, {
          upsert: false, contentType: photoFile.type,
        });
        if (upload.error) throw new Error(`Photo upload failed: ${upload.error.message}. Confirm your account has administrator access and check that the local uploads directory is writable.`);
        imageValue = database.storage.from('product-images').getPublicUrl(upload.data.path).data.publicUrl;
        imageSource = 'merchant_upload';
      } else if (editingProduct?.imageSource && imageValue === editingProduct.image) {
        imageSource = editingProduct.imageSource;
      }
      const sharedFields = {
        name: newName.trim(),
        category: newCategory,
        price,
        stock,
        image: imageValue,
        image_source: imageSource,
        description: newDescription.trim(),
      };
      const result = editingProduct
        ? await database.from('products').update({ ...sharedFields, original_price: editingProduct.originalPrice && editingProduct.originalPrice > price ? editingProduct.originalPrice : null, updated_at: new Date().toISOString() }).eq('id', editingProduct.id).select('*').single()
        : await database.from('products').insert({
            id: productId,
            ...sharedFields,
            original_price: null,
            rating: 0,
            reviews: 0,
            badge: null,
            color: 'from-slate-100 to-slate-200',
            brand: null,
            tags: [],
            variants: [],
            is_active: true,
          }).select('*').single();
      if (result.error) throw result.error;
      const saved = mapProductRecord(result.data as Parameters<typeof mapProductRecord>[0]);
      setItems((current) => editingProduct
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current]);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowAdd(false); setEditingProduct(null);
      notify(editingProduct ? 'Product changes saved to database' : 'Product added to database');
    } catch (error) {
      notify(`Could not save product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(item: Product) {
    if (!isDatabaseReady()) { notify('The local SQLite database is unavailable. Restart the application and check the server logs.'); return; }
    if (!window.confirm(`Remove “${item.name}” from the storefront? It will remain in the database as inactive.`)) return;
    try {
      const database = createClient();
      const { error } = await database.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', item.id);
      if (error) throw error;
      setItems((current) => current.filter((product) => product.id !== item.id));
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      notify('Product archived. It is no longer visible in the storefront.');
    } catch (error) {
      notify(`Could not archive product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const nav = <><a href="#overview" onClick={() => setShowMobileNav(false)} className="flex items-center gap-3 rounded-xl bg-ink px-3 py-3 text-sm font-semibold text-white"><LayoutDashboard size={17} /> Overview</a><a href="#inventory" onClick={() => setShowMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-black/55 transition hover:bg-black/5 hover:text-ink"><Package size={17} /> Products <span className="ml-auto rounded-full bg-sage px-2 py-0.5 text-[10px] text-moss">{items.length}</span></a><Link href="/admin/product-photos" onClick={() => setShowMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-black/55 transition hover:bg-black/5 hover:text-ink"><ImagePlus size={17}/> Product photos</Link><Link href="/admin/orders" onClick={() => setShowMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-black/55 transition hover:bg-black/5 hover:text-ink"><ShoppingBag size={17} /> Orders</Link><Link href="/admin/returns" onClick={() => setShowMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-black/55 transition hover:bg-black/5 hover:text-ink"><Users size={17} /> Returns</Link><Link href="/admin/analytics" onClick={() => setShowMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-black/55 transition hover:bg-black/5 hover:text-ink"><BarChart3 size={17} /> Analytics</Link></>;

  return <main className="min-h-screen bg-[#f5f6f3] text-ink">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-black/[.06] bg-white px-5 py-6 lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-1"><span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-lime"><Boxes size={19} /></span><span className="text-[17px] font-black tracking-[-.07em]">shop<span className="font-normal">sphere</span><sup className="ml-0.5 text-[9px] font-bold text-moss">AI</sup></span></Link>
      <p className="mt-10 px-3 text-[9px] font-bold uppercase tracking-[.2em] text-black/35">Workspace</p><nav className="mt-3 grid gap-1">{nav}</nav>
      <div className="mt-auto rounded-2xl bg-[#e9eee5] p-4"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white"><CircleHelp size={16} /></span><p className="mt-3 text-xs font-bold">Need a hand?</p><p className="mt-1 text-[10px] leading-5 text-black/50">Products, COD orders, shipment references and customer updates are stored in database. Automatic courier scans require a courier API connection.</p><button onClick={() => notify('Support workflows have not been configured yet.')} className="mt-3 text-[10px] font-bold underline underline-offset-4">Open help centre</button></div>
      <Link href="/" className="mt-5 flex items-center gap-2 px-2 text-xs font-semibold text-black/55 hover:text-ink"><ArrowLeft size={14} /> Back to storefront</Link>
    </aside>

    {showMobileNav && <div className="fixed inset-0 z-40 lg:hidden"><button onClick={() => setShowMobileNav(false)} className="absolute inset-0 bg-ink/35" aria-label="Close menu"/><aside className="absolute bottom-0 left-0 top-0 w-[280px] bg-white p-5"><div className="flex items-center justify-between"><Link href="/" className="text-lg font-black tracking-tight">shopsphere<span className="font-normal"> AI</span></Link><button onClick={() => setShowMobileNav(false)}><X size={18}/></button></div><nav className="mt-8 grid gap-1">{nav}</nav><Link href="/" className="mt-8 flex items-center gap-2 text-sm"><ArrowLeft size={15}/> Back to storefront</Link></aside></div>}

    <div className="lg:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-black/[.06] bg-white/90 px-4 backdrop-blur-lg sm:px-7 lg:px-9">
        <div className="flex items-center gap-3"><button className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 lg:hidden" onClick={() => setShowMobileNav(true)} aria-label="Open navigation"><Menu size={18}/></button><div><p className="text-xs text-black/45">Workspace / <span className="text-ink">Overview</span></p><h1 className="mt-0.5 text-sm font-bold sm:text-base">Store overview</h1></div></div>
        <div className="flex items-center gap-2 sm:gap-3"><span className="hidden text-xs text-black/45 sm:block">Live database inventory · INR</span><Link href="/admin/returns" className="relative flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white" aria-label="Return requests"><Bell size={17}/></Link><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dce7d9] text-xs font-bold">HE</span></div>
      </header>
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
        <section id="overview" className="scroll-mt-24">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-moss">{todayLabel}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.06em] sm:text-3xl">Your store at a glance.</h2><p className="mt-2 text-xs text-black/50 sm:text-sm">Here’s what’s happening with your ShopSphere storefront.</p></div><button onClick={openAddProduct} className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-bold text-white transition hover:bg-moss"><Plus size={15}/> Add product</button></div>
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-black/[.06] bg-white p-5"><p className="text-xs font-semibold text-black/55">Active products</p><p className="mt-4 text-2xl font-bold">{items.length}</p><p className="mt-2 text-[10px] text-black/40">Live catalogue records</p></div>
            <div className="rounded-2xl border border-black/[.06] bg-white p-5"><p className="text-xs font-semibold text-black/55">Units in stock</p><p className="mt-4 text-2xl font-bold">{totalStock}</p><p className="mt-2 text-[10px] text-black/40">Across active products</p></div>
            <div className="rounded-2xl border border-black/[.06] bg-white p-5"><p className="text-xs font-semibold text-black/55">Healthy stock</p><p className="mt-4 text-2xl font-bold">{healthyCount}</p><p className="mt-2 text-[10px] text-black/40">Products with 12+ units</p></div>
            <div className="rounded-2xl border border-black/[.06] bg-white p-5"><p className="text-xs font-semibold text-black/55">Low stock alerts</p><p className="mt-4 text-2xl font-bold">{lowCount + reorderCount}</p><p className="mt-2 text-[10px] text-black/40">Products needing attention</p></div>
          </div>
        </section>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <section className="flex flex-col justify-between rounded-2xl border border-black/[.06] bg-white p-5 sm:p-6">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-moss">Order operations</p><h3 className="mt-2 text-xl font-semibold">Manage real customer orders</h3><p className="mt-2 max-w-lg text-xs leading-5 text-black/50">Orders placed through checkout are stored in database with price snapshots, delivery details and status history. Update fulfilment from the order management screen.</p></div>
            <Link href="/admin/orders" className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-bold text-white">Open order management <ShoppingBag size={14}/></Link>
          </section>
          <section className="rounded-2xl border border-black/[.06] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">Inventory health</h3><p className="mt-1 text-[10px] text-black/45">Across your product catalogue</p></div><button onClick={() => document.getElementById('inventory')?.scrollIntoView({ behavior: 'smooth' })} className="text-[10px] font-bold text-moss underline underline-offset-4">View inventory</button></div><div className="mt-6 flex items-center gap-5"><div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#49634f 0 ${healthyPercent}%, #c6f277 ${healthyPercent}% ${healthyPercent + reorderPercent}%, #f0c9a8 ${healthyPercent + reorderPercent}% 100%)` }}><div className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-white"><span className="text-xl font-bold">{items.length}</span><span className="text-[9px] text-black/45">SKUs</span></div></div><div className="grid gap-3 text-[10px]"><p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-moss"/> Healthy stock <b className="ml-auto">{healthyPercent}% · {healthyCount}</b></p><p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-lime"/> Reorder soon <b className="ml-auto">{reorderPercent}% · {reorderCount}</b></p><p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#f0c9a8]"/> Low stock <b className="ml-auto">{lowPercent}% · {lowCount}</b></p></div></div><div className="mt-6 rounded-xl bg-[#f6f7f3] p-3.5"><p className="text-xs font-bold">Inventory value</p><p className="mt-1 text-lg font-bold">{formatPrice(inventoryValue)}</p><p className="mt-1 text-[9px] text-black/45">Estimated retail value of current stock</p></div></section>
        </div>
        <section id="orders" className="mt-6 scroll-mt-24 rounded-2xl border border-black/[.06] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Recent customer orders</h3><p className="mt-1 text-[10px] text-black/45">The order list now comes from your database orders database.</p></div><Link href="/admin/orders" className="rounded-full bg-ink px-4 py-2 text-[10px] font-bold text-white">View and manage orders</Link></div></section>

        <section id="inventory" className="mt-6 scroll-mt-24 rounded-2xl border border-black/[.06] bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="text-sm font-bold">Product inventory</h3><p className="mt-1 text-[10px] text-black/45">Products and stock quantities are saved in database and shared across customer sessions.</p></div><div className="flex gap-2"><label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 sm:w-56"><Search size={14} className="text-black/40"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="w-full min-w-0 bg-transparent text-xs outline-none"/></label><button onClick={openAddProduct} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-bold text-white hover:bg-moss"><Plus size={14}/><span className="hidden sm:inline">Add product</span></button></div></div><div className="mt-4 space-y-2">{loading && <p className="rounded-xl bg-slate-50 p-3 text-xs text-black/55">Loading inventory from SQLite…</p>}{inventoryError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><b>Inventory connection issue:</b> {inventoryError}<p className="mt-1">Check the server logs and confirm that your account has administrator access.</p></div>}</div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-y border-black/[.06] text-[9px] uppercase tracking-[.13em] text-black/40"><th className="py-3 font-bold">Product</th><th className="py-3 font-bold">Category</th><th className="py-3 font-bold">Price</th><th className="py-3 font-bold">Stock</th><th className="py-3 font-bold">Inventory value</th><th className="py-3 font-bold">Adjust</th><th className="py-3 font-bold">Actions</th></tr></thead><tbody>{filteredItems.map((item) => <tr key={item.id} className="border-b border-black/[.045] text-xs last:border-0"><td className="py-3.5"><div className="flex items-center gap-3"><ProductImage src={item.image} productId={item.id} alt={item.name} className="h-10 w-10 rounded-lg object-cover"/><div><p className="max-w-[200px] truncate font-semibold">{item.name}</p><p className="mt-1 text-[9px] text-black/35">{item.id}</p><p className={`mt-1 text-[9px] font-semibold ${item.imageSource === 'merchant_upload' || item.imageSource === 'supplier_url' || item.imageSource === 'licensed_upload' || item.imageSource === 'generated_photo' ? 'text-emerald-700' : 'text-amber-700'}`}>{item.imageSource === 'merchant_upload' || item.imageSource === 'supplier_url' || item.imageSource === 'licensed_upload' || item.imageSource === 'generated_photo' ? 'Product photo set' : 'Placeholder — photo needed'}</p></div></div></td><td className="py-3.5 text-black/55">{item.category}</td><td className="py-3.5 font-semibold">{formatPrice(item.price)}</td><td className="py-3.5"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.stock < 12 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{item.stock} units</span></td><td className="py-3.5">{formatPrice(item.stock * item.price)}</td><td className="py-3.5"><div className="flex items-center gap-1.5"><button onClick={() => changeStock(item.id, -1)} disabled={item.stock === 0} className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 disabled:opacity-30" aria-label={`Decrease stock for ${item.name}`}>−</button><button onClick={() => changeStock(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10" aria-label={`Increase stock for ${item.name}`}>+</button></div></td><td className="py-3.5"><div className="flex items-center gap-2"><button onClick={() => openEditProduct(item)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[10px] font-semibold">Edit</button><button onClick={() => void archiveProduct(item)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700">Archive</button></div></td></tr>)}</tbody></table>{!loading && !inventoryError && filteredItems.length === 0 && <p className="py-10 text-center text-xs text-black/45">No products match your search.</p>}</div></section>

        <footer className="flex flex-col gap-2 py-7 text-[10px] text-black/40 sm:flex-row sm:items-center sm:justify-between"><span>© 2026 ShopSphere AI · database inventory</span><span className="flex items-center gap-1"><Settings2 size={12}/> Catalogue, COD checkout, delivery tracking and order fulfilment are connected to database</span></footer>
      </div>
    </div>

    {showAdd && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"><div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><button onClick={() => { setShowAdd(false); setEditingProduct(null); }} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/5" aria-label="Close form"><X size={16}/></button><p className="text-[10px] font-bold uppercase tracking-[.2em] text-moss">database inventory</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{editingProduct ? 'Edit product' : 'Add a product'}</h2><p className="mt-2 text-xs text-black/45">Changes are saved to the shared product database.</p><form onSubmit={saveProduct} className="mt-5 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold">Product name</span><input required value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Everyday desk organiser" className="w-full rounded-xl border border-black/10 px-3.5 py-3 text-sm outline-none focus:border-moss"/></label><div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1.5 block text-xs font-bold">Price (₹)</span><input required min="1" type="number" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} placeholder="1499" className="w-full rounded-xl border border-black/10 px-3.5 py-3 text-sm outline-none focus:border-moss"/></label><label className="block"><span className="mb-1.5 block text-xs font-bold">Stock units</span><input required min="0" step="1" type="number" value={newStock} onChange={(event) => setNewStock(event.target.value)} className="w-full rounded-xl border border-black/10 px-3.5 py-3 text-sm outline-none focus:border-moss"/></label></div><label className="block"><span className="mb-1.5 block text-xs font-bold">Category</span><select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm outline-none focus:border-moss">{categories.filter((category) => category !== 'All').map((category) => <option key={category} value={category}>{category}</option>)}</select></label><div className="space-y-3 rounded-2xl border border-black/10 p-4"><div><span className="block text-xs font-bold">Actual product photograph</span><p className="mt-1 text-[11px] leading-5 text-black/50">Upload a real photo of this exact product, or paste an HTTPS image URL supplied by the manufacturer/vendor. Only use images you own or are licensed to use. JPG, PNG or WebP; maximum 5 MB.</p></div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-moss/40 bg-sage/40 px-4 py-4 text-xs font-bold text-moss hover:bg-sage"><ImagePlus size={16}/> {photoFile ? 'Choose a different photo' : 'Upload product photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectProductPhoto(event.target.files?.[0] ?? null)}/></label>{(photoPreview || newImage) && <div className="flex items-center gap-3"><img src={photoPreview || newImage} alt="Product photo preview" className="h-24 w-24 rounded-xl border border-black/10 bg-slate-50 object-contain"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{photoFile ? photoFile.name : 'Current image / supplied URL'}</p><button type="button" onClick={() => { setPhotoFile(null); setNewImage(''); }} className="mt-2 text-[11px] font-bold text-rose-600">Remove selected image</button></div></div>}<label className="block"><span className="mb-1.5 block text-xs font-bold">Or paste a licensed supplier photo URL</span><input type="url" value={newImage} onChange={(event) => { setNewImage(event.target.value); setPhotoFile(null); }} placeholder="https://manufacturer.com/product-photo.jpg" className="w-full rounded-xl border border-black/10 px-3.5 py-3 text-sm outline-none focus:border-moss"/></label></div><label className="block"><span className="mb-1.5 block text-xs font-bold">Description</span><textarea required rows={3} value={newDescription} onChange={(event) => setNewDescription(event.target.value)} className="w-full rounded-xl border border-black/10 px-3.5 py-3 text-sm outline-none focus:border-moss"/></label><button disabled={saving} type="submit" className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-moss disabled:opacity-50">{saving ? 'Saving…' : editingProduct ? 'Save changes' : 'Add product to catalogue'}</button></form></div></div>}
    {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>}
  </main>;
}

export default function AdminPage(){ return <RequireAuth role="admin"><AdminDashboard /></RequireAuth>; }
