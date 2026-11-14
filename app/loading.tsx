export default function Loading() {
  return <main className="section-shell min-h-[60vh] py-10" aria-label="Loading ShopSphere">
    <div className="skeleton-box h-8 w-48 rounded-xl" />
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({length:10},(_,i)=><div key={i} className="space-y-3"><div className="skeleton-box aspect-[4/4.5] rounded-2xl"/><div className="skeleton-box h-3 w-2/3 rounded"/><div className="skeleton-box h-3 w-1/3 rounded"/></div>)}</div>
  </main>;
}
