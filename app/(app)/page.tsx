'use client';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDB } from '@/hooks/useDB';
import { sumCabecas, fmtMoney } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, AlertTriangle, Calendar, MessageCircle } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';

// ─── Cores por categoria ───────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  Bezerro:   '#16a34a', Bezerra: '#22c55e', Desmamado: '#84cc16',
  Novilho:   '#0891b2', Novilha: '#06b6d4', Matriz: '#2D6A2F',
  Touro:     '#7c3aed', Boi:    '#d97706',
};

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function DashboardPage() {
  const { user, plan, inTrial, trialDaysLeft } = useAuth();
  const { db } = useDB();

  const firstName = (user?.displayName ?? user?.email ?? 'Produtor').split(' ')[0];
  const vivos     = (db.animais ?? []).filter(a => a.status === 'Vivo');
  const totalCab  = sumCabecas(vivos);
  const vendidos  = (db.animais ?? []).filter(a => a.status === 'Vendido');
  const recTotal  = vendidos.reduce((s, a) => s + (a.precoVenda ?? 0), 0);
  const hoje      = new Date();

  // ── Gráfico: Nascimentos últimos 12 meses ─────────────────────────────────
  const nascimentosMeses = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      mapa[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
    }
    (db.eventos ?? [])
      .filter(e => e.tipo === 'Nascimento')
      .forEach(e => {
        const key = e.data.slice(0, 7);
        if (key in mapa) mapa[key]++;
      });
    return Object.entries(mapa).map(([key, v]) => ({
      label: MESES_PT[parseInt(key.slice(5)) - 1],
      value: v,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.eventos]);

  // ── Gráfico: Composição do rebanho ────────────────────────────────────────
  const composicao = useMemo(() => {
    const mapa: Record<string, number> = {};
    vivos.forEach(a => {
      const cat = a.categoria ?? 'Outro';
      mapa[cat] = (mapa[cat] ?? 0) + (a.tipo === 'grupo' ? (a.qtdCabecas ?? 1) : 1);
    });
    return Object.entries(mapa)
      .map(([cat, val]) => ({ cat, val }))
      .sort((a, b) => b.val - a.val);
  }, [vivos]);

  // ── Partos previstos 90 dias ───────────────────────────────────────────────
  const partos90 = useMemo(() =>
    vivos
      .filter(a => {
        if (!a.dataPrevistoParto) return false;
        const diff = Math.ceil((new Date(a.dataPrevistoParto).getTime() - hoje.getTime()) / 86400000);
        return diff >= -7 && diff <= 90;
      })
      .sort((a, b) => (a.dataPrevistoParto ?? '').localeCompare(b.dataPrevistoParto ?? ''))
      .slice(0, 10),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [vivos]);

  // ── Alertas ────────────────────────────────────────────────────────────────
  const alertas = useMemo(() => {
    const list: { emoji: string; msg: string; urgente: boolean }[] = [];

    // Partos nos próximos 30 dias
    const partos30 = partos90.filter(a => {
      const diff = Math.ceil((new Date(a.dataPrevistoParto!).getTime() - hoje.getTime()) / 86400000);
      return diff >= 0 && diff <= 30;
    });
    if (partos30.length > 0)
      list.push({ emoji: '🐮', msg: `${partos30.length} parto(s) esperado(s) nos próximos 30 dias`, urgente: true });

    // Bezerros sem desmame (> 90 dias de vida)
    const desmameVencido = vivos.filter(a => {
      if (!['Bezerro','Bezerra'].includes(a.categoria)) return false;
      if (a.dataDesmame) return false;
      if (!a.dataNascimento && !a.createdAt) return false;
      const ref  = new Date(a.dataNascimento ?? a.createdAt);
      const dias = Math.floor((hoje.getTime() - ref.getTime()) / 86400000);
      return dias > 90;
    });
    if (desmameVencido.length > 0)
      list.push({ emoji: '🍼', msg: `${desmameVencido.length} bezerro(s) com desmame atrasado (> 90 dias)`, urgente: true });

    // Matrizes vazias (status reprodutivo Vazia)
    const matrizesVazias = vivos.filter(a =>
      a.categoria === 'Matriz' && a.statusReprodutivo === 'Vazia',
    );
    if (matrizesVazias.length > 0)
      list.push({ emoji: '🔴', msg: `${matrizesVazias.length} matriz(es) com status Vazia`, urgente: matrizesVazias.length >= 5 });

    // Vacinas vencidas no estoque
    const vacsVencidas = (db.estoque ?? []).filter(e => {
      if (!e.dataValidade) return false;
      return new Date(e.dataValidade) < hoje && e.quantidade > 0;
    });
    if (vacsVencidas.length > 0)
      list.push({ emoji: '💉', msg: `${vacsVencidas.length} item(s) do estoque com validade vencida`, urgente: true });

    // Animais sem pesagem há mais de 60 dias
    const pesagens = db.eventos ?? [];
    const semPesagem60 = vivos.filter(a => {
      const brinco = a.brinco || a.nomeGrupo;
      if (!brinco) return false;
      const ultima = pesagens
        .filter(e => e.tipo === 'Pesagem' && e.brincoAnimal === brinco)
        .sort((x, y) => y.data.localeCompare(x.data))[0];
      if (!ultima) return false;
      const dias = Math.floor((hoje.getTime() - new Date(ultima.data).getTime()) / 86400000);
      return dias > 60;
    }).length;
    if (semPesagem60 > 0)
      list.push({ emoji: '⚖️', msg: `${semPesagem60} animal(is) sem pesagem há mais de 60 dias`, urgente: false });

    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vivos, partos90, db.estoque, db.eventos]);

  const alertasUrgentes = alertas.filter(a => a.urgente);

  // ── WhatsApp share ─────────────────────────────────────────────────────────
  function compartilharWhatsApp() {
    const fazNome = db.meta?.fazNome ?? 'GadoControl';
    const dataStr = hoje.toLocaleDateString('pt-BR');
    const linhas  = [`*📊 ${fazNome} — Alertas ${dataStr}*`, ''];
    alertas.forEach(a => linhas.push(`${a.emoji} ${a.urgente ? '*' : ''}${a.msg}${a.urgente ? '*' : ''}`));
    linhas.push('', `*🐄 Total: ${totalCab} cabeças*`);
    const texto = encodeURIComponent(linhas.join('\n'));
    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank');
  }

  return (
    <div className="space-y-4">
      {/* Boas-vindas */}
      <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #2D6A2F, #15803d)' }}>
        <p className="text-sm opacity-80">Olá, {firstName} 👋</p>
        <h1 className="text-xl font-black mt-0.5">{db.meta?.fazNome ?? 'Minha Fazenda'}</h1>
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
        <KpiCard label="Cabeças Vivas"     value={String(totalCab)}          icon="🐄" />
        <KpiCard label="Receita Total"     value={fmtMoney(recTotal)}        icon="💰" />
        <KpiCard label="Animais Vendidos"  value={String(vendidos.length)}   icon="🤝" />
        <KpiCard label="Eventos"           value={String(db.eventos?.length ?? 0)} icon="📋" />
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-1">
              <AlertTriangle size={14} className="text-amber-500" /> Alertas
              {alertasUrgentes.length > 0 && (
                <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-black">
                  {alertasUrgentes.length}
                </span>
              )}
            </h2>
            <button
              onClick={compartilharWhatsApp}
              className="flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400 hover:underline"
            >
              <MessageCircle size={13} />
              WhatsApp
            </button>
          </div>
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${
              a.urgente
                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
            }`}>
              <span className="text-base leading-none mt-0.5 shrink-0">{a.emoji}</span>
              <p className={`text-xs ${a.urgente ? 'text-red-800 dark:text-red-200 font-semibold' : 'text-amber-800 dark:text-amber-200'}`}>
                {a.msg}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Partos previstos 90 dias */}
      {partos90.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1">
            <Calendar size={14} className="text-green-600" /> Partos Previstos (90 dias)
          </h2>
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {partos90.map(a => {
              const diff = Math.ceil((new Date(a.dataPrevistoParto!).getTime() - hoje.getTime()) / 86400000);
              const label = diff < 0 ? `${Math.abs(diff)}d atrás` : diff === 0 ? 'Hoje' : `Em ${diff} dias`;
              const urgent = diff <= 7;
              return (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{a.brinco || a.nomeGrupo}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.categoria} · Parto nº {(a.numeroParto ?? 0) + 1}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    urgent
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  }`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gráfico: Nascimentos 12 meses */}
      {nascimentosMeses.some(m => m.value > 0) && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">
            Nascimentos — Últimos 12 Meses
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={nascimentosMeses} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [String(v ?? 0), 'Nascimentos']} />
              <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico: Composição do rebanho */}
      {composicao.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">
            Composição do Rebanho
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={composicao} layout="vertical" margin={{ top: 0, right: 16, left: 60, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="cat" tick={{ fontSize: 10 }} width={58} />
              <Tooltip formatter={(v) => [String(v ?? 0), 'Cabeças']} />
              <Bar dataKey="val" radius={[0, 4, 4, 0]}>
                {composicao.map((entry) => (
                  <Cell key={entry.cat} fill={CAT_COLORS[entry.cat] ?? '#2D6A2F'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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
