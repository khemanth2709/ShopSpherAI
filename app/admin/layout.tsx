import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/database/server';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const database = await createClient().catch(() => null);
  if (!database) redirect('/login?next=%2Fadmin');

  const { data: { user }, error: authError } = await database.auth.getUser();
  if (authError || !user) redirect('/login?next=%2Fadmin');

  const { data: profile, error: profileError } = await database
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') redirect('/');
  return <>{children}</>;
}
