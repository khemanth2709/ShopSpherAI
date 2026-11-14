'use client';

import { useEffect, useId, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { products as localProducts } from '@/lib/products';
import { getProductCatalog } from '@/services/api/products';
import { createClient, isDatabaseReady } from '@/lib/database/client';

export function useProducts() {
  const queryClient = useQueryClient();
  const instanceId = useId().replace(/:/g, '');
  const query = useQuery({
    queryKey: ['products'],
    queryFn: getProductCatalog,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    networkMode: 'always',
  });

  useEffect(() => {
    if (!isDatabaseReady()) return;
    const database = createClient();
    const channel = database
      .channel(`shopsphere-product-catalog-${instanceId}`)
      .on('sqlite_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['products'] });
      })
      .subscribe();
    return () => { void database.removeChannel(channel); };
  }, [instanceId, queryClient]);

  const source = query.data?.products ?? localProducts;
  const products = useMemo(() => source, [source]);

  return {
    ...query,
    products,
    dataSource: query.data?.source ?? 'local',
    fallbackNotice: query.data?.notice,
    isUsingFallback: query.data?.source !== 'sqlite',
  };
}
