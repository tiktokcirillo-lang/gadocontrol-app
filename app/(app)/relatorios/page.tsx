'use client';
import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from 'recharts';
import { useDB } from '@/hooks/useDB';
import { fmtMoney, fmtDate, diffDays, getCabecas, sumCabecas } from '@/lib/db';
import { CAT_ICON } from '@/lib/types';
import type { AnimalCategoria } from '@/lib/types';

type Tab = 'rebanho' | 'desempenho' | 'curva' | 'vendas';

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

      {/* Tabs */}
      <div className="grid grid-cols-4 rounded-lg border p-1 gap-1">
        {([
          { key: 'rebanho',    label: '🐄 Rebanho'   },
          { key: 'desempenho', label: '📈 GMD'        },
          { key: 'curva',      label: '📊 Curva'      },
          { key: 'vendas',     label: '💰 Vendas'     },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-md py-2 text-[11px] font-bold transition-colors ${tab === t.key ? 'text-white' : 'text-muted-foreground'}`}
            style={tab === t.key ? { background: '#2D6A2F' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rebanho'    && <TabRebanho    db={db} />}
      {tab === 'desempenho' && <TabDesempenho db={db} />}
      {tab === 'curva'      && <TabCurva      db={db} />}
      {tab === 'vendas'     && <TabVendas     db={db} />}
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
