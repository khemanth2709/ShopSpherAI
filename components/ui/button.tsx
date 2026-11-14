import * as React from 'react';
import { cn } from '@/lib/utils';
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' };
export function Button({ className, variant = 'primary', size = 'md', ...props }: Props) {
  return <button className={cn('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-ink text-white hover:bg-moss', variant === 'secondary' && 'border border-ink/10 bg-white text-ink hover:bg-sage/50', variant === 'ghost' && 'text-ink hover:bg-ink/5', variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700', size === 'sm' && 'px-3 py-2 text-xs', size === 'md' && 'px-4 py-2.5 text-sm', size === 'lg' && 'px-6 py-3 text-sm', className)} {...props} />;
}
