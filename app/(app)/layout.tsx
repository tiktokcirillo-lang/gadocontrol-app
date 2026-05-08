'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { AppHeader } from '@/components/layout/AppHeader';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { getDB } from '@/lib/db';
import { getPeaoOwner } from '@/lib/codigoPeao';
import { verificarAlertasSaude } from '@/lib/pushNotifications';
import { Loader2 } from 'lucide-react';
import { DBProvider } from '@/contexts/DBContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      const db = getDB();
      const done = db.meta.onboardingDone;
      if (!done) setShowOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    // Permite acesso de peões (anon auth) ou bloqueados sem auth
    const isPeao = !!getPeaoOwner();
    if (!loading && !user && !isPeao) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!getPeaoOwner()) return;
    const allowed = ['/campo', '/animais', '/saude', '/estoque'];
    const ok = allowed.some(p => pathname === p || pathname.startsWith(p + '/'));
    if (!ok) router.replace('/campo');
  }, [pathname, router]);

  // Verifica alertas sanitários na inicialização (apenas uma vez)
  useEffect(() => {
    if (!user) return;
    const db = getDB();
    // Delay para não travar o render inicial
    const t = setTimeout(() => void verificarAlertasSaude(db), 5000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #1a2e1a 0%, #2D6A2F 100%)' }}>
        <div className="flex flex-col items-center gap-3 text-white">
          <span className="text-4xl">🐄</span>
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm opacity-70">Carregando GadoControl...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto">
      <AppHeader />
      <main className="flex-1 overflow-y-auto pb-20 px-3 pt-3">
        <DBProvider>{children}</DBProvider>
      </main>
      <BottomNav />
      {showOnboarding && <OnboardingTour onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}
