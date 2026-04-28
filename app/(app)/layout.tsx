'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { AppHeader } from '@/components/layout/AppHeader';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { getDB } from '@/lib/db';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      const db = getDB();
      const done = db.meta.onboardingDone;
      if (!done) setShowOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

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
        {children}
      </main>
      <BottomNav />
      {showOnboarding && <OnboardingTour onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}
