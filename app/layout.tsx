import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title:       'GadoControl — Controle de Rebanho Bovino',
  description: 'Gestão de rebanho bovino offline, no celular. Controle animais, saúde, financeiro e relatórios.',
  manifest:    '/manifest.json',
  icons: {
    icon:  '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GadoControl',
  },
  openGraph: {
    title:       'GadoControl',
    description: 'Controle de Rebanho Bovino — offline, no celular',
    url:         'https://gadocontrole.com',
    siteName:    'GadoControl',
    locale:      'pt_BR',
    type:        'website',
  },
};

export const viewport: Viewport = {
  themeColor:   '#2D6A2F',
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="h-full">
      <body className={`${inter.className} min-h-full antialiased`}>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-center" />
          <ServiceWorkerRegistrar />
        </AuthProvider>
      </body>
    </html>
  );
}
