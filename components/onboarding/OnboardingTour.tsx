'use client';
import { useState } from 'react';
import { Beef, Zap, BarChart2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { saveDB, getDB } from '@/lib/db';
import { gerarDemoDB } from '@/lib/demoData';
import { toast } from 'sonner';

const STEPS = [
  {
    icon: <span className="text-5xl">🐄</span>,
    title: 'Bem-vindo ao GadoControl!',
    desc: 'Gerencie seu rebanho de forma simples e completa — direto do celular, sem precisar de internet.',
    color: '#2D6A2F',
  },
  {
    icon: <Beef size={48} color="#2563eb" />,
    title: 'Cadastre seus animais',
    desc: 'Registre cada animal individualmente ou em grupo. Controle pesagem, SISBOV, raça e histórico completo.',
    color: '#2563eb',
  },
  {
    icon: <Zap size={48} color="#7c3aed" />,
    title: 'Use o Modo Campo',
    desc: 'No cocho ou no curral? O Modo Campo permite registrar eventos com poucos toques, mesmo com as mãos sujas.',
    color: '#7c3aed',
  },
  {
    icon: <BarChart2 size={48} color="#059669" />,
    title: 'Acompanhe resultados',
    desc: 'Relatórios de rebanho, GMD, curva de peso, financeiro e alertas sanitários — tudo em um só lugar.',
    color: '#059669',
  },
];

interface Props {
  onClose: () => void;
}

export function OnboardingTour({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  function loadDemo() {
    setLoadingDemo(true);
    try {
      const demo = gerarDemoDB();
      saveDB(demo);
      toast.success('Dados de exemplo carregados!');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error('Erro ao carregar dados de exemplo.');
      setLoadingDemo(false);
    }
  }

  function finish() {
    const db = getDB();
    db.meta.onboardingDone = true;
    saveDB(db);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-background rounded-t-2xl px-6 pt-8 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300">

        {/* Indicadores de passo */}
        <div className="flex justify-center gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                background: i === step ? s.color : '#e5e7eb',
              }}
            />
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex flex-col items-center text-center gap-4 mb-8">
          <div className="h-20 flex items-center justify-center">
            {s.icon}
          </div>
          <h2 className="text-xl font-black">{s.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
        </div>

        {/* Botões */}
        <div className="space-y-2">
          {isLast ? (
            <>
              <Button
                className="w-full h-11 font-bold text-white"
                style={{ background: s.color }}
                onClick={finish}
              >
                Começar agora
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 font-bold"
                onClick={loadDemo}
                disabled={loadingDemo}
              >
                <Database size={16} className="mr-2" />
                {loadingDemo ? 'Carregando...' : 'Explorar com dados de exemplo'}
              </Button>
            </>
          ) : (
            <>
              <Button
                className="w-full h-11 font-bold text-white"
                style={{ background: s.color }}
                onClick={() => setStep(s => s + 1)}
              >
                Próximo
              </Button>
              <Button variant="ghost" className="w-full h-10 text-muted-foreground text-sm" onClick={finish}>
                Pular
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
