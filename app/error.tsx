'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="section-shell flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <h1 className="text-2xl font-semibold">That did not load as expected.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink/55">The product catalogue can fall back to bundled data. Account sign-in and saved shopping data require the local application server and SQLite database to be available.</p>
      <button onClick={() => reset()} className="pill-button mt-5 bg-ink text-white">Try again</button>
    </main>
  );
}
