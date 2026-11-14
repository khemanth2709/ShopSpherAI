import PageShell from '@/components/PageShell';

export default function ProductDetailLoading() {
  return (
    <PageShell>
      <div className="mb-5 h-3 w-48 animate-pulse rounded bg-sage" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-3xl bg-sage" />
        <div className="space-y-4 py-3">
          <div className="h-3 w-28 animate-pulse rounded bg-sage" />
          <div className="h-9 w-3/4 animate-pulse rounded bg-sage" />
          <div className="h-5 w-24 animate-pulse rounded bg-sage" />
          <div className="h-24 animate-pulse rounded-2xl bg-sage" />
          <div className="h-12 animate-pulse rounded-full bg-sage" />
        </div>
      </div>
    </PageShell>
  );
}
