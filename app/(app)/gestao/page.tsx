'use client';
import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/hooks/useDB';
import { addDias, diffDays, fmtDate, today, uid } from '@/lib/db';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CAT_ICON } from '@/lib/types';
import type { AnimalCategoria } from '@/lib/types';

type Tab = 'ciclos' | 'iatf' | 'lotes' | 'metas';

// Dias esperados de cada etapa a partir do D0
const IATF_DIAS = { D8: 8, D17: 17, IA: 19 };

export default function GestaoPage() {
  const { db } = useDB();
  const [tab, setTab] = useState<Tab>('ciclos');

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-xl mx-auto">
      <h1 className="text-xl font-black">Gestão</h1>

      {/* Tabs */}
      <div className="grid grid-cols-4 rounded-lg border p-1 gap-1">
        {([
          { key: 'ciclos', label: '🔄 Ciclos' },
          { key: 'iatf',   label: '🔬 IATF'   },
          { key: 'lotes',  label: '🌿 Lotes'  },
          { key: 'metas',  label: '🎯 Metas'  },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-md py-2 text-[11px] font-bold transition-colors ${tab === t.key ? 'text-white' : 'text-muted-foreground'}`}
            style={tab === t.key ? { background: '#2D6A2F' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ciclos' && <TabCiclos db={db} />}
      {tab === 'iatf'   && <TabIATF   db={db} />}
      {tab === 'lotes'  && <TabLotes  db={db} />}
      {tab === 'metas'  && <TabMetas  db={db} />}
    </div>
  );
}

// ─── Aba Ciclos ──────────────────────────────────────────────────────────────

function TabCiclos({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const hoje = today();
  const animais = db.animais ?? [];
  const vivos   = animais.filter(a => a.status === 'Vivo');

  // ── Bezerros (≤ 6 meses) ──────────────────────────────────────────────────
  const bezerros = vivos.filter(a =>
    (a.categoria === 'Bezerro' || a.categoria === 'Bezerra') &&
    a.dataNascimento &&
    diffDays(a.dataNascimento, hoje) <= 210,
  );
  // Próximos ao desmame (4-7 meses)
  const proximosDesmame = bezerros.filter(a => {
    const dias = diffDays(a.dataNascimento!, hoje);
    return dias >= 120 && dias <= 210;
  });

  // ── Desmamados em recria ──────────────────────────────────────────────────
  const desmamados = vivos.filter(a =>
    a.categoria === 'Desmamado' || a.categoria === 'Novilha',
  );
  const PESO_NOVILHO_VENDA = 420;
  const prontoNovilho = desmamados.filter(a => (a.pesoAtual ?? 0) >= PESO_NOVILHO_VENDA);

  // ── Novilhos/Bois para abate ──────────────────────────────────────────────
  const novilhos = vivos.filter(a =>
    a.categoria === 'Novilho' || a.categoria === 'Boi',
  );
  const PESO_ABATE = db.meta?.pesoAlvoVenda ?? 480;
  const prontosAbate  = novilhos.filter(a => (a.pesoAtual ?? 0) >= PESO_ABATE);
  const pertoAbate    = novilhos.filter(a => {
    const p = a.pesoAtual ?? 0;
    return p < PESO_ABATE && p >= PESO_ABATE * 0.88;
  });

  // ── Matrizes ──────────────────────────────────────────────────────────────
  const matrizes = vivos.filter(a => a.categoria === 'Matriz');
  const prenhas  = matrizes.filter(a => a.statusReprodutivo === 'Prenhe');
  const vazias   = matrizes.filter(a => a.statusReprodutivo === 'Vazia');
  const paridas  = matrizes.filter(a => a.statusReprodutivo === 'Parida');
  const semStatus = matrizes.filter(a => !a.statusReprodutivo);

  // Partos previstos próximos (30 dias)
  const partosProximos = matrizes.filter(a =>
    a.dataPrevistoParto &&
    diffDays(hoje, a.dataPrevistoParto) >= 0 &&
    diffDays(hoje, a.dataPrevistoParto) <= 30,
  );

  // ── Touros ────────────────────────────────────────────────────────────────
  const touros = vivos.filter(a => a.categoria === 'Touro');

  return (
    <div className="space-y-4">

      {/* KPIs do rebanho */}
      <div className="grid grid-cols-4 gap-2">
        <MiniKpi label="Bezerros"   value={String(bezerros.length)}   cor="text-amber-600"  />
        <MiniKpi label="Recria"     value={String(desmamados.length)} cor="text-blue-600"   />
        <MiniKpi label="Matrizes"   value={String(matrizes.length)}   cor="text-purple-600" />
        <MiniKpi label="Touros"     value={String(touros.length)}     cor="text-foreground" />
      </div>

      {/* ── Ciclo Bezerros ────────────────────────────────────────────────── */}
      <CicloCard
        titulo="🐮 Bezerros"
        subtitulo={`${bezerros.length} no rebanho`}
        cor="amber">
        <div className="space-y-2">
          <CicloRow label="Total de bezerros"        valor={bezerros.length}         cor="text-foreground" />
          <CicloRow label="Próximos ao desmame (4-7m)" valor={proximosDesmame.length} cor="text-amber-600" />
          {proximosDesmame.length > 0 && (
            <div className="mt-2 space-y-1">
              {proximosDesmame.slice(0, 5).map(a => (
                <div key={a.id} className="flex justify-between text-xs px-1">
                  <span className="font-medium truncate max-w-[55%]">{a.brinco || a.nomeGrupo}</span>
                  <span className="text-muted-foreground">
                    {diffDays(a.dataNascimento!, hoje)}d · {fmtDate(a.dataNascimento)}
                  </span>
                </div>
              ))}
              {proximosDesmame.length > 5 && (
                <p className="text-[11px] text-muted-foreground px-1">+{proximosDesmame.length - 5} mais</p>
              )}
            </div>
          )}
        </div>
      </CicloCard>

      {/* ── Ciclo Recria ──────────────────────────────────────────────────── */}
      <CicloCard
        titulo="📈 Recria (Desmamados / Novilhas)"
        subtitulo={`${desmamados.length} em recria`}
        cor="blue">
        <div className="space-y-2">
          <CicloRow label="Em recria" valor={desmamados.length} cor="text-foreground" />
          <CicloRow label={`Prontos para próxima fase (≥ ${PESO_NOVILHO_VENDA}kg)`} valor={prontoNovilho.length} cor="text-green-700" />
          {desmamados.filter(a => a.pesoAtual).length > 0 && (
            <div className="mt-1">
              <p className="text-[11px] text-muted-foreground mb-1">Peso médio:</p>
              <p className="text-sm font-black">
                {(desmamados.filter(a => a.pesoAtual)
                  .reduce((s, a) => s + a.pesoAtual!, 0) /
                  desmamados.filter(a => a.pesoAtual).length
                ).toFixed(0)} kg
              </p>
            </div>
          )}
        </div>
      </CicloCard>

      {/* ── Ciclo Terminação (Novilhos/Bois) ─────────────────────────────── */}
      <CicloCard
        titulo="🥩 Terminação (Novilhos / Bois)"
        subtitulo={`${novilhos.length} em terminação · Meta: ${PESO_ABATE}kg`}
        cor="green">
        <div className="space-y-2">
          <CicloRow label={`Prontos para venda (≥ ${PESO_ABATE}kg)`} valor={prontosAbate.length}  cor="text-green-700"  />
          <CicloRow label={`Perto (≥ ${Math.round(PESO_ABATE * 0.88)}kg)`}    valor={pertoAbate.length}   cor="text-amber-600"  />
          <CicloRow label="Ainda em ganho"                            valor={novilhos.length - prontosAbate.length - pertoAbate.length} cor="text-muted-foreground" />
          {prontosAbate.length > 0 && (
            <div className="mt-2 space-y-1">
              {prontosAbate.slice(0, 5).map(a => (
                <div key={a.id} className="flex justify-between text-xs px-1">
                  <span className="font-medium truncate max-w-[55%]">{a.brinco || a.nomeGrupo}</span>
                  <span className="text-green-700 font-bold">{a.pesoAtual}kg</span>
                </div>
              ))}
              {prontosAbate.length > 5 && (
                <p className="text-[11px] text-muted-foreground px-1">+{prontosAbate.length - 5} mais</p>
              )}
            </div>
          )}
        </div>
      </CicloCard>

      {/* ── Ciclo Reprodutivo (Matrizes) ──────────────────────────────────── */}
      <CicloCard
        titulo="🐄 Ciclo Reprodutivo (Matrizes)"
        subtitulo={`${matrizes.length} matrizes`}
        cor="purple">
        <div className="space-y-2">
          <CicloRow label="Prenhas"                valor={prenhas.length}    cor="text-green-700"  />
          <CicloRow label="Paridas (pós-parto)"    valor={paridas.length}    cor="text-blue-600"   />
          <CicloRow label="Vazias"                 valor={vazias.length}     cor="text-amber-600"  />
          <CicloRow label="Sem diagnóstico"        valor={semStatus.length}  cor="text-muted-foreground" />
          {partosProximos.length > 0 && (
            <>
              <p className="text-[11px] font-bold text-purple-700 mt-2 uppercase tracking-wide">
                Partos previstos (próximos 30 dias):
              </p>
              {partosProximos
                .sort((a, b) => (a.dataPrevistoParto ?? '').localeCompare(b.dataPrevistoParto ?? ''))
                .map(a => (
                  <div key={a.id} className="flex justify-between text-xs px-1">
                    <span className="font-medium truncate max-w-[55%]">{a.brinco || a.nomeGrupo}</span>
                    <span className="font-bold text-purple-700">
                      {fmtDate(a.dataPrevistoParto)} · {diffDays(hoje, a.dataPrevistoParto!)}d
                    </span>
                  </div>
                ))}
            </>
          )}
        </div>
      </CicloCard>

    </div>
  );
}

function CicloCard({ titulo, subtitulo, cor, children }: {
  titulo: string; subtitulo: string; cor: 'amber' | 'blue' | 'green' | 'purple';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const colors = {
    amber:  { header: 'bg-amber-50 border-amber-200',  title: 'text-amber-800',  sub: 'text-amber-600'  },
    blue:   { header: 'bg-blue-50  border-blue-200',   title: 'text-blue-800',   sub: 'text-blue-600'   },
    green:  { header: 'bg-green-50 border-green-200',  title: 'text-green-800',  sub: 'text-green-600'  },
    purple: { header: 'bg-purple-50 border-purple-200', title: 'text-purple-800', sub: 'text-purple-600' },
  }[cor];
  return (
    <div className={`rounded-xl border overflow-hidden ${colors.header}`}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div>
          <p className={`font-black text-sm ${colors.title}`}>{titulo}</p>
          <p className={`text-[11px] ${colors.sub}`}>{subtitulo}</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 bg-white border-t">{children}</div>}
    </div>
  );
}

function CicloRow({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="flex justify-between items-center text-sm pt-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-black ${cor}`}>{valor}</span>
    </div>
  );
}

// ─── Aba IATF ────────────────────────────────────────────────────────────────

function TabIATF({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const hoje = today();

  const protocolos = useMemo(() => {
    const eventos = db.eventos ?? [];

    // D0 mais recente por animal
    const d0Map: Record<string, string> = {};
    eventos
      .filter(e => e.tipo === 'IATF — D0 (Início Protocolo)')
      .forEach(e => {
        if (!d0Map[e.brincoAnimal] || e.data > d0Map[e.brincoAnimal]) {
          d0Map[e.brincoAnimal] = e.data;
        }
      });

    return Object.entries(d0Map).map(([brinco, d0]) => {
      const animal = (db.animais ?? []).find(a => a.brinco === brinco);
      const after  = eventos.filter(e => e.brincoAnimal === brinco && e.data >= d0);

      const d8Date  = after.find(e => e.tipo === 'IATF — D8 (Prostaglandina)')?.data;
      const d17Date = after.find(e => e.tipo === 'IATF — D17 (Retirada + EB)')?.data;
      const iaDate  = after.find(e => e.tipo === 'IATF — Inseminação')?.data;

      return {
        brinco, animal,
        d0, d8Date, d17Date, iaDate,
        concluido:   !!iaDate,
        d8Esperado:  addDias(d0, IATF_DIAS.D8),
        d17Esperado: addDias(d0, IATF_DIAS.D17),
        iaEsperado:  addDias(d0, IATF_DIAS.IA),
      };
    }).sort((a, b) => b.d0.localeCompare(a.d0));
  }, [db]);

  const ativos    = protocolos.filter(p => !p.concluido);
  const concluidos = protocolos.filter(p => p.concluido);
  const [showConc, setShowConc] = useState(false);

  function proximaAcao(p: typeof protocolos[0]): { acao: string; data: string; diasRestantes: number } {
    if (!p.d8Date)  return { acao: 'Prostaglandina (D8)',  data: p.d8Esperado,  diasRestantes: diffDays(hoje, p.d8Esperado)  };
    if (!p.d17Date) return { acao: 'Retirada + EB (D17)', data: p.d17Esperado, diasRestantes: diffDays(hoje, p.d17Esperado) };
    return              { acao: 'Inseminação',             data: p.iaEsperado,  diasRestantes: diffDays(hoje, p.iaEsperado)  };
  }

  function corDias(d: number): string {
    if (d < 0)  return 'text-red-600 bg-red-50 border-red-200';
    if (d === 0) return 'text-amber-700 bg-amber-50 border-amber-200';
    if (d <= 3)  return 'text-orange-700 bg-orange-50 border-orange-200';
    return              'text-green-700 bg-green-50 border-green-200';
  }

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Protocolos Ativos"  value={String(ativos.length)}    cor="text-foreground" />
        <MiniKpi label="Vencidos / Urgentes"
          value={String(ativos.filter(p => diffDays(hoje, proximaAcao(p).data) <= 0).length)}
          cor="text-red-600" />
        <MiniKpi label="Concluídos"         value={String(concluidos.length)} cor="text-green-700" />
      </div>

      {ativos.length === 0 && (
        <div className="rounded-xl border bg-card p-6 text-center space-y-1">
          <p className="text-sm font-bold">Nenhum protocolo ativo</p>
          <p className="text-xs text-muted-foreground">
            Registre um evento "IATF — D0" em uma matriz para iniciar um protocolo.
          </p>
        </div>
      )}

      {/* Protocolos ativos */}
      {ativos.map(p => {
        const prox = proximaAcao(p);
        const cor  = corDias(prox.diasRestantes);
        const steps = [
          { label: 'D0',  done: true,         data: p.d0 },
          { label: 'D8',  done: !!p.d8Date,   data: p.d8Date  ?? p.d8Esperado  },
          { label: 'D17', done: !!p.d17Date,  data: p.d17Date ?? p.d17Esperado },
          { label: 'IA',  done: !!p.iaDate,   data: p.iaDate  ?? p.iaEsperado  },
        ];

        return (
          <div key={p.brinco} className="rounded-xl border bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
              <span className="text-xl">{CAT_ICON[p.animal?.categoria as AnimalCategoria] ?? '🐄'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm truncate">{p.brinco}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.animal?.categoria} · Início: {fmtDate(p.d0)}
                </p>
              </div>
              <div className={`text-[10px] font-black px-2 py-1 rounded-full border ${cor}`}>
                {prox.diasRestantes < 0
                  ? `${Math.abs(prox.diasRestantes)}d atraso`
                  : prox.diasRestantes === 0
                  ? 'HOJE'
                  : `${prox.diasRestantes}d`}
              </div>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-0 px-4 py-3">
              {steps.map((s, i) => (
                <div key={s.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 ${
                      s.done ? 'bg-green-600 border-green-600 text-white' : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                    }`}>
                      {s.done ? '✓' : s.label}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-0.5">{fmtDate(s.data)}</span>
                  </div>
                  {i < 3 && (
                    <div className={`h-0.5 flex-1 -mt-4 ${s.done ? 'bg-green-500' : 'bg-muted-foreground/20'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Próxima ação */}
            <div className={`px-4 py-2 border-t text-xs font-bold ${cor.split(' ')[0]}`}>
              Próxima ação: {prox.acao} — {fmtDate(prox.data)}
            </div>
          </div>
        );
      })}

      {/* Concluídos (colapsável) */}
      {concluidos.length > 0 && (
        <div>
          <button
            onClick={() => setShowConc(v => !v)}
            className="flex items-center gap-2 text-xs font-bold text-muted-foreground py-2">
            {showConc ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Protocolos Concluídos ({concluidos.length})
          </button>
          {showConc && (
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              {concluidos.map(p => (
                <div key={p.brinco} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-base">{CAT_ICON[p.animal?.categoria as AnimalCategoria] ?? '🐄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.brinco}</p>
                    <p className="text-[11px] text-muted-foreground">D0: {fmtDate(p.d0)} · IA: {fmtDate(p.iaDate)}</p>
                  </div>
                  <span className="text-xs font-black text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ Inseminada</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Aba Lotes ───────────────────────────────────────────────────────────────

function TabLotes({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const { update } = useDB();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editLote,  setEditLote]  = useState<{ id: string; nome: string; descricao: string } | null>(null);
  const [nome,      setNome]      = useState('');
  const [descricao, setDescricao] = useState('');
  const [expandId,  setExpandId]  = useState<string | null>(null);

  // Animais por lote
  const animaisPorLote = useMemo(() => {
    const map: Record<string, typeof db.animais> = {};
    (db.animais ?? []).filter(a => a.loteId).forEach(a => {
      if (!map[a.loteId!]) map[a.loteId!] = [];
      map[a.loteId!].push(a);
    });
    return map;
  }, [db]);

  function abrirForm(lote?: typeof db.lotes[0]) {
    if (lote) {
      setEditLote({ id: lote.id, nome: lote.nome, descricao: lote.descricao ?? '' });
      setNome(lote.nome);
      setDescricao(lote.descricao ?? '');
    } else {
      setEditLote(null);
      setNome('');
      setDescricao('');
    }
    setSheetOpen(true);
  }

  function salvar() {
    if (!nome.trim()) { toast.error('Informe o nome do lote.'); return; }
    update(d => {
      if (!d.lotes) d.lotes = [];
      if (editLote) {
        const idx = d.lotes.findIndex(l => l.id === editLote.id);
        if (idx !== -1) {
          d.lotes[idx].nome      = nome.trim();
          d.lotes[idx].descricao = descricao.trim() || undefined;
        }
        toast.success('Lote atualizado!');
      } else {
        d.lotes.push({ id: uid(), nome: nome.trim(), descricao: descricao.trim() || undefined, createdAt: new Date().toISOString() });
        toast.success('Lote criado!');
      }
    });
    setSheetOpen(false);
  }

  function deletar(id: string, nome: string) {
    if (!confirm(`Remover lote "${nome}"? Os animais não serão excluídos.`)) return;
    update(d => {
      d.lotes = (d.lotes ?? []).filter(l => l.id !== id);
      (d.animais ?? []).forEach(a => { if (a.loteId === id) delete a.loteId; });
    });
    toast.success('Lote removido.');
  }

  const lotes = db.lotes ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{lotes.length} lote{lotes.length !== 1 ? 's' : ''} cadastrado{lotes.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => abrirForm()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ background: '#2D6A2F' }}>
          <Plus className="h-3.5 w-3.5" /> Novo Lote
        </button>
      </div>

      {lotes.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center space-y-1">
          <p className="text-sm font-bold">Nenhum lote cadastrado</p>
          <p className="text-xs text-muted-foreground">
            Crie lotes para organizar seus animais por pasto, curral ou grupo.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y overflow-hidden">
          {lotes.map(lote => {
            const animais  = animaisPorLote[lote.id] ?? [];
            const expanded = expandId === lote.id;
            return (
              <div key={lote.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpandId(expanded ? null : lote.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0">
                    <span className="text-lg shrink-0">🌿</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{lote.nome}</p>
                      {lote.descricao && (
                        <p className="text-[11px] text-muted-foreground truncate">{lote.descricao}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-muted-foreground shrink-0 mr-1">
                      {animais.length} anim.
                    </span>
                    {expanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </button>
                  <button onClick={() => abrirForm(lote)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deletar(lote.id, lote.nome)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {expanded && (
                  <div className="border-t bg-muted/20 divide-y">
                    {animais.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-4 py-3 italic">
                        Nenhum animal neste lote. Edite um animal e atribua este lote.
                      </p>
                    ) : animais.map(a => (
                      <div key={a.id} className="flex items-center gap-2 px-4 py-2">
                        <span className="text-sm">{CAT_ICON[a.categoria] ?? '🐄'}</span>
                        <span className="text-sm font-medium flex-1 truncate">{a.brinco || a.nomeGrupo}</span>
                        <span className="text-xs text-muted-foreground">{a.categoria}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sheet para criar/editar lote */}
      <Sheet open={sheetOpen} onOpenChange={v => !v && setSheetOpen(false)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>{editLote ? 'Editar Lote' : 'Novo Lote'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-8">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome do Lote *</Label>
              <Input placeholder="Ex: Pasto Norte, Curral 1, Recria..." value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição</Label>
              <Input placeholder="Opcional" value={descricao} onChange={e => setDescricao(e.target.value)} />
            </div>
            <Button className="w-full font-bold h-11" style={{ background: '#2D6A2F' }} onClick={salvar}>
              {editLote ? 'Salvar Alterações' : 'Criar Lote'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Aba Metas ───────────────────────────────────────────────────────────────

function TabMetas({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const { update } = useDB();
  const meta = db.meta ?? {};

  const [pesoAlvo,    setPesoAlvo]    = useState(String(meta.pesoAlvoVenda ?? ''));
  const [precoArroba, setPrecoArroba] = useState(String(meta.precoArroba   ?? ''));
  const [saving,      setSaving]      = useState(false);

  function salvar() {
    setSaving(true);
    update(d => {
      if (pesoAlvo)    d.meta.pesoAlvoVenda = Number(pesoAlvo);
      if (precoArroba) d.meta.precoArroba   = Number(precoArroba);
    });
    setSaving(false);
    toast.success('Metas salvas!');
  }

  // Análise baseada nas metas
  const animaisVivos = (db.animais ?? []).filter(a => a.status === 'Vivo' && a.pesoAtual);
  const pesoAlvoNum  = Number(pesoAlvo) || 0;
  const arrobaNum    = Number(precoArroba) || 0;
  const ARROBA_KG    = 15;

  const prontos = animaisVivos.filter(a => pesoAlvoNum > 0 && (a.pesoAtual ?? 0) >= pesoAlvoNum);
  const perto   = animaisVivos.filter(a => {
    const p = a.pesoAtual ?? 0;
    return pesoAlvoNum > 0 && p < pesoAlvoNum && p >= pesoAlvoNum * 0.9;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Configurar Metas</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peso Alvo p/ Venda (kg)</Label>
            <Input type="number" min="0" placeholder="Ex: 480"
              value={pesoAlvo} onChange={e => setPesoAlvo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preço da Arroba (R$)</Label>
            <Input type="number" min="0" step="0.01" placeholder="Ex: 320,00"
              value={precoArroba} onChange={e => setPrecoArroba(e.target.value)} />
          </div>
        </div>

        <Button className="w-full font-bold h-10" style={{ background: '#2D6A2F' }}
          onClick={salvar} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Salvar Metas
        </Button>
      </div>

      {/* Análise com base nas metas */}
      {pesoAlvoNum > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
            Animais Prontos para Venda
          </p>

          <div className="grid grid-cols-2 gap-3">
            <MiniKpi label={`✅ Acima de ${pesoAlvoNum}kg`} value={String(prontos.length)} cor="text-green-700" />
            <MiniKpi label={`⏳ Perto (≥ ${Math.round(pesoAlvoNum * 0.9)}kg)`} value={String(perto.length)} cor="text-amber-600" />
          </div>

          {arrobaNum > 0 && prontos.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-[11px] font-black text-green-800 uppercase tracking-widest mb-2">
                Receita estimada (animais prontos)
              </p>
              <p className="text-2xl font-black text-green-700">
                {(prontos.reduce((s, a) => {
                  const arrobas = (a.pesoAtual! * 0.5) / ARROBA_KG;
                  return s + arrobas * arrobaNum;
                }, 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                {prontos.length} animais · R$ {arrobaNum.toLocaleString('pt-BR')}/arroba
              </p>
            </div>
          )}

          {prontos.length > 0 && (
            <div className="rounded-xl border bg-card divide-y overflow-hidden">
              {prontos.slice(0, 10).map(a => {
                const arrobas = arrobaNum > 0 ? ((a.pesoAtual! * 0.5) / ARROBA_KG).toFixed(1) : null;
                const valor   = arrobaNum > 0 ? (parseFloat(arrobas!) * arrobaNum) : null;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base">{CAT_ICON[a.categoria] ?? '🐄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{a.brinco || a.nomeGrupo}</p>
                      <p className="text-[11px] text-muted-foreground">{a.categoria} · {a.pesoAtual}kg</p>
                    </div>
                    {valor && (
                      <span className="text-sm font-black text-green-700">
                        {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function MiniKpi({ label, value, cor }: { label: string; value: string; cor: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className={`text-base font-black ${cor}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
