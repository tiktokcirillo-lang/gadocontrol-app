'use client';
import { useState } from 'react';
import { fmtMoney } from '@/lib/db';
import { calcReceitas, calcDespesas, periodDates } from '@/lib/eventos';
import type { DB } from '@/lib/types';

interface Props { db: DB }

type Periodo = 'mes' | 'trim' | 'ano' | 'tudo';

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'mes',  label: 'Este mês' },
  { key: 'trim', label: '3 meses'  },
  { key: 'ano',  label: 'Este ano' },
  { key: 'tudo', label: 'Tudo'     },
];

export function DREView({ db }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('ano');

  const { de, ate } = periodDates(periodo);
  const receitas    = calcReceitas(db, de, ate);
  const despesas    = calcDespesas(db, de, ate);

  const totRec  = receitas.reduce((s, i) => s + i.valor, 0);
  const totDesp = despesas.reduce((s, i) => s + i.valor, 0);
  const result  = totRec - totDesp;
  const margem  = totRec > 0 ? (result / totRec) * 100 : 0;

  // Agrupa por categoria
  const recByCat: Record<string, number>  = {};
  receitas.forEach(r => { recByCat[r.cat]  = (recByCat[r.cat]  ?? 0) + r.valor; });
  const despByCat: Record<string, number> = {};
  despesas.forEach(d => { despByCat[d.cat] = (despByCat[d.cat] ?? 0) + d.valor; });

  const positivo = result >= 0;

  return (
    <div className="space-y-4">
      {/* Seletor de período */}
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

      {/* Cartão DRE */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Receitas */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-black text-green-600 uppercase tracking-widest mb-2">
            ➕ Receitas Brutas
          </p>
          {Object.entries(recByCat).length > 0
            ? Object.entries(recByCat)
                .sort((a,b) => b[1]-a[1])
                .map(([cat, val]) => (
                  <DRERow key={cat} label={cat} value={fmtMoney(val)} color="text-green-700" />
                ))
            : <p className="text-xs text-muted-foreground italic">Nenhuma receita no período</p>
          }
          <DRESubtotal label="Total Receitas" value={fmtMoney(totRec)} color="text-green-700" />
        </div>

        <div className="h-px bg-border mx-4" />

        {/* Custos */}
        <div className="px-4 py-2">
          <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mb-2">
            ➖ Custos Operacionais
          </p>
          {Object.entries(despByCat).length > 0
            ? Object.entries(despByCat)
                .sort((a,b) => b[1]-a[1])
                .map(([cat, val]) => (
                  <DRERow key={cat} label={cat} value={`− ${fmtMoney(val)}`} color="text-red-600" />
                ))
            : <p className="text-xs text-muted-foreground italic">Nenhum custo no período</p>
          }
          <DRESubtotal label="Total Custos" value={`− ${fmtMoney(totDesp)}`} color="text-red-600" />
        </div>

        <div className="h-px bg-border mx-4" />

        {/* Resultado */}
        <div className="px-4 py-4 bg-muted/40">
          <div className="flex justify-between items-center">
            <span className="font-black text-sm">
              {positivo ? '✅' : '❌'} Resultado Líquido
            </span>
            <span className={`font-black text-lg ${positivo ? 'text-green-700' : 'text-red-600'}`}>
              {fmtMoney(result)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-muted-foreground">Margem líquida</span>
            <span className={`text-sm font-semibold ${positivo ? 'text-green-700' : 'text-red-600'}`}>
              {margem.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* KPIs resumo */}
      <div className="grid grid-cols-2 gap-3">
        <MiniKpi label="💰 Receita Total" value={fmtMoney(totRec)}  color="text-green-700" />
        <MiniKpi label="💸 Custo Total"   value={fmtMoney(totDesp)} color="text-red-600"   />
        <MiniKpi label={`${positivo ? '✅' : '❌'} Resultado`} value={fmtMoney(result)} color={positivo ? 'text-green-700' : 'text-red-600'} />
        <MiniKpi label="📊 Margem"        value={`${margem.toFixed(1)}%`} color={positivo ? 'text-green-700' : 'text-red-600'} />
      </div>
    </div>
  );
}

function DRERow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function DRESubtotal({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-t mt-1">
      <span className="text-sm font-bold">{label}</span>
      <span className={`text-sm font-black ${color}`}>{value}</span>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className={`text-base font-black ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
