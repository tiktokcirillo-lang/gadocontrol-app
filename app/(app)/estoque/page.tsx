'use client';
import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Minus, AlertTriangle, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/hooks/useDB';
import { fmtDate, fmtMoney, diffDays, today } from '@/lib/db';
import { EstoqueForm } from '@/components/estoque/EstoqueForm';
import type { EstoqueCategoria } from '@/lib/types';

const CAT_ICON: Record<EstoqueCategoria, string> = {
  'Vacina':            '💉',
  'Medicamento':       '💊',
  'Vermífugo':         '🔵',
  'Carrapaticida':     '🪣',
  'Suplemento Mineral':'🪨',
  'Ração / Sal':       '🌾',
  'Equipamento':       '🔧',
  'Outro':             '📦',
};

const TODAS_CATS: (EstoqueCategoria | 'todas')[] = [
  'todas', 'Vacina', 'Medicamento', 'Vermífugo', 'Carrapaticida',
  'Suplemento Mineral', 'Ração / Sal', 'Equipamento', 'Outro',
];

const VENCIMENTO_ALERTA = 30; // dias

export default function EstoquePage() {
  const { db, update } = useDB();

  const [formOpen, setFormOpen]     = useState(false);
  const [editId,   setEditId]       = useState<string | null>(null);
  const [catFilt,  setCatFilt]      = useState<EstoqueCategoria | 'todas'>('todas');
  const [busca,    setBusca]        = useState('');

  const estoque = db.estoque ?? [];
  const hoje    = today();

  // Alertas
  const alertasBaixo = useMemo(() =>
    estoque.filter(i =>
      i.quantidadeMinima != null && i.quantidade <= i.quantidadeMinima,
    ), [estoque]);

  const alertasValidade = useMemo(() =>
    estoque.filter(i =>
      i.dataValidade &&
      diffDays(hoje, i.dataValidade) <= VENCIMENTO_ALERTA &&
      diffDays(hoje, i.dataValidade) >= 0,
    ), [estoque, hoje]);

  const alertasVencidos = useMemo(() =>
    estoque.filter(i =>
      i.dataValidade && i.dataValidade < hoje,
    ), [estoque, hoje]);

  const totalAlertas = alertasBaixo.length + alertasValidade.length + alertasVencidos.length;

  // Lista filtrada
  const lista = useMemo(() => {
    const q = busca.toLowerCase();
    return estoque
      .filter(i => {
        if (catFilt !== 'todas' && i.categoria !== catFilt) return false;
        if (q && !i.nome.toLowerCase().includes(q) && !i.categoria.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [estoque, catFilt, busca]);

  // Valor total do estoque
  const valorTotal = useMemo(() =>
    estoque.reduce((s, i) => s + (i.precoUnitario ?? 0) * i.quantidade, 0),
    [estoque],
  );

  function abrirForm(id?: string) {
    setEditId(id ?? null);
    setFormOpen(true);
  }

  function deletar(id: string, nome: string) {
    if (!confirm(`Remover "${nome}" do estoque?`)) return;
    update(d => {
      d.estoque = (d.estoque ?? []).filter(i => i.id !== id);
    });
    toast.success('Produto removido do estoque.');
  }

  function ajustarQtd(id: string, delta: number) {
    update(d => {
      const item = (d.estoque ?? []).find(i => i.id === id);
      if (!item) return;
      item.quantidade = Math.max(0, item.quantidade + delta);
      item.updatedAt  = new Date().toISOString();
    });
  }

  function statusCor(i: typeof estoque[0]) {
    if (i.dataValidade && i.dataValidade < hoje) return 'text-red-600';
    if (i.quantidadeMinima != null && i.quantidade <= i.quantidadeMinima) return 'text-amber-600';
    if (i.dataValidade && diffDays(hoje, i.dataValidade) <= VENCIMENTO_ALERTA) return 'text-orange-500';
    return 'text-green-700';
  }

  function badgeAlerta(i: typeof estoque[0]): string | null {
    if (i.dataValidade && i.dataValidade < hoje) return 'VENCIDO';
    if (i.dataValidade && diffDays(hoje, i.dataValidade) <= VENCIMENTO_ALERTA)
      return `Vence em ${diffDays(hoje, i.dataValidade)}d`;
    if (i.quantidadeMinima != null && i.quantidade <= i.quantidadeMinima) return 'ESTOQUE BAIXO';
    return null;
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Estoque</h1>
        <button
          onClick={() => abrirForm()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ background: '#2D6A2F' }}>
          <Plus className="h-3.5 w-3.5" /> Novo Produto
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <MiniKpi label="Itens Cadastrados" value={String(estoque.length)} cor="text-foreground" />
        <MiniKpi label="Alertas"
          value={String(totalAlertas)}
          cor={totalAlertas > 0 ? 'text-red-600' : 'text-green-700'} />
        <MiniKpi label="Vencendo (30d)"
          value={String(alertasValidade.length + alertasVencidos.length)}
          cor={alertasVencidos.length > 0 ? 'text-red-600' : alertasValidade.length > 0 ? 'text-amber-600' : 'text-green-700'} />
        <MiniKpi label="Valor Total"
          value={valorTotal > 0 ? fmtMoney(valorTotal) : '—'}
          cor="text-foreground" />
      </div>

      {/* Painel de alertas */}
      {totalAlertas > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm font-black text-red-800">Atenção!</p>
          </div>
          {alertasVencidos.map(i => (
            <AlertaRow key={i.id} emoji="❌" texto={`${i.nome} — VENCIDO em ${fmtDate(i.dataValidade)}`} />
          ))}
          {alertasValidade.map(i => (
            <AlertaRow key={i.id} emoji="⚠️"
              texto={`${i.nome} — vence em ${diffDays(hoje, i.dataValidade!)} dias (${fmtDate(i.dataValidade)})`} />
          ))}
          {alertasBaixo.map(i => (
            <AlertaRow key={i.id} emoji="📉"
              texto={`${i.nome} — ${i.quantidade} ${i.unidade} (mínimo: ${i.quantidadeMinima} ${i.unidade})`} />
          ))}
        </div>
      )}

      {/* Busca */}
      <input
        type="search"
        placeholder="Buscar produto..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background"
      />

      {/* Filtro por categoria */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {TODAS_CATS.map(c => (
          <button key={c} onClick={() => setCatFilt(c)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              catFilt === c ? 'text-white border-transparent' : 'text-muted-foreground'
            }`}
            style={catFilt === c ? { background: '#2D6A2F' } : {}}>
            {c === 'todas' ? 'Todos' : `${CAT_ICON[c as EstoqueCategoria]} ${c}`}
          </button>
        ))}
      </div>

      {/* Lista de produtos */}
      {lista.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center space-y-2">
          <PackageX className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-bold">
            {estoque.length === 0 ? 'Estoque vazio' : 'Nenhum produto encontrado'}
          </p>
          <p className="text-xs text-muted-foreground">
            {estoque.length === 0
              ? 'Adicione vacinas, medicamentos e insumos da fazenda.'
              : 'Tente mudar o filtro ou a busca.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y overflow-hidden">
          {lista.map(item => {
            const badge = badgeAlerta(item);
            const cor   = statusCor(item);
            return (
              <div key={item.id} className="px-3 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-xl shrink-0 mt-0.5">{CAT_ICON[item.categoria] ?? '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate">{item.nome}</p>
                      {badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          badge === 'VENCIDO' ? 'bg-red-100 text-red-700' :
                          badge === 'ESTOQUE BAIXO' ? 'bg-amber-100 text-amber-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.categoria}
                      {item.lote ? ` · Lote: ${item.lote}` : ''}
                      {item.dataValidade ? ` · Val: ${fmtDate(item.dataValidade)}` : ''}
                    </p>
                    {item.fornecedor && (
                      <p className="text-[11px] text-muted-foreground">{item.fornecedor}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => abrirForm(item.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deletar(item.id, item.nome)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quantidade + ajuste rápido */}
                <div className="flex items-center justify-between mt-2 pl-7">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => ajustarQtd(item.id, -1)}
                      className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className={`text-sm font-black min-w-[60px] text-center ${cor}`}>
                      {item.quantidade} {item.unidade}
                    </span>
                    <button
                      onClick={() => ajustarQtd(item.id, 1)}
                      className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  {item.precoUnitario && (
                    <span className="text-xs text-muted-foreground">
                      {fmtMoney(item.precoUnitario)}/{item.unidade}
                      {' · '}
                      <span className="font-semibold text-foreground">
                        Total: {fmtMoney(item.precoUnitario * item.quantidade)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EstoqueForm
        open={formOpen}
        itemId={editId}
        onClose={() => { setFormOpen(false); setEditId(null); }}
      />
    </div>
  );
}

function MiniKpi({ label, value, cor }: { label: string; value: string; cor: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className={`text-base font-black ${cor}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function AlertaRow({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span>{emoji}</span>
      <span className="text-red-900">{texto}</span>
    </div>
  );
}
