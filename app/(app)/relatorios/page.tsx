'use client';
import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from 'recharts';
import { useDB } from '@/hooks/useDB';
import { fmtMoney, fmtDate, diffDays, getCabecas, sumCabecas } from '@/lib/db';
import { CAT_ICON } from '@/lib/types';
import { gerarRelatorioMensal } from '@/lib/exportar';
import { calcDespesas, periodDates } from '@/lib/eventos';
import type { AnimalCategoria } from '@/lib/types';

type Tab = 'rebanho' | 'desempenho' | 'curva' | 'vendas' | 'projecao' | 'lotes' | 'custos' | 'indices' | 'pdf';

const CORES_CAT: Record<string, string> = {
  Bezerro:   '#f59e0b',
  Bezerra:   '#f97316',
  Desmamado: '#84cc16',
  Novilho:   '#22c55e',
  Novilha:   '#10b981',
  Matriz:    '#3b82f6',
  Touro:     '#8b5cf6',
  Boi:       '#6b7280',
};

const TIPOS_PESAGEM = ['Nascimento', 'Desmame', 'Pesagem', 'Venda'];

// GMD de referência EMBRAPA por fase (kg/dia)
const GMD_REF: Record<string, number> = {
  Bezerro:   0.6,
  Bezerra:   0.5,
  Desmamado: 0.7,
  Novilha:   0.6,
  Novilho:   0.8,
  Boi:       1.0,
  Matriz:    0.4,
  Touro:     0.5,
};

export default function RelatoriosPage() {
  const { db }  = useDB();
  const [tab, setTab] = useState<Tab>('rebanho');

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-xl mx-auto">
      <h1 className="text-xl font-black">Relatórios</h1>

      {/* Tabs — scrollável horizontal para acomodar 6 tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border p-1 scrollbar-none">
        {([
          { key: 'rebanho',    label: '🐄 Rebanho'   },
          { key: 'desempenho', label: '📈 GMD'        },
          { key: 'curva',      label: '📊 Curva'      },
          { key: 'vendas',     label: '💰 Vendas'     },
          { key: 'projecao',   label: '🔮 Projeção'   },
          { key: 'lotes',      label: '🗂 Lotes'      },
          { key: 'custos',     label: '💹 Custos'      },
          { key: 'indices',    label: '📊 Índices'     },
          { key: 'pdf',        label: '📄 PDF Mensal'  },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-md px-3 py-2 text-[11px] font-bold transition-colors ${tab === t.key ? 'text-white' : 'text-muted-foreground'}`}
            style={tab === t.key ? { background: '#2D6A2F' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rebanho'    && <TabRebanho    db={db} />}
      {tab === 'desempenho' && <TabDesempenho db={db} />}
      {tab === 'curva'      && <TabCurva      db={db} />}
      {tab === 'vendas'     && <TabVendas     db={db} />}
      {tab === 'projecao'   && <TabProjecao   db={db} />}
      {tab === 'lotes'      && <TabLotes      db={db} />}
      {tab === 'custos'     && <TabCustos     db={db} />}
      {tab === 'indices'    && <TabIndices    db={db} />}
      {tab === 'pdf'        && <TabPDFMensal  />}
    </div>
  );
}

// ─── Aba Rebanho ─────────────────────────────────────────────────────────────

function TabRebanho({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const animais     = db.animais ?? [];
  const vivos       = animais.filter(a => a.status === 'Vivo');
  const vendidos    = animais.filter(a => a.status === 'Vendido');
  const mortos      = animais.filter(a => a.status === 'Morto');
  const totalCab    = sumCabecas(vivos);

  // Breakdown por categoria
  const porCat: Record<string, number> = {};
  vivos.forEach(a => {
    porCat[a.categoria] = (porCat[a.categoria] ?? 0) + getCabecas(a);
  });
  const catData = Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => ({ cat, n, pct: totalCab > 0 ? (n / totalCab) * 100 : 0 }));

  // Status reprodutivo das matrizes
  const matrizes = vivos.filter(a => a.categoria === 'Matriz');
  const reprStatus: Record<string, number> = {};
  matrizes.forEach(a => {
    const s = a.statusReprodutivo ?? 'Indefinido';
    reprStatus[s] = (reprStatus[s] ?? 0) + 1;
  });

  // Peso médio por categoria (animais com pesoAtual)
  const pesoMedio: Record<string, { soma: number; n: number }> = {};
  vivos.filter(a => a.pesoAtual).forEach(a => {
    if (!pesoMedio[a.categoria]) pesoMedio[a.categoria] = { soma: 0, n: 0 };
    pesoMedio[a.categoria].soma += a.pesoAtual!;
    pesoMedio[a.categoria].n   += 1;
  });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Vivos"   value={String(sumCabecas(vivos))}   cor="text-green-700" />
        <MiniKpi label="Vendidos" value={String(sumCabecas(vendidos))} cor="text-blue-600"  />
        <MiniKpi label="Mortos"  value={String(sumCabecas(mortos))}  cor="text-red-600"   />
      </div>

      {/* Composição por categoria */}
      <Section title="Composição do Rebanho">
        {catData.length === 0
          ? <Vazio msg="Nenhum animal cadastrado." />
          : (
            <>
              <div className="px-4 pb-1">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={catData} barSize={22} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="cat" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip
                      formatter={(v) => typeof v === 'number' ? [`${v} cab.`, 'Cabeças'] : [String(v), 'Cabeças']}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="n" radius={[0, 4, 4, 0]}>
                      {catData.map(({ cat }) => (
                        <Cell key={cat} fill={CORES_CAT[cat] ?? '#2D6A2F'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="divide-y">
                {catData.map(({ cat, n, pct }) => (
                  <div key={cat} className="flex items-center gap-3 px-4 py-2">
                    <span className="text-base w-6 text-center">{CAT_ICON[cat as AnimalCategoria] ?? '🐄'}</span>
                    <span className="text-sm flex-1">{cat}</span>
                    <span className="text-sm font-bold">{n} cab.</span>
                    <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
      </Section>

      {/* Status reprodutivo */}
      {matrizes.length > 0 && (
        <Section title={`Status Reprodutivo — ${matrizes.length} Matrizes`}>
          <div className="divide-y">
            {Object.entries(reprStatus).map(([s, n]) => (
              <div key={s} className="flex justify-between items-center px-4 py-2 text-sm">
                <span className="text-muted-foreground">{s}</span>
                <span className="font-bold">{n} matriz{n !== 1 ? 'es' : ''}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Peso médio por categoria */}
      {Object.keys(pesoMedio).length > 0 && (
        <Section title="Peso Médio por Categoria">
          <div className="divide-y">
            {Object.entries(pesoMedio).map(([cat, { soma, n }]) => (
              <div key={cat} className="flex justify-between items-center px-4 py-2 text-sm">
                <span className="text-muted-foreground">{cat}</span>
                <span className="font-bold">{(soma / n).toFixed(0)} kg <span className="text-xs font-normal text-muted-foreground">({n} anim.)</span></span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Aba Desempenho (GMD) ────────────────────────────────────────────────────

function TabDesempenho({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const animaisVivos = (db.animais ?? []).filter(a => a.status === 'Vivo' && a.tipo === 'individual');

  interface GmdItem {
    brinco: string; cat: string; gmd: number;
    pesoIni: number; pesoFim: number; dias: number;
  }

  const ranking = useMemo((): GmdItem[] =>
    animaisVivos.map(a => {
      const pesagens = (db.eventos ?? [])
        .filter(e => e.brincoAnimal === a.brinco && (TIPOS_PESAGEM as string[]).includes(e.tipo) && e.peso && e.peso > 0)
        .sort((x, y) => x.data.localeCompare(y.data));
      if (pesagens.length < 2) return null;
      const first = pesagens[0];
      const last  = pesagens[pesagens.length - 1];
      const dias  = diffDays(first.data, last.data);
      if (dias <= 0) return null;
      return { brinco: a.brinco, cat: a.categoria, gmd: (last.peso! - first.peso!) / dias, pesoIni: first.peso!, pesoFim: last.peso!, dias } as GmdItem;
    }).filter(Boolean) as GmdItem[],
  [db, animaisVivos]);  // eslint-disable-line react-hooks/exhaustive-deps

  const rankingDesc = [...ranking].sort((a, b) => b.gmd - a.gmd);
  const mediaGmd    = ranking.length > 0 ? ranking.reduce((s, r) => s + r.gmd, 0) / ranking.length : null;

  // GMD médio por categoria (para comparar com benchmark EMBRAPA)
  const gmdPorCat = useMemo(() => {
    const map: Record<string, { soma: number; n: number }> = {};
    ranking.forEach(r => {
      if (!map[r.cat]) map[r.cat] = { soma: 0, n: 0 };
      map[r.cat].soma += r.gmd;
      map[r.cat].n    += 1;
    });
    return Object.entries(map).map(([cat, { soma, n }]) => ({
      cat,
      media:     soma / n,
      referencia: GMD_REF[cat] ?? 0.7,
      n,
    })).sort((a, b) => b.media - a.media);
  }, [ranking]);

  const chartData = rankingDesc.slice(0, 10).map(r => ({
    name:  r.brinco.length > 8 ? r.brinco.slice(0, 8) + '…' : r.brinco,
    gmd:   parseFloat(r.gmd.toFixed(2)),
    color: r.gmd >= (mediaGmd ?? 0) ? '#22c55e' : '#f97316',
  }));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <MiniKpi label="Animais com GMD" value={ranking.length > 0 ? String(ranking.length) : '—'} cor="text-foreground" />
        <MiniKpi label="GMD Médio Geral"
          value={mediaGmd !== null ? `${mediaGmd.toFixed(2)} kg/d` : '—'}
          cor={mediaGmd !== null && mediaGmd >= 0.8 ? 'text-green-700' : 'text-amber-600'} />
      </div>

      {ranking.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center space-y-1">
          <p className="text-sm font-bold">Sem dados suficientes</p>
          <p className="text-xs text-muted-foreground">São necessárias pelo menos 2 pesagens por animal para calcular o GMD.</p>
        </div>
      ) : (
        <>
          {/* GMD por fase vs. EMBRAPA */}
          {gmdPorCat.length > 0 && (
            <Section title="GMD por Fase — vs. Referência EMBRAPA">
              <div className="divide-y">
                {gmdPorCat.map(({ cat, media, referencia, n }) => {
                  const pct  = referencia > 0 ? (media / referencia) * 100 : 100;
                  const ok   = media >= referencia;
                  return (
                    <div key={cat} className="px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{CAT_ICON[cat as AnimalCategoria] ?? '🐄'}</span>
                          <span className="text-sm font-bold">{cat}</span>
                          <span className="text-[10px] text-muted-foreground">({n} anim.)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${ok ? 'text-green-700' : 'text-orange-500'}`}>
                            {media.toFixed(2)} kg/d
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {ok ? '✓' : '↓'} Ref: {referencia.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%`, background: ok ? '#22c55e' : '#f97316' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground px-4 pb-3">Referências baseadas em benchmarks EMBRAPA para raça zebuína.</p>
            </Section>
          )}

          {/* Top 10 gráfico */}
          <Section title="Top 10 Animais — GMD (kg/dia)">
            <div className="px-2 pb-2">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    formatter={(v) => typeof v === 'number' ? [`${v} kg/dia`, 'GMD'] : [String(v), 'GMD']}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="gmd" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Ranking completo */}
          <Section title="Ranking Completo">
            <div className="divide-y">
              {rankingDesc.map((r, i) => (
                <div key={r.brinco} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`text-xs font-black w-5 text-center ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>{i + 1}</span>
                  <span className="text-sm shrink-0">{CAT_ICON[r.cat as AnimalCategoria] ?? '🐄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{r.brinco}</p>
                    <p className="text-[11px] text-muted-foreground">{r.pesoIni} → {r.pesoFim} kg · {r.dias}d</p>
                  </div>
                  <span className={`text-sm font-black shrink-0 ${r.gmd >= (mediaGmd ?? 0) ? 'text-green-700' : 'text-orange-500'}`}>
                    {r.gmd >= 0 ? '+' : ''}{r.gmd.toFixed(2)} kg/d
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// ─── Aba Curva de Peso ───────────────────────────────────────────────────────

function TabCurva({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const individuais = (db.animais ?? []).filter(a => a.tipo === 'individual');
  const [brincoSel, setBrincoSel] = useState<string>('');

  const animal = individuais.find(a => a.brinco === brincoSel);

  // Pontos de pesagem do animal selecionado
  const pontos = useMemo(() => {
    if (!brincoSel) return [];
    return (db.eventos ?? [])
      .filter(e =>
        e.brincoAnimal === brincoSel &&
        (TIPOS_PESAGEM as string[]).includes(e.tipo) &&
        e.peso && e.peso > 0,
      )
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(e => ({
        data:  fmtDate(e.data),
        peso:  e.peso!,
        tipo:  e.tipo,
      }));
  }, [db, brincoSel]);

  // Peso atual do animal selecionado
  const pesoAtual = animal?.pesoAtual;

  // GMD geral do animal selecionado
  const gmdAnimal = pontos.length >= 2
    ? (pontos[pontos.length - 1].peso - pontos[0].peso) /
      diffDays(
        (db.eventos ?? []).find(e => e.brincoAnimal === brincoSel && e.peso === pontos[0].peso)?.data ?? '',
        (db.eventos ?? []).find(e => e.brincoAnimal === brincoSel && e.peso === pontos[pontos.length - 1].peso)?.data ?? '',
      )
    : null;

  return (
    <div className="space-y-4">
      {/* Seletor de animal */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selecionar Animal</p>
        <select
          value={brincoSel}
          onChange={e => setBrincoSel(e.target.value)}
          className="w-full border rounded-xl px-3 py-2.5 text-sm bg-background">
          <option value="">Selecione um animal...</option>
          {individuais
            .sort((a, b) => (a.brinco).localeCompare(b.brinco))
            .map(a => (
              <option key={a.id} value={a.brinco}>
                {a.brinco} — {a.categoria}{a.pesoAtual ? ` · ${a.pesoAtual}kg` : ''}
              </option>
            ))}
        </select>
      </div>

      {!brincoSel && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-2xl mb-2">📊</p>
          <p className="text-sm font-bold">Selecione um animal acima</p>
          <p className="text-xs text-muted-foreground mt-1">para ver a curva de evolução de peso.</p>
        </div>
      )}

      {brincoSel && pontos.length < 2 && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-sm font-bold">Sem dados suficientes</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pontos.length === 0
              ? 'Nenhuma pesagem registrada para este animal.'
              : 'Precisa de pelo menos 2 pesagens para mostrar a curva.'}
          </p>
        </div>
      )}

      {brincoSel && pontos.length >= 2 && (
        <>
          {/* KPIs do animal */}
          <div className="grid grid-cols-3 gap-2">
            <MiniKpi label="Peso Inicial" value={`${pontos[0].peso}kg`} cor="text-foreground" />
            <MiniKpi label="Peso Atual"   value={`${pesoAtual ?? pontos[pontos.length-1].peso}kg`} cor="text-green-700" />
            <MiniKpi label="GMD"
              value={gmdAnimal != null && isFinite(gmdAnimal) ? `${gmdAnimal.toFixed(2)} kg/d` : '—'}
              cor={gmdAnimal != null && gmdAnimal >= (GMD_REF[animal?.categoria ?? ''] ?? 0.7) ? 'text-green-700' : 'text-amber-600'} />
          </div>

          {/* Gráfico de curva */}
          <Section title={`Curva de Peso — ${brincoSel}`}>
            <div className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={pontos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="data" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => `${v}kg`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    formatter={(v) => typeof v === 'number' ? [`${v} kg`, 'Peso'] : [String(v), 'Peso']}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="#2D6A2F"
                    strokeWidth={2.5}
                    dot={{ fill: '#2D6A2F', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Peso (kg)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Tabela de pesagens */}
          <Section title="Histórico de Pesagens">
            <div className="divide-y">
              {pontos.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{p.data}</p>
                    <p className="text-[11px] text-muted-foreground">{p.tipo}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{p.peso} kg</p>
                    {i > 0 && (
                      <p className={`text-[11px] font-bold ${p.peso > pontos[i-1].peso ? 'text-green-600' : 'text-red-500'}`}>
                        {p.peso > pontos[i-1].peso ? '+' : ''}{(p.peso - pontos[i-1].peso).toFixed(1)} kg
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// ─── Aba Vendas ──────────────────────────────────────────────────────────────

function TabVendas({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const vendidos = useMemo(() =>
    (db.animais ?? [])
      .filter(a => a.status === 'Vendido' && a.precoVenda)
      .sort((a, b) => (b.dataVenda ?? '').localeCompare(a.dataVenda ?? '')),
    [db],
  );

  const totalReceita = vendidos.reduce((s, a) => s + (a.precoVenda ?? 0), 0);
  const mediaPorCab  = vendidos.length > 0 ? totalReceita / vendidos.length : 0;
  const totalCab     = sumCabecas(vendidos);

  // Vendas por mês (últimos 6)
  const hoje = new Date();
  const mesesData = Array.from({ length: 6 }, (_, i) => {
    const d  = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + i, 1);
    const y  = d.getFullYear();
    const m  = d.getMonth();
    const de = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const ate = `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`;
    const label = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m];

    const vds = vendidos.filter(a =>
      a.dataVenda && a.dataVenda >= de && a.dataVenda <= ate,
    );
    return {
      mes:    label,
      receita: vds.reduce((s, a) => s + (a.precoVenda ?? 0), 0),
      qtd:    vds.length,
    };
  });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <MiniKpi label="Animais Vendidos" value={String(totalCab)}           cor="text-foreground" />
        <MiniKpi label="Receita Total"    value={fmtMoney(totalReceita)}     cor="text-green-700" />
        <MiniKpi label="Média / Animal"   value={vendidos.length > 0 ? fmtMoney(mediaPorCab) : '—'} cor="text-foreground" />
        <MiniKpi label="Último mês"
          value={fmtMoney(mesesData[mesesData.length - 1].receita)}
          cor={mesesData[mesesData.length - 1].receita > 0 ? 'text-green-700' : 'text-muted-foreground'} />
      </div>

      {vendidos.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center space-y-1">
          <p className="text-sm font-bold">Nenhuma venda registrada</p>
          <p className="text-xs text-muted-foreground">
            Registre o evento de Venda em um animal para aparecer aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Gráfico receita mensal */}
          <Section title="Receita por Mês (6 meses)">
            <div className="px-2 pb-2">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={mesesData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                    tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44}
                  />
                  <Tooltip
                    formatter={(v) => typeof v === 'number' ? [fmtMoney(v), 'Receita'] : [String(v), 'Receita']}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="receita" fill="#15803d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Lista de vendas */}
          <Section title="Histórico de Vendas">
            <div className="divide-y">
              {vendidos.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-base shrink-0">{CAT_ICON[a.categoria] ?? '🐄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{a.brinco || a.nomeGrupo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.categoria}{a.raca ? ` · ${a.raca}` : ''} · {fmtDate(a.dataVenda)}
                    </p>
                  </div>
                  <span className="text-sm font-black text-green-700 shrink-0">
                    {fmtMoney(a.precoVenda ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

// ─── Aba Projeção de Receita ─────────────────────────────────────────────────

function TabProjecao({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const meta         = db.meta ?? {};
  const pesoAlvo     = meta.pesoAlvoVenda ?? 480;
  const precoArroba  = meta.precoArroba ?? 0;
  const ARROBA_KG    = 15;
  const RENDIMENTO   = 0.5; // rendimento de carcaça ~50%

  const animaisVivos = (db.animais ?? []).filter(a => a.status === 'Vivo');
  const novilhos     = animaisVivos.filter(a =>
    (a.categoria === 'Novilho' || a.categoria === 'Boi') && a.pesoAtual
  );
  const matrizes = animaisVivos.filter(a => a.categoria === 'Matriz');

  // Animais prontos agora
  const prontos = novilhos.filter(a => (a.pesoAtual ?? 0) >= pesoAlvo);
  // Animais próximos (≥ 90% do alvo) com GMD médio estimado
  const GMD_MEDIO = 0.8; // kg/dia estimado

  // Projeção mensal dos próximos 6 meses
  interface ProjMes { mes: string; receita: number; qtd: number }
  const projMeses: ProjMes[] = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date();
    d.setMonth(d.getMonth() + i);
    const label = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()] + '/' + String(d.getFullYear()).slice(2);
    const diasFuturos = i * 30;

    const prontosMes = novilhos.filter(a => {
      const pesoFuturo = (a.pesoAtual ?? 0) + GMD_MEDIO * diasFuturos;
      const pesoAtual_ = (a.pesoAtual ?? 0);
      return pesoFuturo >= pesoAlvo && pesoAtual_ < pesoAlvo; // ainda não vendido
    });

    // Adiciona os prontos agora ao mês 0
    const totalQtd    = i === 0 ? prontos.length : prontosMes.length;
    const totalPeso   = i === 0
      ? prontos.reduce((s, a) => s + (a.pesoAtual ?? 0), 0)
      : prontosMes.reduce((s, a) => s + Math.min((a.pesoAtual ?? 0) + GMD_MEDIO * diasFuturos, pesoAlvo * 1.1), 0);
    const arrobas     = (totalPeso * RENDIMENTO) / ARROBA_KG;
    const receita     = precoArroba > 0 ? arrobas * precoArroba : 0;

    return { mes: label, receita, qtd: totalQtd };
  });

  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-4">
      {/* Config metas */}
      {(!precoArroba || !meta.pesoAlvoVenda) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-bold">Configure as metas</p>
          <p className="text-xs mt-1">Vá em Gestão → Metas para definir o peso alvo e preço da arroba.</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <MiniKpi label="Novilhos p/ venda" value={String(prontos.length)} cor="text-green-700" />
        <MiniKpi label="Receita estimada (agora)"
          value={precoArroba > 0
            ? fmtR(prontos.reduce((s, a) => s + ((a.pesoAtual! * RENDIMENTO) / ARROBA_KG) * precoArroba, 0))
            : '—'}
          cor="text-green-700"
        />
        <MiniKpi label="Peso alvo" value={pesoAlvo > 0 ? `${pesoAlvo}kg` : '—'} cor="text-foreground" />
        <MiniKpi label="Preço arroba" value={precoArroba > 0 ? fmtR(precoArroba) : '—'} cor="text-foreground" />
      </div>

      {/* Projeção 6 meses */}
      {precoArroba > 0 && novilhos.length > 0 && (
        <Section title="Projeção de Receita — Próximos 6 Meses">
          <div className="divide-y">
            {projMeses.map((m, i) => (
              <div key={m.mes} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{m.mes}</p>
                  <p className="text-xs text-muted-foreground">{m.qtd} animais</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${m.receita > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                    {m.receita > 0 ? fmtR(m.receita) : '—'}
                  </p>
                  {i === 0 && m.qtd > 0 && (
                    <p className="text-[10px] text-green-600 font-bold">Prontos agora</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground px-4 pb-3">
            * Estimativa com GMD médio de {GMD_MEDIO} kg/dia e rendimento de carcaça de {RENDIMENTO * 100}%.
          </p>
        </Section>
      )}

      {/* Reprodução */}
      {matrizes.length > 0 && (
        <Section title="Projeção de Nascimentos">
          <div className="divide-y">
            {(() => {
              const prenhas = matrizes.filter(a => a.dataPrevistoParto);
              const mes3    = prenhas.filter(a => {
                const d = a.dataPrevistoParto!;
                const hoje_ = new Date();
                const tres  = new Date(hoje_.getFullYear(), hoje_.getMonth() + 3, hoje_.getDate()).toISOString().slice(0, 10);
                return d <= tres;
              });
              return [
                { label: 'Prenhas c/ parto previsto', value: prenhas.length, cor: 'text-green-700' },
                { label: 'Partos nos próximos 3 meses', value: mes3.length, cor: 'text-blue-600' },
                { label: 'Sem diagnóstico', value: matrizes.filter(a => !a.statusReprodutivo).length, cor: 'text-muted-foreground' },
              ].map(r => (
                <div key={r.label} className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={`font-black ${r.cor}`}>{r.value}</span>
                </div>
              ));
            })()}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Aba Comparação de Lotes ─────────────────────────────────────────────────

function TabLotes({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const lotes     = db.lotes ?? [];
  const animais   = db.animais ?? [];
  const eventos   = db.eventos ?? [];

  const TIPOS_SAUDE: string[] = [
    'Vacina Clostridioses','Vacina Febre Aftosa','Vacina Brucelose',
    'Vacina Raiva','Vacina – Outro','Vermífugo','Banho Carrapaticida','Tratamento',
  ];

  interface LoteStats {
    id: string;
    nome: string;
    cabecas: number;
    pesoMedioKg: number | null;
    gmdMedio: number | null;
    eventosSaude: number;
    matrizes: number;
    prenhas: number;
  }

  const stats = useMemo((): LoteStats[] => {
    return lotes.map(lote => {
      const anis = animais.filter(a => a.loteId === lote.id && a.status === 'Vivo');
      const cabecas = anis.reduce((s, a) => s + (a.qtdCabecas ?? a.cabecas ?? 1), 0);

      // Peso médio
      const comPeso = anis.filter(a => a.pesoAtual && a.pesoAtual > 0);
      const pesoMedioKg = comPeso.length > 0
        ? comPeso.reduce((s, a) => s + a.pesoAtual!, 0) / comPeso.length
        : null;

      // GMD médio dos individuais com >= 2 pesagens
      const gmdList: number[] = [];
      anis.filter(a => a.tipo === 'individual').forEach(a => {
        const pesagens = eventos
          .filter(e => e.brincoAnimal === a.brinco && e.peso && e.peso > 0)
          .sort((x, y) => x.data.localeCompare(y.data));
        if (pesagens.length < 2) return;
        const dias = diffDays(pesagens[0].data, pesagens[pesagens.length - 1].data);
        if (dias <= 0) return;
        gmdList.push((pesagens[pesagens.length - 1].peso! - pesagens[0].peso!) / dias);
      });
      const gmdMedio = gmdList.length > 0
        ? gmdList.reduce((s, g) => s + g, 0) / gmdList.length
        : null;

      // Eventos de saúde nos últimos 90 dias
      const limite90 = new Date();
      limite90.setDate(limite90.getDate() - 90);
      const lim = limite90.toISOString().slice(0, 10);
      const brincos = new Set(anis.map(a => a.brinco || a.nomeGrupo || ''));
      const eventosSaude = eventos.filter(
        e => brincos.has(e.brincoAnimal) && TIPOS_SAUDE.includes(e.tipo) && e.data >= lim
      ).length;

      // Matrizes e prenhas
      const matrizes = anis.filter(a => a.categoria === 'Matriz').length;
      const prenhas  = anis.filter(a => a.statusReprodutivo === 'Prenhe').length;

      return { id: lote.id, nome: lote.nome, cabecas, pesoMedioKg, gmdMedio, eventosSaude, matrizes, prenhas };
    }).filter(s => s.cabecas > 0);
  }, [db, lotes, animais, eventos]);  // eslint-disable-line react-hooks/exhaustive-deps

  const semLote = animais.filter(a => a.status === 'Vivo' && !a.loteId);
  const cabSemLote = semLote.reduce((s, a) => s + (a.qtdCabecas ?? a.cabecas ?? 1), 0);

  const maxCab = Math.max(1, ...stats.map(s => s.cabecas));
  const maxPeso = Math.max(1, ...stats.map(s => s.pesoMedioKg ?? 0));
  const maxGmd  = Math.max(0.01, ...stats.map(s => s.gmdMedio ?? 0));

  if (lotes.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-2">
        <p className="text-3xl">🗂</p>
        <p className="text-sm font-bold">Nenhum lote cadastrado</p>
        <p className="text-xs text-muted-foreground">
          Crie lotes em Gestão → Lotes e associe animais para ver a comparação aqui.
        </p>
      </div>
    );
  }

  function ProgressBar({ pct, color }: { pct: number; color: string }) {
    return (
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct * 100, 100)}%`, background: color }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo geral */}
      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Lotes ativos" value={String(stats.length)} cor="text-foreground" />
        <MiniKpi label="Total animais" value={String(stats.reduce((s, l) => s + l.cabecas, 0))} cor="text-green-700" />
        <MiniKpi label="Sem lote" value={String(cabSemLote)} cor={cabSemLote > 0 ? 'text-amber-600' : 'text-muted-foreground'} />
      </div>

      {/* Cards de lote */}
      {stats.map(s => (
        <div key={s.id} className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <p className="text-sm font-black">{s.nome}</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: '#2D6A2F' }}>
              {s.cabecas} cab.
            </span>
          </div>
          <div className="p-4 space-y-3">
            {/* Cabeças */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Cabeças</span>
                <span className="font-bold">{s.cabecas}</span>
              </div>
              <ProgressBar pct={s.cabecas / maxCab} color="#2D6A2F" />
            </div>

            {/* Peso médio */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Peso médio</span>
                <span className="font-bold">{s.pesoMedioKg != null ? `${s.pesoMedioKg.toFixed(0)} kg` : '—'}</span>
              </div>
              {s.pesoMedioKg != null && <ProgressBar pct={s.pesoMedioKg / maxPeso} color="#f59e0b" />}
            </div>

            {/* GMD médio */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">GMD médio</span>
                <span className={`font-bold ${s.gmdMedio != null && s.gmdMedio >= 0.8 ? 'text-green-700' : 'text-orange-500'}`}>
                  {s.gmdMedio != null ? `${s.gmdMedio.toFixed(2)} kg/d` : '—'}
                </span>
              </div>
              {s.gmdMedio != null && <ProgressBar pct={s.gmdMedio / maxGmd} color={s.gmdMedio >= 0.8 ? '#22c55e' : '#f97316'} />}
            </div>

            {/* Saúde e reprodução */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="rounded-lg bg-muted p-2 text-center">
                <p className="text-[11px] font-black">{s.eventosSaude}</p>
                <p className="text-[10px] text-muted-foreground">Saúde 90d</p>
              </div>
              <div className="rounded-lg bg-muted p-2 text-center">
                <p className="text-[11px] font-black">{s.matrizes}</p>
                <p className="text-[10px] text-muted-foreground">Matrizes</p>
              </div>
              <div className="rounded-lg bg-muted p-2 text-center">
                <p className={`text-[11px] font-black ${s.prenhas > 0 ? 'text-blue-600' : ''}`}>{s.prenhas}</p>
                <p className="text-[10px] text-muted-foreground">Prenhas</p>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Gráfico comparativo — cabeças e peso médio */}
      {stats.length >= 2 && (
        <Section title="Comparativo — Peso Médio por Lote">
          <div className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.filter(s => s.pesoMedioKg != null).map(s => ({
                name: s.nome.length > 10 ? s.nome.slice(0, 10) + '…' : s.nome,
                peso: parseFloat((s.pesoMedioKg ?? 0).toFixed(1)),
              }))} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${v}kg`} />
                <Tooltip
                  formatter={(v) => typeof v === 'number' ? [`${v} kg`, 'Peso médio'] : [String(v), 'Peso médio']}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="peso" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest px-4 py-3 border-b">
        {title}
      </p>
      {children}
    </div>
  );
}

function Vazio({ msg }: { msg: string }) {
  return (
    <div className="p-6 text-center">
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}

// ─── Aba Custos ──────────────────────────────────────────────────────────────

// ── Benchmarks EMBRAPA / SCOT Consultoria / CNA — 2023-2024 ──────────────────

const BENCH_SISTEMA = [
  { key: 'ext',  label: 'Extensivo (pasto)',       min: 480,  max: 780,  cor: '#16a34a' },
  { key: 'semi', label: 'Semi-intensivo',           min: 780,  max: 1300, cor: '#ca8a04' },
  { key: 'int',  label: 'Intensivo (confinamento)', min: 1500, max: 3200, cor: '#dc2626' },
] as const;

const BENCH_POR_CAT: Record<string, { min: number; max: number; fase: string }> = {
  Bezerro:   { min: 280,  max: 450,  fase: 'Fase cria'   },
  Bezerra:   { min: 280,  max: 450,  fase: 'Fase cria'   },
  Desmamado: { min: 380,  max: 620,  fase: 'Recria'      },
  Novilho:   { min: 520,  max: 850,  fase: 'Recria'      },
  Novilha:   { min: 480,  max: 780,  fase: 'Recria'      },
  Matriz:    { min: 650,  max: 1050, fase: 'Cria'        },
  Boi:       { min: 620,  max: 1000, fase: 'Terminação'  },
  Touro:     { min: 850,  max: 1600, fase: 'Reprodução'  },
};

// Breakdown típico de custos (%) — EMBRAPA/CNA
const BENCH_BREAKDOWN = [
  { label: 'Nutrição / Suplementação', min: 35, max: 45, cor: '#16a34a' },
  { label: 'Mão de obra',              min: 20, max: 30, cor: '#2563eb' },
  { label: 'Sanidade',                 min: 10, max: 15, cor: '#dc2626' },
  { label: 'Infraestrutura',           min: 10, max: 20, cor: '#7c3aed' },
  { label: 'Outros',                   min:  5, max: 10, cor: '#6b7280' },
];

// GMD referência EMBRAPA por categoria (kg/dia)
const BENCH_GMD_FULL: Record<string, { min: number; max: number; fase: string }> = {
  Bezerro:   { min: 0.5, max: 0.8, fase: 'Pré-desmame'      },
  Bezerra:   { min: 0.4, max: 0.7, fase: 'Pré-desmame'      },
  Desmamado: { min: 0.5, max: 0.8, fase: 'Recria extensiva' },
  Novilho:   { min: 0.5, max: 0.9, fase: 'Recria extensiva' },
  Novilha:   { min: 0.4, max: 0.7, fase: 'Recria extensiva' },
  Boi:       { min: 0.7, max: 1.1, fase: 'Terminação'       },
  Matriz:    { min: 0.3, max: 0.5, fase: 'Mantença'         },
  Touro:     { min: 0.3, max: 0.5, fase: 'Mantença'         },
};

// Mortalidade aceitável (%) — EMBRAPA
const BENCH_MORT = {
  bezerros: 5,  // até 5% tolerável
  adultos:  2,  // até 2% tolerável
};

type Periodo = 'mes' | 'trim' | 'sem' | 'ano' | 'tudo';

function TabCustos({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const [periodo, setPeriodo] = useState<Periodo>('ano');
  const [verRef,  setVerRef]  = useState(false);

  const animaisVivos = (db.animais ?? []).filter(a => a.status === 'Vivo');
  const totalCab     = sumCabecas(animaisVivos);

  // ── Calcula custos do período ──────────────────────────────────────────────
  const { totalDesp, meses, custoCabMes, custoCabAno, breakdownReal } = useMemo(() => {
    const { de, ate } = periodo === 'tudo' ? { de: null, ate: null } : periodDates(periodo);
    const despesas    = calcDespesas(db, de, ate);
    const totalDesp   = despesas.reduce((s, d) => s + d.valor, 0);

    // Número de meses do período
    let meses = 1;
    if (periodo === 'trim') meses = 3;
    else if (periodo === 'sem') meses = 6;
    else if (periodo === 'ano') meses = 12;
    else if (periodo === 'tudo') {
      const primeira = [...(db.animais ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (primeira) {
        const ms = (Date.now() - new Date(primeira.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.4);
        meses = Math.max(1, Math.round(ms));
      }
    }

    const custoCabMes = totalCab > 0 ? totalDesp / (totalCab * meses) : 0;
    const custoCabAno = custoCabMes * 12;

    // Breakdown real por categoria de custo
    const catMap: Record<string, number> = {};
    despesas.forEach(d => {
      catMap[d.cat] = (catMap[d.cat] ?? 0) + d.valor;
    });
    const breakdownReal = Object.entries(catMap)
      .map(([cat, val]) => ({ cat, val, pct: totalDesp > 0 ? (val / totalDesp) * 100 : 0 }))
      .sort((a, b) => b.val - a.val);

    return { totalDesp, meses, custoCabMes, custoCabAno, breakdownReal };
  }, [db, periodo, totalCab]);

  // ── GMD real por categoria ──────────────────────────────────────────────────
  const gmdPorCat = useMemo(() => {
    const result: Record<string, { gmd: number; n: number }> = {};
    const eventos = db.eventos ?? [];
    animaisVivos.forEach(a => {
      const brinco = a.brinco || a.nomeGrupo;
      if (!brinco) return;
      const pesagens = eventos
        .filter(e => e.tipo === 'Pesagem' && e.peso && e.brincoAnimal === brinco)
        .sort((x, y) => x.data.localeCompare(y.data));
      if (pesagens.length < 2) return;
      const first = pesagens[0], last = pesagens[pesagens.length - 1];
      const dias  = Math.max(1, Math.round((new Date(last.data).getTime() - new Date(first.data).getTime()) / 86400000));
      const gmd   = (last.peso! - first.peso!) / dias;
      if (gmd <= 0) return;
      const cat = a.categoria;
      if (!result[cat]) result[cat] = { gmd: 0, n: 0 };
      result[cat].gmd += gmd;
      result[cat].n   += 1;
    });
    return Object.entries(result).map(([cat, { gmd, n }]) => ({ cat, gmd: gmd / n }));
  }, [animaisVivos, db.eventos]);

  // ── Mortalidade ────────────────────────────────────────────────────────────
  const { mortBezerros, mortAdultos } = useMemo(() => {
    const mortos  = (db.animais ?? []).filter(a => a.status === 'Morto');
    const bezerrosMortos = mortos.filter(a => ['Bezerro','Bezerra'].includes(a.categoria)).length;
    const totalBezerros  = animaisVivos.filter(a => ['Bezerro','Bezerra'].includes(a.categoria)).length + bezerrosMortos;
    const adultMortos    = mortos.filter(a => !['Bezerro','Bezerra'].includes(a.categoria)).length;
    const totalAdultos   = animaisVivos.filter(a => !['Bezerro','Bezerra'].includes(a.categoria)).length + adultMortos;
    return {
      mortBezerros: totalBezerros > 0 ? (bezerrosMortos / totalBezerros) * 100 : 0,
      mortAdultos:  totalAdultos  > 0 ? (adultMortos  / totalAdultos)  * 100 : 0,
    };
  }, [db.animais, animaisVivos]);

  // ── Break-even @ ──────────────────────────────────────────────────────────
  // Peso médio de venda (kg vivo). Se sem dados, usa referência 480 kg
  const pesoVendaMedio = useMemo(() => {
    const vendas = (db.eventos ?? []).filter(e => e.tipo === 'Venda' && e.peso);
    if (vendas.length === 0) return 480;
    return vendas.reduce((s, e) => s + e.peso!, 0) / vendas.length;
  }, [db.eventos]);

  // arrobas = (peso vivo × rendimento carcaça 52%) / 15 kg por arroba
  const arrobasPorAnimal = (pesoVendaMedio * 0.52) / 15;
  const breakEvenArroba  = arrobasPorAnimal > 0 ? custoCabAno / arrobasPorAnimal : 0;

  // ── Eficiência vs benchmark extensivo ─────────────────────────────────────
  const benchExt = BENCH_SISTEMA[0];
  const benchMid  = (benchExt.min + benchExt.max) / 2;
  function eficiencia(): { label: string; cor: string; pct: number } {
    if (custoCabAno === 0) return { label: 'Sem dados', cor: '#6b7280', pct: 50 };
    if (custoCabAno < benchExt.min) return { label: 'Excelente — abaixo do benchmark', cor: '#16a34a', pct: 20 };
    if (custoCabAno < benchMid)     return { label: 'Bom — dentro da faixa esperada',  cor: '#65a30d', pct: 45 };
    if (custoCabAno < benchExt.max) return { label: 'Regular — próximo do limite',      cor: '#ca8a04', pct: 70 };
    return { label: 'Atenção — acima do benchmark', cor: '#dc2626', pct: 90 };
  }
  const ef = eficiencia();

  const fmtR  = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtN1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  if (totalCab === 0) {
    return <Vazio msg="Cadastre animais para ver a análise de custos." />;
  }

  return (
    <div className="space-y-4">
      {/* Período */}
      <div className="flex gap-1 rounded-lg border p-1">
        {(['mes','trim','sem','ano','tudo'] as Periodo[]).map(p => (
          <button key={p} onClick={() => setPeriodo(p)}
            className={`flex-1 rounded-md py-1.5 text-[10px] font-bold transition-colors ${periodo === p ? 'text-white' : 'text-muted-foreground'}`}
            style={periodo === p ? { background: '#2D6A2F' } : {}}>
            {p === 'mes' ? '1M' : p === 'trim' ? '3M' : p === 'sem' ? '6M' : p === 'ano' ? '1A' : 'Tudo'}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <MiniKpi label="Total de Despesas" value={fmtR(totalDesp)} cor="text-red-600" />
        <MiniKpi label="Cabeças"           value={String(totalCab)}  cor="text-foreground" />
        <MiniKpi label="Custo / Cab / Mês" value={fmtR(custoCabMes)} cor="text-amber-600" />
        <MiniKpi label="Custo / Cab / Ano" value={fmtR(custoCabAno)} cor="text-amber-700" />
      </div>

      {/* Eficiência vs benchmark */}
      <Section title="Eficiência vs Benchmark EMBRAPA">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: ef.cor }}>{ef.label}</span>
            <span className="text-xs text-muted-foreground">Extensivo: {fmtR(benchExt.min)}–{fmtR(benchExt.max)}/ano</span>
          </div>
          {/* Barra de gauge */}
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            {/* zona verde (abaixo do mín) */}
            <div className="absolute left-0 top-0 h-full rounded-full bg-green-400"
              style={{ width: '25%' }} />
            {/* zona amarela */}
            <div className="absolute top-0 h-full bg-amber-400"
              style={{ left: '25%', width: '40%' }} />
            {/* zona vermelha */}
            <div className="absolute top-0 h-full rounded-r-full bg-red-400"
              style={{ left: '65%', width: '35%' }} />
            {/* ponteiro */}
            <div className="absolute top-0 h-full w-1 bg-foreground rounded-full transition-all"
              style={{ left: `calc(${Math.min(ef.pct, 98)}% - 2px)` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Excelente</span><span>Regular</span><span>Atenção</span>
          </div>

          {/* Comparativo por sistema */}
          <div className="space-y-2 pt-1">
            {BENCH_SISTEMA.map(s => {
              const dentro = custoCabAno >= s.min && custoCabAno <= s.max;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.cor }} />
                  <div className="flex-1 text-xs">{s.label}</div>
                  <div className="text-xs font-bold text-muted-foreground tabular-nums">
                    {fmtR(s.min)}–{fmtR(s.max)}
                  </div>
                  {dentro && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: s.cor }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Break-even @ */}
      <Section title="Break-even por Arroba">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Seu break-even</p>
              <p className="text-lg font-black text-amber-600 mt-1">
                {breakEvenArroba > 0 ? fmtR(breakEvenArroba) : '–'}<span className="text-xs font-normal">/@</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Base: {Math.round(pesoVendaMedio)} kg vivo · {fmtN1(arrobasPorAnimal)} @/animal
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Referência EMBRAPA</p>
              <p className="text-sm font-black text-foreground mt-1">R$ 185–255<span className="text-xs font-normal">/@ ext.</span></p>
              <p className="text-sm font-black text-foreground">R$ 225–310<span className="text-xs font-normal">/@ semi</span></p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            * Cálculo: custo/cab/ano ÷ (@/animal estimadas). Rendimento de carcaça: 52%. 1@ = 15 kg carcaça.
          </p>
        </div>
      </Section>

      {/* Breakdown de custos real */}
      {breakdownReal.length > 0 && (
        <Section title="Composição de Despesas (Período)">
          <div className="divide-y">
            {breakdownReal.slice(0, 8).map(({ cat, val, pct }) => (
              <div key={cat} className="px-4 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold truncate flex-1">{cat}</span>
                  <span className="text-xs font-bold text-muted-foreground ml-2">{fmtN1(pct)}%</span>
                  <span className="text-xs font-bold ml-3 tabular-nums">{fmtR(val)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Comparativo breakdown vs EMBRAPA */}
      <Section title="Benchmark de Composição de Custos (EMBRAPA/CNA)">
        <div className="divide-y">
          {BENCH_BREAKDOWN.map(b => (
            <div key={b.label} className="px-4 py-2.5 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.cor }} />
              <span className="text-xs flex-1">{b.label}</span>
              <span className="text-xs font-bold text-muted-foreground">{b.min}–{b.max}%</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground px-4 pb-3">
          Fonte: EMBRAPA Gado de Corte / CNA — sistema extensivo Nelore, referência nacional 2023.
        </p>
      </Section>

      {/* GMD real vs benchmark */}
      {gmdPorCat.length > 0 && (
        <Section title="GMD Real vs Referência EMBRAPA">
          <div className="divide-y">
            {gmdPorCat.map(({ cat, gmd }) => {
              const ref  = BENCH_GMD_FULL[cat];
              const ok   = ref ? gmd >= ref.min : null;
              const icon = ok === null ? '–' : ok ? '✅' : '⚠️';
              return (
                <div key={cat} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-sm shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold">{cat}</p>
                    {ref && <p className="text-[10px] text-muted-foreground">{ref.fase} · Ref: {ref.min}–{ref.max} kg/dia</p>}
                  </div>
                  <span className={`text-xs font-black tabular-nums ${ok === false ? 'text-amber-600' : ok ? 'text-green-600' : ''}`}>
                    {fmtN1(gmd)} kg/dia
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Mortalidade */}
      <Section title="Mortalidade vs Tolerância EMBRAPA">
        <div className="divide-y">
          {[
            { label: 'Bezerros', val: mortBezerros, bench: BENCH_MORT.bezerros },
            { label: 'Adultos',  val: mortAdultos,  bench: BENCH_MORT.adultos  },
          ].map(m => {
            const ok   = m.val <= m.bench;
            return (
              <div key={m.label} className="px-4 py-3 flex items-center gap-3">
                <span className="text-base">{ok ? '✅' : '⚠️'}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">Tolerável: até {m.bench}% (EMBRAPA)</p>
                </div>
                <span className={`text-sm font-black tabular-nums ${ok ? 'text-green-600' : 'text-amber-600'}`}>
                  {fmtN1(m.val)}%
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Tabela de referência por categoria */}
      <div>
        <button
          onClick={() => setVerRef(v => !v)}
          className="w-full rounded-xl border bg-card px-4 py-3 text-left text-xs font-bold flex items-center justify-between"
        >
          <span>📋 Custo de referência por categoria (EMBRAPA)</span>
          <span className="text-muted-foreground">{verRef ? '▲' : '▼'}</span>
        </button>
        {verRef && (
          <div className="rounded-b-xl border border-t-0 bg-card overflow-hidden">
            <div className="grid grid-cols-4 bg-muted/50 px-3 py-2 text-[9px] font-black uppercase text-muted-foreground">
              <div className="col-span-2">Categoria</div>
              <div className="text-right">R$/cab/ano</div>
              <div className="text-right">Fase</div>
            </div>
            {Object.entries(BENCH_POR_CAT).map(([cat, b]) => (
              <div key={cat} className="grid grid-cols-4 px-3 py-2.5 border-t text-xs items-center">
                <div className="col-span-2 font-semibold">{cat}</div>
                <div className="text-right text-muted-foreground tabular-nums">
                  {b.min}–{b.max}
                </div>
                <div className="text-right text-[10px] text-muted-foreground">{b.fase}</div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground px-3 pb-3 pt-1">
              Fonte: EMBRAPA Gado de Corte (MS), SCOT Consultoria, CNA — sistema extensivo Nelore, referência nacional 2023-2024.
              Valores em R$ — ajuste conforme custo de terra, mão de obra e insumos da sua região.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Aba PDF Mensal ───────────────────────────────────────────────────────────

const MESES_PT_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function TabPDFMensal() {
  const hoje  = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
          Relatório Mensal PDF
        </p>
        <p className="text-xs text-muted-foreground">
          Gera um relatório completo do mês selecionado com eventos, pesagens,
          GMD, eventos sanitários e resumo financeiro — pronto para impressão.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              Mês
            </label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              {MESES_PT_FULL.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              Ano
            </label>
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={() => gerarRelatorioMensal(mes, ano)}
          className="w-full rounded-xl py-3 text-sm font-bold text-white transition-colors hover:opacity-90"
          style={{ background: '#2D6A2F' }}
        >
          📄 Gerar PDF — {MESES_PT_FULL[mes - 1]} {ano}
        </button>
      </div>
    </div>
  );
}

// ─── Aba Índices Zootécnicos ──────────────────────────────────────────────────

const BENCH_INDICES = {
  prenhez:     { ext: 60,  semi: 80,  int: 88,  unidade: '%',  label: 'Taxa de Prenhez',       dir: 'high' },
  natalidade:  { ext: 58,  semi: 78,  int: 86,  unidade: '%',  label: 'Taxa de Natalidade',     dir: 'high' },
  desmame:     { ext: 55,  semi: 72,  int: 84,  unidade: '%',  label: 'Taxa de Desmame',        dir: 'high' },
  mortalidade: { ext: 2,   semi: 1.5, int: 1,   unidade: '%',  label: 'Taxa de Mortalidade',    dir: 'low'  },
  iep:         { ext: 420, semi: 380, int: 365, unidade: 'dias', label: 'Intervalo entre Partos', dir: 'low' },
};

function IndiceGauge({ valor, bench, dir, unidade }: {
  valor: number | null; bench: number; dir: 'high' | 'low'; unidade: string;
}) {
  if (valor === null) return <span className="text-sm text-muted-foreground">—</span>;

  const ok = dir === 'high' ? valor >= bench * 0.9 : valor <= bench * 1.1;
  const bom = dir === 'high' ? valor >= bench : valor <= bench;

  const cor = bom ? 'text-green-700' : ok ? 'text-amber-600' : 'text-red-600';
  const bg  = bom ? 'bg-green-50 border-green-200' : ok ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const tag = bom ? 'Bom' : ok ? 'Regular' : 'Abaixo';

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-xs ${bg}`}>
      <span className={`font-black text-sm ${cor}`}>{valor.toFixed(dir === 'low' ? 0 : 1)}{unidade}</span>
      <span className={`text-[10px] font-bold ${cor}`}>{tag}</span>
    </div>
  );
}

function TabIndices({ db }: { db: ReturnType<typeof useDB>['db'] }) {
  const [periodo, setPeriodo] = useState<'ano' | 'total'>('ano');

  const animais  = db.animais  ?? [];
  const eventos  = db.eventos  ?? [];
  const hoje     = new Date().getFullYear();
  const deAno    = `${hoje}-01-01`;

  const evsFiltrados = useMemo(() =>
    periodo === 'ano'
      ? eventos.filter(e => e.data >= deAno)
      : eventos,
    [eventos, periodo, deAno],
  );

  const animaisVivos   = animais.filter(a => a.status === 'Vivo');
  const matrizes       = animaisVivos.filter(a => a.categoria === 'Matriz');
  const totalRebanho   = sumCabecas(animaisVivos);

  // ── Taxa de Prenhez ──────────────────────────────────────────────────────
  // prenhas diagnosticadas / total inseminações/coberturas × 100
  const nInseminacoes = evsFiltrados.filter(e =>
    e.tipo === 'Inseminação Artificial' || e.tipo === 'Cobertura Natural' || e.tipo === 'IATF — Inseminação'
  ).length;
  const nPrenhesDiag = evsFiltrados.filter(e =>
    e.tipo === 'Diagnóstico de Gestação' && e.diagResult === 'Positivo (Prenhe)'
  ).length;
  const taxaPrenhez = nInseminacoes > 0 ? (nPrenhesDiag / nInseminacoes) * 100 : null;

  // ── Taxa de Natalidade ───────────────────────────────────────────────────
  // nascimentos no período / matrizes × 100
  const nNascimentos = evsFiltrados.filter(e => e.tipo === 'Nascimento').length;
  const taxaNatalidade = matrizes.length > 0 ? (nNascimentos / matrizes.length) * 100 : null;

  // ── Taxa de Desmame ──────────────────────────────────────────────────────
  // desmamados / nascidos × 100
  const nDesmames = evsFiltrados.filter(e => e.tipo === 'Desmame').length;
  const taxaDesmame = nNascimentos > 0 ? (nDesmames / nNascimentos) * 100 : null;

  // ── Taxa de Mortalidade ──────────────────────────────────────────────────
  // mortos no período / total rebanho × 100
  const nMortes = periodo === 'ano'
    ? animais.filter(a => a.status === 'Morto' && (a.updatedAt ?? '').slice(0, 4) === String(hoje)).length
    : animais.filter(a => a.status === 'Morto').length;
  const baseRebanho = totalRebanho + nMortes;
  const taxaMortalidade = baseRebanho > 0 ? (nMortes / baseRebanho) * 100 : null;

  // ── Intervalo Médio entre Partos ─────────────────────────────────────────
  // Para cada matriz com numeroParto > 1, calcula dias entre partos via eventos
  const iepValues: number[] = [];
  const partosMap: Record<string, string[]> = {};
  eventos
    .filter(e => e.tipo === 'Nascimento')
    .forEach(e => {
      if (!partosMap[e.brincoAnimal]) partosMap[e.brincoAnimal] = [];
      partosMap[e.brincoAnimal].push(e.data);
    });
  Object.values(partosMap).forEach(datas => {
    if (datas.length < 2) return;
    const sorted = [...datas].sort();
    for (let i = 1; i < sorted.length; i++) {
      const dias = Math.round((new Date(sorted[i]).getTime() - new Date(sorted[i-1]).getTime()) / 86400000);
      if (dias > 200 && dias < 800) iepValues.push(dias); // sanity check
    }
  });
  const iepMedio = iepValues.length > 0
    ? iepValues.reduce((s, v) => s + v, 0) / iepValues.length
    : null;

  // ── Peso médio ao desmame ────────────────────────────────────────────────
  const desmameComPeso = evsFiltrados.filter(e => e.tipo === 'Desmame' && e.peso);
  const pesoDesmame = desmameComPeso.length > 0
    ? desmameComPeso.reduce((s, e) => s + (e.peso ?? 0), 0) / desmameComPeso.length
    : null;

  // ── Peso médio à venda ───────────────────────────────────────────────────
  const vendaComPeso = evsFiltrados.filter(e => e.tipo === 'Venda' && e.peso);
  const pesoVenda = vendaComPeso.length > 0
    ? vendaComPeso.reduce((s, e) => s + (e.peso ?? 0), 0) / vendaComPeso.length
    : null;

  // ── Eficiência reprodutiva composta ─────────────────────────────────────
  const eficiencia = taxaPrenhez !== null && taxaNatalidade !== null && taxaDesmame !== null
    ? (taxaPrenhez / 100) * (taxaNatalidade / 100) * (taxaDesmame / 100) * 100
    : null;

  return (
    <div className="space-y-4">
      {/* Período */}
      <div className="flex gap-2">
        {([
          { key: 'ano',   label: `${hoje}` },
          { key: 'total', label: 'Todo período' },
        ] as { key: 'ano' | 'total'; label: string }[]).map(p => (
          <button key={p.key} onClick={() => setPeriodo(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              periodo === p.key ? 'text-white border-transparent' : 'text-muted-foreground'
            }`}
            style={periodo === p.key ? { background: '#2D6A2F' } : {}}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 gap-2">
        <MiniKpi label="Matrizes" value={String(matrizes.length)} cor="text-purple-700" />
        <MiniKpi label="Nascimentos" value={String(nNascimentos)} cor="text-green-700" />
        <MiniKpi label="Inseminações/Coberturas" value={String(nInseminacoes)} cor="text-blue-700" />
        <MiniKpi label="Mortes no período" value={String(nMortes)} cor="text-red-600" />
      </div>

      {/* Índices vs EMBRAPA */}
      <Section title="Índices Reprodutivos e Produtivos">
        <div className="divide-y">
          {([
            { label: 'Taxa de Prenhez',    valor: taxaPrenhez,    bench: BENCH_INDICES.prenhez,     detalhe: `${nPrenhesDiag} prenhas / ${nInseminacoes} procedimentos` },
            { label: 'Taxa de Natalidade', valor: taxaNatalidade, bench: BENCH_INDICES.natalidade,  detalhe: `${nNascimentos} nascimentos / ${matrizes.length} matrizes` },
            { label: 'Taxa de Desmame',    valor: taxaDesmame,    bench: BENCH_INDICES.desmame,      detalhe: `${nDesmames} desmamados / ${nNascimentos} nascidos` },
            { label: 'Taxa de Mortalidade', valor: taxaMortalidade, bench: BENCH_INDICES.mortalidade, detalhe: `${nMortes} mortes / ${baseRebanho} rebanho` },
          ].map(row => (
            <div key={row.label} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{row.label}</p>
                <IndiceGauge
                  valor={row.valor}
                  bench={row.bench.ext}
                  dir={row.bench.dir as 'high' | 'low'}
                  unidade={row.bench.unidade}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{row.detalhe}</p>
              <div className="flex gap-4 mt-1">
                <span className="text-[10px] text-muted-foreground">EMBRAPA extensivo: {row.bench.ext}{row.bench.unidade}</span>
                <span className="text-[10px] text-muted-foreground">semi-intensivo: {row.bench.semi}{row.bench.unidade}</span>
              </div>
            </div>
          )))}
        </div>
      </Section>

      {/* IEP */}
      <Section title="Intervalo entre Partos">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold">IEP Médio</p>
            <IndiceGauge valor={iepMedio} bench={BENCH_INDICES.iep.ext} dir="low" unidade=" dias" />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Calculado em {iepValues.length} intervalo{iepValues.length !== 1 ? 's' : ''} registrados.
            Meta ideal: ≤ 365 dias (1 parto/ano).
          </p>
          <div className="flex gap-4 mt-1">
            <span className="text-[10px] text-muted-foreground">Extensivo ref.: {BENCH_INDICES.iep.ext} dias</span>
            <span className="text-[10px] text-muted-foreground">Ideal: {BENCH_INDICES.iep.int} dias</span>
          </div>
        </div>
      </Section>

      {/* Pesos médios */}
      {(pesoDesmame !== null || pesoVenda !== null) && (
        <Section title="Peso Médio">
          {pesoDesmame !== null && (
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <div>
                <p className="font-semibold">Ao Desmame</p>
                <p className="text-[10px] text-muted-foreground">Ref. EMBRAPA extensivo: 165 kg</p>
              </div>
              <span className={`font-black text-base ${pesoDesmame >= 165 ? 'text-green-700' : 'text-amber-600'}`}>
                {pesoDesmame.toFixed(0)} kg
              </span>
            </div>
          )}
          {pesoVenda !== null && (
            <div className="flex justify-between items-center px-4 py-3 text-sm border-t">
              <div>
                <p className="font-semibold">À Venda</p>
                <p className="text-[10px] text-muted-foreground">Ref. EMBRAPA terminação: 480 kg</p>
              </div>
              <span className={`font-black text-base ${pesoVenda >= 480 ? 'text-green-700' : 'text-amber-600'}`}>
                {pesoVenda.toFixed(0)} kg
              </span>
            </div>
          )}
        </Section>
      )}

      {/* Eficiência composta */}
      {eficiencia !== null && (
        <div className={`rounded-xl border p-4 ${eficiencia >= 40 ? 'border-green-200 bg-green-50' : eficiencia >= 25 ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">
            Eficiência Reprodutiva Composta
          </p>
          <p className={`text-2xl font-black ${eficiencia >= 40 ? 'text-green-700' : eficiencia >= 25 ? 'text-amber-700' : 'text-red-700'}`}>
            {eficiencia.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Prenhez × Natalidade × Desmame. Extensivo ref.: ~20% · Intensivo ref.: ~60%
          </p>
        </div>
      )}

      {(matrizes.length === 0 || nInseminacoes === 0) && (
        <div className="rounded-xl border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          Registre eventos de inseminação, diagnóstico de gestação e nascimento para calcular os índices.
        </div>
      )}
    </div>
  );
}
