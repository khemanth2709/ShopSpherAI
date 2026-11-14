import * as React from 'react';
import { cn } from '@/lib/utils';
export function Badge({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) { return <span className={cn('inline-flex items-center rounded-full bg-sage px-2.5 py-1 text-[10px] font-bold text-moss', className)} {...props}>{children}</span>; }
