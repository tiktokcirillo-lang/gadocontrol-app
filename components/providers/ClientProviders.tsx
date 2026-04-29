'use client';
import dynamic from 'next/dynamic';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';

// Carrega AuthProvider apenas no browser — nunca durante SSR/prerender.
// Isso evita que o Firebase SDK seja avaliado no servidor, onde não há
// suporte a browser APIs e as NEXT_PUBLIC_ vars não estão disponíveis.
const AuthProvider = dynamic(
  () => import('@/contexts/AuthContext').then(m => ({ default: m.AuthProvider })),
  { ssr: false, loading: () => null }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        <Toaster richColors position="top-center" />
        <ServiceWorkerRegistrar />
      </AuthProvider>
    </ThemeProvider>
  );
}
