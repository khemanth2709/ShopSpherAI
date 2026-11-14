'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ExternalLink, ImagePlus, Loader2, Search, UploadCloud, XCircle } from 'lucide-react';
import RequireAuth from '@/components/RequireAuth';
import { createClient, isDatabaseReady } from '@/lib/database/client';

type UploadResult = { file: string; productId: string; status: 'success' | 'error'; message: string };
type AdminProduct = { id: string; name: string; category: string; image: string | null; brand?: string | null };
type LicensedImage = {
  id: string; title: string; creator: string; creatorUrl: string | null; url: string;
  thumbnail: string; sourceUrl: string; license: string; licenseVersion: string;
  licenseUrl: string | null; attribution: string; width: number; height: number;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function ProductPhotosAdmin() {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [imageQuery, setImageQuery] = useState('');
  const [imageResults, setImageResults] = useState<LicensedImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigningId, setAssigningId] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchSuccess, setSearchSuccess] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      if (!isDatabaseReady()) {
        setSearchError('The local SQLite database is not available. Start the application and try again.');
        setProductsLoading(false);
        return;
      }
      const database = createClient();
      const { data, error: loadError } = await database
        .from('products')
        .select('id,name,category,image,brand')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .range(0, 999);
      if (!active) return;
      if (loadError) setSearchError(`Could not load products: ${loadError.message}`);
      else {
        const rows = (data || []) as AdminProduct[];
        setProducts(rows);
        if (rows.length) {
          setSelectedProductId(rows[0].id);
          setImageQuery(`${rows[0].brand ? `${rows[0].brand} ` : ''}${rows[0].name} ${rows[0].category} product photograph`);
        }
      }
      setProductsLoading(false);
    }
    void loadProducts();
    return () => { active = false; };
  }, []);

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;
  const filteredProducts = useMemo(() => products.filter((product) =>
    `${product.id} ${product.name} ${product.category}`.toLowerCase().includes(productFilter.trim().toLowerCase()),
  ).slice(0, 100), [products, productFilter]);

  function selectProduct(id: string) {
    setSelectedProductId(id);
    const product = products.find((item) => item.id === id);
    if (product) setImageQuery(`${product.brand ? `${product.brand} ` : ''}${product.name} ${product.category} product photograph`);
    setImageResults([]);
    setSearchError('');
    setSearchSuccess('');
  }

  async function searchLicensedPhotos() {
    if (!selectedProductId) { setSearchError('Select a catalogue product first.'); return; }
    if (imageQuery.trim().length < 3) { setSearchError('Enter at least three characters to search.'); return; }
    setSearching(true);
    setSearchError('');
    setSearchSuccess('');
    setImageResults([]);
    try {
      const response = await fetch(`/api/admin/product-images/search?q=${encodeURIComponent(imageQuery.trim())}`, { cache: 'no-store' });
      const payload = await response.json() as { results?: LicensedImage[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Image search failed.');
      setImageResults(payload.results || []);
      if (!payload.results?.length) setSearchError('No commercially usable images matched this search. Try a shorter product name or model number.');
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : 'Image search failed.');
    } finally {
      setSearching(false);
    }
  }

  async function assignPhoto(photo: LicensedImage) {
    if (!selectedProductId || assigningId) return;
    setAssigningId(photo.id);
    setSearchError('');
    setSearchSuccess('');
    try {
      const response = await fetch('/api/admin/product-images/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProductId, imageId: photo.id }),
      });
      const payload = await response.json() as { image?: string; message?: string; error?: string };
      if (!response.ok || !payload.image) throw new Error(payload.error || 'Could not store and assign the selected photograph.');
      setProducts((current) => current.map((product) => product.id === selectedProductId ? { ...product, image: payload.image! } : product));
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['product', selectedProductId] });
      setSearchSuccess(payload.message || `Photo assigned to ${selectedProduct?.id} — ${selectedProduct?.name}.`);
    } catch (cause) {
      setSearchError(cause instanceof Error ? cause.message : 'Could not save the selected photo. Check the local database and upload permissions.');
    } finally {
      setAssigningId('');
    }
  }

  const parsed = useMemo(() => files.map((file) => {
    const match = /^(p-\d{3})\.(jpe?g|png|webp)$/i.exec(file.name);
    return { file, productId: match?.[1]?.toLowerCase() || '', valid: Boolean(match) && ALLOWED_TYPES.has(file.type) && file.size <= MAX_FILE_BYTES };
  }), [files]);
  const invalidCount = parsed.filter((item) => !item.valid).length;
  const validFiles = parsed.filter((item) => item.valid);

  function chooseFiles(list: FileList | null) {
    if (!list) return;
    setResults([]);
    setError('');
    setProgress(0);
    setFiles(Array.from(list));
  }

  async function uploadAll() {
    if (busy || validFiles.length === 0) return;
    if (!isDatabaseReady()) { setError('The local SQLite database is not available. Start the application and try again.'); return; }
    const duplicates = validFiles.map((item) => item.productId).filter((id, index, all) => all.indexOf(id) !== index);
    if (duplicates.length) { setError(`Duplicate files detected for: ${[...new Set(duplicates)].join(', ')}. Keep only one image for each product ID.`); return; }

    setBusy(true);
    setResults([]);
    setError('');
    const database = createClient();
    const ids = validFiles.map((item) => item.productId);
    const { data: existing, error: lookupError } = await database.from('products').select('id').in('id', ids);
    if (lookupError) {
      setError(`Could not check product IDs: ${lookupError.message}. Check the local SQLite database schema.`);
      setBusy(false);
      return;
    }
    const existingIds = new Set((existing || []).map((item: { id: string }) => item.id));
    const uploadedResults: UploadResult[] = [];
    const tasks = validFiles.filter((item) => existingIds.has(item.productId));
    for (const item of validFiles.filter((entry) => !existingIds.has(entry.productId))) {
      uploadedResults.push({ file: item.file.name, productId: item.productId, status: 'error', message: 'No matching product ID exists in the SQLite catalogue.' });
    }
    setProgress(uploadedResults.length);

    for (let start = 0; start < tasks.length; start += 4) {
      const batch = tasks.slice(start, start + 4);
      const batchResults = await Promise.all(batch.map(async (item): Promise<UploadResult> => {
        const extension = item.file.type === 'image/jpeg' ? 'jpg' : item.file.type === 'image/png' ? 'png' : 'webp';
        const storagePath = `catalog/${item.productId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const upload = await database.storage.from('product-images').upload(storagePath, item.file, {
          upsert: false, contentType: item.file.type,
        });
        if (upload.error) return { file: item.file.name, productId: item.productId, status: 'error', message: upload.error.message };
        const publicUrl = database.storage.from('product-images').getPublicUrl(upload.data.path).data.publicUrl;
        const update = await database.from('products').update({
          image: publicUrl, image_source: 'merchant_upload', image_attribution: null, image_source_url: null, image_license: null, image_license_url: null,
          updated_at: new Date().toISOString(),
        }).eq('id', item.productId);
        if (update.error) {
          await database.storage.from('product-images').remove([upload.data.path]);
          return { file: item.file.name, productId: item.productId, status: 'error', message: update.error.message };
        }
        return { file: item.file.name, productId: item.productId, status: 'success', message: 'Uploaded and linked to product.' };
      }));
      uploadedResults.push(...batchResults);
      setResults([...uploadedResults]);
      setProgress(uploadedResults.length);
    }
    setResults(uploadedResults);
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    setBusy(false);
  }

  const succeeded = results.filter((item) => item.status === 'success').length;
  const failed = results.filter((item) => item.status === 'error').length;

  return (
    <main className="min-h-screen bg-[#f5f6f3] px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-bold text-moss"><ArrowLeft size={15}/> Back to admin</Link>
        <header className="mt-6 rounded-3xl bg-ink p-6 text-white sm:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-200">Catalogue media</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Real product photographs</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Search openly licensed photographs for each catalogue item, review the source and licence, then assign the image to that exact SKU.</p>
        </header>

        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <h2 className="text-sm font-bold text-emerald-950">Bulk-fill catalogue photo placeholders</h2>
          <p className="mt-1 text-xs leading-5 text-emerald-900/80">On the computer running ShopSphere, run <code className="rounded bg-white px-1.5 py-0.5">npm run photos:import -- --limit=750</code> to seed placeholder product images from Openverse.</p>
          <p className="mt-2 text-[10px] leading-4 text-emerald-900/70">Openverse is an external image catalogue, so imported photographs require an internet connection. Review each result for exact matching, commercial use rights and brand consistency before assigning it to the live catalogue.</p>
        </section>

        <section className="mt-6 rounded-3xl border border-black/[.06] bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Find a real product photograph</h2><p className="mt-1 text-xs leading-5 text-black/50">Search Openverse for large, openly licensed photographs that match your listing and intended SKU.</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">Commercial-use filter</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <label className="grid gap-1.5 text-xs font-semibold">Select product
              <select value={selectedProductId} onChange={(event) => selectProduct(event.target.value)} disabled={productsLoading || products.length === 0} className="h-11 rounded-xl border border-black/10 bg-slate-50 px-3 text-sm text-ink outline-none ring-0 transition focus:border-moss">
                {productsLoading && <option>Loading products…</option>}
                {!productsLoading && products.length === 0 && <option>No products found</option>}
                {filteredProducts.map((product) => <option key={product.id} value={product.id}>{product.id} · {product.name} ({product.category})</option>)}
              </select>
              <input value={productFilter} onChange={(event) => setProductFilter(event.target.value)} placeholder="Filter product list by name or ID" className="h-10 rounded-xl border border-black/10 bg-slate-50 px-3 text-sm text-ink outline-none transition focus:border-moss"/>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold">Photo search terms
              <div className="flex gap-2"><input value={imageQuery} onChange={(event) => setImageQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchLicensedPhotos(); } }} placeholder="e.g. red ceramic mug product photo" className="h-11 flex-1 rounded-xl border border-black/10 bg-slate-50 px-3 text-sm text-ink outline-none transition focus:border-moss"/><button type="button" onClick={() => void searchLicensedPhotos()} disabled={searching} className="rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{searching ? 'Searching…' : 'Search'}</button></div>
              <span className="text-[10px] font-normal text-black/45">Tip: include colour, model or material when you know it. Confirm that the photograph matches the item you actually sell.</span>
            </label>
          </div>

          {searchError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{searchError}</p>}
          {searchSuccess && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{searchSuccess}</p>}

          {imageResults.length > 0 && <div className="mt-6">
            <p className="mb-3 text-xs font-bold">Search results for {selectedProduct?.name} · {imageResults.length} photographs</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {imageResults.map((photo) => <article key={photo.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                <div className="aspect-[4/3] bg-slate-100"><img src={photo.thumbnail} alt={photo.title} loading="lazy" className="h-full w-full object-contain" referrerPolicy="strict-origin-when-cross-origin"/></div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-semibold">{photo.title}</p>
                  <p className="mt-1 text-[10px] text-black/55">By {photo.creator}</p>
                  <p className="mt-1 text-[10px] font-bold text-emerald-800">{photo.license}{photo.licenseVersion ? ` ${photo.licenseVersion}` : ''}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold text-moss underline underline-offset-2"><ExternalLink size={12}/> Source</a>
                    <button type="button" onClick={() => void assignPhoto(photo)} disabled={Boolean(assigningId)} className="rounded-full bg-ink px-3 py-2 text-[10px] font-bold text-white hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60">{assigningId === photo.id ? 'Saving…' : 'Assign photo'}</button>
                  </div>
                </div>
              </article>)}
            </div>
          </div>}
          <p className="mt-5 rounded-xl bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">Openly licensed does not mean the photograph depicts the exact SKU. Check the image and licence/source carefully before assigning it to your product.</p>
        </section>

        <section className="mt-6 rounded-3xl border border-black/[.06] bg-white p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Bulk upload your own supplier photographs</h2>
          <p className="mt-2 text-sm leading-6 text-black/55">Name each file with its exact product ID. For example, <b>p-001.jpg</b> updates product <b>p-001</b>. Accepted formats: JPG, PNG, WebP. Max file size: 5 MB.</p>
          <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-moss/30 bg-sage/20 p-6 text-center hover:bg-sage/35">
            <UploadCloud size={30} className="text-moss"/><span className="mt-3 text-sm font-bold">Choose product photographs</span><span className="mt-1 text-xs text-black/45">Select multiple files from your computer.</span>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => chooseFiles(event.target.files)}/>
          </label>

          {files.length > 0 && <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">Selected files: {files.length} · Valid: {validFiles.length} · Invalid: {invalidCount}</p><button type="button" onClick={() => setFiles([])} className="text-[10px] font-bold text-moss underline">Clear</button></div>
            <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-black/10">{parsed.map((item) => <div key={`${item.file.name}-${item.file.lastModified}`} className="flex items-center justify-between gap-3 border-b border-black/5 px-3 py-2 last:border-b-0"><div className="min-w-0"><p className="truncate text-[11px] font-semibold">{item.file.name}</p><p className="mt-0.5 text-[10px] text-black/45">{item.valid ? 'Valid product image' : 'Invalid file name, format or size'}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{item.valid ? 'OK' : 'Fix'}</span></div>)}</div>
            <button type="button" onClick={() => void uploadAll()} disabled={busy || validFiles.length === 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{busy ? <><Loader2 size={16} className="animate-spin"/> Uploading…</> : 'Upload selected photographs'}</button>
          </div>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          {results.length > 0 && <div className="mt-5 rounded-2xl border border-black/10 p-4"><div className="flex flex-wrap gap-4 text-xs font-bold"><span className="text-emerald-700">Successful: {succeeded}</span><span className="text-rose-600">Failed: {failed}</span></div><div className="mt-3 space-y-2">{results.map((result) => <div key={`${result.file}-${result.productId}`} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"><div><p className="text-[11px] font-semibold">{result.productId} · {result.file}</p><p className="mt-0.5 text-[10px] text-black/55">{result.message}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${result.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{result.status === 'success' ? <CheckCircle2 size={10}/> : <XCircle size={10}/>} {result.status}</span></div>)}</div></div>}
          <p className="mt-5 text-[11px] leading-5 text-black/45">Uploaded images are stored on this application&apos;s local disk in public/uploads/product-images. Upload permissions remain restricted to the admin role and the active catalogue tenant.</p>
        </section>
      </div>
    </main>
  );
}

export default function AdminProductPhotosPage() {
  return <RequireAuth role="admin"><ProductPhotosAdmin/></RequireAuth>;
}
