'use client';

import { useEffect, useState } from 'react';

type ProductImageProps = {
  src?: string | null;
  productId?: string | null;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  sizes?: string;
  fallbackSrc?: string;
};

/** Local-first image rendering with deterministic fallbacks for missing/slow remote assets. */
export default function ProductImage({
  src,
  productId,
  alt,
  className = '',
  loading = 'lazy',
  sizes,
  fallbackSrc = '/products/fallback.svg',
}: ProductImageProps) {
  const localSkuImage = productId && /^p-\d{3}$/.test(productId) ? `/products/${productId}.svg` : null;
  const productFallback = localSkuImage || fallbackSrc;
  const resolvedSrc = src?.trim() || productFallback;
  const [failure, setFailure] = useState<{ source: string; level: 1 | 2 } | null>(null);
  const [timedOutSource, setTimedOutSource] = useState<string | null>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const isRemote = /^https?:\/\//i.test(resolvedSrc);
  const level = failure?.source === resolvedSrc ? failure.level : 0;
  const timedOut = timedOutSource === resolvedSrc;
  const currentSrc = level === 0 && !timedOut
    ? resolvedSrc
    : level <= 1
      ? productFallback
      : fallbackSrc;

  useEffect(() => {
    if (!isRemote || loadedSource === resolvedSrc || timedOutSource === resolvedSrc) return;
    const timeout = window.setTimeout(() => setTimedOutSource(resolvedSrc), 4500);
    return () => window.clearTimeout(timeout);
  }, [isRemote, loadedSource, resolvedSrc, timedOutSource]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      sizes={sizes}
      fetchPriority={loading === 'eager' ? 'high' : 'auto'}
      className={className}
      decoding="async"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={() => { setLoadedSource(resolvedSrc); }}
      onError={() => {
        if (currentSrc === fallbackSrc) return;
        setFailure({ source: resolvedSrc, level: level === 0 ? 1 : 2 });
      }}
    />
  );
}
