import type { ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import AssistantWidget from '@/components/AssistantWidget';
export default function PageShell({ children }: { children: ReactNode }) {
  return <><SiteHeader /><main className="section-shell min-h-[60vh] py-8 sm:py-12">{children}</main><SiteFooter /><AssistantWidget /></>;
}
