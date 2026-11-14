'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useShopStore } from '@/store/shopStore';

export default function RequireAuth({ children, role }: { children: React.ReactNode; role?: 'customer' | 'admin' }) {
  const router = useRouter();
  const user = useShopStore((state) => state.user);
  const hydrated = useShopStore((state) => state.hydrated);
  const authReady = useShopStore((state) => state.authReady);

  useEffect(() => {
    if (!hydrated || !authReady) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (role === 'admin' && user.role !== 'admin') router.replace('/');
  }, [hydrated, authReady, user, role, router]);

  if (!hydrated || !authReady || !user || (role === 'admin' && user.role !== 'admin')) {
    return <div className="section-shell flex min-h-[50vh] items-center justify-center"><div className="skeleton-box h-40 w-full max-w-md rounded-2xl" /></div>;
  }

  return <>{children}</>;
}
