'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { DB } from '@/lib/types';
import { calcReceitas, calcDespesas } from '@/lib/eventos';

interface Props { db: DB }

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function FluxoChart({ db }: Props) {
  const hoje = new Date();
  const data = Array.from({ length: 6 }, (_, i) => {
    const d  = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + i, 1);
    const y  = d.getFullYear();
    const m  = d.getMonth();
    const de = `${y}-${String(m + 1).padStart(2,'0')}-01`;
    const ate= `${y}-${String(m + 1).padStart(2,'0')}-${new Date(y, m+1, 0).getDate()}`;

    const rec  = calcReceitas(db, de, ate).reduce((s,x) => s + x.valor, 0);
    const desp = calcDespesas(db, de, ate).reduce((s,x) => s + x.valor, 0);

    return { mes: MESES_PT[m], Receitas: rec, Despesas: desp };
  });

  const fmt = (v: number) =>
    v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v.toFixed(0)}`;

  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
        Fluxo Mensal (6 meses)
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={14} barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
          <Tooltip
            formatter={(v) => typeof v === 'number' ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : v}
            contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid hsl(var(--border))' }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Receitas" fill="#15803d" radius={[4,4,0,0]} />
          <Bar dataKey="Despesas" fill="#ef4444" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
