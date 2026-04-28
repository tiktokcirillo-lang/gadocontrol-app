'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, Beef } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/hooks/useDB';
import { calcReceitas, calcDespesas, periodDates } from '@/lib/eventos';
import { fmtMoney, fmtDate, sumCabecas } from '@/lib/db';
import { LancamentoForm } from '@/components/financial/LancamentoForm';
import { FluxoChart } from '@/components/financial/FluxoChart';
import { DREView } from '@/components/financial/DREView';

type Periodo = 'mes' | 'trim' | 'ano' | 'tudo';
type TabPrincipal = 'visao' | 'dre';

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'mes',  label: 'Mês'    },
  { key: 'trim', label: '3 Meses' },
  { key: 'ano',  label: 'Ano'    },
  { key: 'tudo', label: 'Tudo'   },
];

export default function FinanceiroPage() {
  const { db, update } = useDB();

  const [tab,     setTab]     = useState<TabPrincipal>('visao');
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [formOpen,        setFormOpen]        = useState(false);
  const [editId,          setEditId]          = useState<string | null>(null);
  const [tipoInicial,     setTipoInicial]     = useState<'receita' | 'despesa'>('receita');
  const [filtroTipo,      setFiltroTipo]      = useState<'todos' | 'receita' | 'despesa'>('todos');

  const { de, ate } = periodDates(periodo);
  const receitas    = calcReceitas(db, de, ate);
  const despesas    = calcDespesas(db, de, ate);

  const totRec  = receitas.reduce((s, i) => s + i.valor, 0);
  const totDesp = despesas.reduce((s, i) => s + i.valor, 0);
  const saldo   = totRec - totDesp;
  const cabVivos = sumCabecas((db.animais ?? []).filter(a => a.status === 'Vivo'));
  const custoCab = cabVivos > 0 ? totDesp / cabVivos : 0;

  // Despesas agrupadas por categoria (para barra de progresso)
  const despByCat: Record<string, number> = {};
  despesas.forEach(d => { despByCat[d.cat] = (despByCat[d.cat] ?? 0) + d.valor; });
  const topCats = Object.entries(despByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat  = topCats[0]?.[1] ?? 1;

  // Lista de transações manuais (lancamentos)
  const lancamentos = (db.lancamentos ?? [])
    .filter(l => {
      if (filtroTipo !== 'todos' && l.tipo !== filtroTipo) return false;
      if (de  && l.data < de)  return false;
      if (ate && l.data > ate) return false;
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data));

  function abrirForm(tipo: 'receita' | 'despesa', id?: string) {
    setTipoInicial(tipo);
    setEditId(id ?? null);
    setFormOpen(true);
  }

  function deletarLancamento(id: string) {
    update(d => {
      d.lancamentos = (d.lancamentos ?? []).filter(l => l.id !== id);
    });
    toast.success('Lançamento removido.');
  }

  const positivo = saldo >= 0;

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Financeiro</h1>
        <div className="flex gap-2">
          <button
            onClick={() => abrirForm('receita')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: '#15803d' }}>
            <Plus className="h-3.5 w-3.5" /> Receita
          </button>
          <button
            onClick={() => abrirForm('despesa')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: '#ef4444' }}>
            <Plus className="h-3.5 w-3.5" /> Despesa
          </button>
        </div>
      </div>

      {/* Tabs principais */}
      <div className="flex rounded-lg border p-1 gap-1">
        {(['visao', 'dre'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${tab === t ? 'text-white' : 'text-muted-foreground'}`}
            style={tab === t ? { background: '#2D6A2F' } : {}}>
            {t === 'visao' ? '📊 Visão Geral' : '📋 DRE'}
          </button>
        ))}
      </div>

      {/* Seletor de período (compartilhado) */}
      <div className="flex gap-1.5 flex-wrap">
        {PERIODOS.map(({ key, label }) => (
          <button key={key} onClick={() => setPeriodo(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              periodo === key ? 'text-white border-transparent' : 'text-muted-foreground'
            }`}
            style={periodo === key ? { background: '#2D6A2F' } : {}}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'visao' ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              icon={<TrendingUp className="h-4 w-4 text-green-600" />}
              label="Receitas"
              value={fmtMoney(totRec)}
              color="text-green-700"
            />
            <KpiCard
              icon={<TrendingDown className="h-4 w-4 text-red-500" />}
              label="Despesas"
              value={fmtMoney(totDesp)}
              color="text-red-600"
            />
            <KpiCard
              icon={<Wallet className="h-4 w-4" style={{ color: positivo ? '#15803d' : '#ef4444' }} />}
              label="Saldo"
              value={fmtMoney(saldo)}
              color={positivo ? 'text-green-700' : 'text-red-600'}
            />
            <KpiCard
              icon={<Beef className="h-4 w-4 text-amber-600" />}
              label="Custo/Cabeça"
              value={cabVivos > 0 ? fmtMoney(custoCab) : '—'}
              color="text-amber-700"
            />
          </div>

          {/* Gráfico de fluxo */}
          <div className="rounded-xl border bg-card p-4">
            <FluxoChart db={db} />
          </div>

          {/* Top categorias de despesa */}
          {topCats.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                Top Despesas por Categoria
              </p>
              {topCats.map(([cat, val]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium truncate max-w-[60%]">{cat}</span>
                    <span className="text-muted-foreground">{fmtMoney(val)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(val / maxCat) * 100}%`, background: '#ef4444' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lançamentos manuais */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                Lançamentos Manuais
              </p>
              {/* Filtro tipo */}
              <div className="flex gap-1">
                {(['todos', 'receita', 'despesa'] as const).map(f => (
                  <button key={f} onClick={() => setFiltroTipo(f)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                      filtroTipo === f ? 'text-white border-transparent' : 'text-muted-foreground'
                    }`}
                    style={filtroTipo === f
                      ? { background: f === 'receita' ? '#15803d' : f === 'despesa' ? '#ef4444' : '#2D6A2F' }
                      : {}}>
                    {f === 'todos' ? 'Todos' : f === 'receita' ? 'Receitas' : 'Despesas'}
                  </button>
                ))}
              </div>
            </div>

            {lancamentos.length === 0 ? (
              <div className="rounded-xl border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum lançamento manual no período.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use os botões acima para registrar receitas ou despesas.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card divide-y overflow-hidden">
                {lancamentos.map(l => (
                  <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className={`w-1.5 h-8 rounded-full shrink-0 ${l.tipo === 'receita' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{l.descricao}</p>
                      <p className="text-[11px] text-muted-foreground">{l.cat} · {fmtDate(l.data)}</p>
                    </div>
                    <span className={`text-sm font-black shrink-0 ${l.tipo === 'receita' ? 'text-green-700' : 'text-red-600'}`}>
                      {l.tipo === 'despesa' ? '− ' : '+'}{fmtMoney(l.valor)}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => abrirForm(l.tipo, l.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Remover este lançamento?')) deletarLancamento(l.id);
                        }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nota sobre transações automáticas */}
          {(receitas.some(r => r.origem === 'auto') || despesas.some(d => d.origem === 'auto')) && (
            <p className="text-[10px] text-muted-foreground text-center pb-2">
              Vendas e custos de eventos são capturados automaticamente via registros de animais.
            </p>
          )}
        </>
      ) : (
        <DREView db={db} />
      )}

      <LancamentoForm
        open={formOpen}
        lancamentoId={editId}
        tipoInicial={tipoInicial}
        onClose={() => { setFormOpen(false); setEditId(null); }}
      />
    </div>
  );
}

function KpiCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        {icon}
        {label}
      </div>
      <div className={`text-base font-black ${color}`}>{value}</div>
    </div>
  );
}
