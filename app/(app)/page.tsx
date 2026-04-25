'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useDB } from '@/hooks/useDB';
import { sumCabecas, fmtMoney } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';

export default function DashboardPage() {
  const { user, plan, inTrial, trialDaysLeft } = useAuth();
  const { db } = useDB();

  const firstName = (user?.displayName ?? user?.email ?? 'Produtor').split(' ')[0];
  const vivos     = (db.animais ?? []).filter(a => a.status === 'Vivo');
  const totalCab  = sumCabecas(vivos);
  const vendidos  = (db.animais ?? []).filter(a => a.status === 'Vendido');
  const recTotal  = vendidos.reduce((s, a) => s + (a.precoVenda ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Boas-vindas */}
      <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #2D6A2F, #15803d)' }}>
        <p className="text-sm opacity-80">Olá, {firstName} 👋</p>
        <h1 className="text-xl font-black mt-0.5">Minha Fazenda</h1>
        <div className="flex items-center gap-2 mt-2">
          {plan === 'pro' ? (
            <Badge className="bg-white/20 text-white border-0 text-xs">
              <Crown size={10} className="mr-1" /> Plano Pro
            </Badge>
          ) : inTrial ? (
            <Badge className="bg-white/20 text-white border-0 text-xs">
              Beta · {trialDaysLeft} dias restantes
            </Badge>
          ) : (
            <Badge className="bg-white/20 text-white border-0 text-xs">Plano Grátis</Badge>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Cabeças Vivas" value={String(totalCab)} icon="🐄" />
        <KpiCard label="Receita Total" value={fmtMoney(recTotal)} icon="💰" />
        <KpiCard label="Animais Vendidos" value={String(vendidos.length)} icon="🤝" />
        <KpiCard label="Eventos" value={String(db.eventos?.length ?? 0)} icon="📋" />
      </div>

      {/* Alertas rápidos */}
      <QuickAlerts db={db} />
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl mb-1">{icon}</div>
        <div className="text-xl font-black leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

function QuickAlerts({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const hoje   = new Date();
  const alerts: string[] = [];

  // Partos próximos
  const partos = (db.animais ?? []).filter(a => {
    if (!a.dataPrevistoParto) return false;
    const diff = Math.ceil((new Date(a.dataPrevistoParto).getTime() - hoje.getTime()) / 86400000);
    return diff >= 0 && diff <= 30;
  });
  if (partos.length > 0) alerts.push(`${partos.length} parto(s) esperado(s) nos próximos 30 dias`);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold flex items-center gap-1">
        <AlertTriangle size={14} className="text-amber-500" /> Alertas
      </h2>
      {alerts.map((a, i) => (
        <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
          <Calendar size={14} className="mt-0.5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">{a}</p>
        </div>
      ))}
    </div>
  );
}
