import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/components/QueryProvider';
import StoreHydrator from '@/components/StoreHydrator';
import AuthProvider from '@/components/AuthProvider';
import ToastViewport from '@/components/ToastViewport';

export const metadata: Metadata = {
  title: 'ShopSphere AI — Personalized shopping, powered by intelligence',
  description: 'Discover thoughtful products with transparent, signal-based recommendations and a rule-based shopping assistant.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <StoreHydrator />
          <AuthProvider>{children}</AuthProvider>
          <ToastViewport />
        </QueryProvider>
      </body>
    </html>
  );
}
