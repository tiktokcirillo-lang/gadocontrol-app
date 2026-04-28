'use client';
import { getDB, saveDB, today, sumCabecas } from './db';
import { calcReceitas, calcDespesas } from './eventos';

// ─── Backup JSON ─────────────────────────────────────────────────────────────

export function exportarJSON(): void {
  const db   = getDB();
  db.meta.lastBackup = new Date().toISOString();
  saveDB(db);

  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gadocontrol-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importarJSON(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.animais || !data.eventos) throw new Error('Arquivo inválido');
        saveDB(data);
        resolve();
      } catch {
        reject(new Error('Arquivo de backup inválido ou corrompido.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsText(file);
  });
}

// ─── Exportar CSV Financeiro ──────────────────────────────────────────────────

export function exportarCSVFinanceiro(): void {
  const db  = getDB();
  const rec = calcReceitas(db);
  const dep = calcDespesas(db);
  const all = [
    ...rec.map(r => ({ ...r, sinal: '+' })),
    ...dep.map(d => ({ ...d, sinal: '-' })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  const header = 'Data,Tipo,Categoria,Descrição,Valor\n';
  const rows   = all.map(r =>
    `${r.data},${r.tipo},${r.cat},"${r.desc}",${r.sinal}${r.valor.toFixed(2)}`
  ).join('\n');

  baixar(`gadocontrol-financeiro-${today()}.csv`, 'text/csv', header + rows);
}

// ─── Relatório PDF (via window.print) ────────────────────────────────────────

export function abrirRelatorioPDF(): void {
  const db      = getDB();
  const meta    = db.meta ?? {};
  const animais = db.animais ?? [];
  const vivos   = animais.filter(a => a.status === 'Vivo');
  const vendidos = animais.filter(a => a.status === 'Vendido');
  const mortos  = animais.filter(a => a.status === 'Morto');
  const totalCab = sumCabecas(vivos);

  const rec  = calcReceitas(db);
  const desp = calcDespesas(db);
  const totRec  = rec.reduce((s, r) => s + r.valor, 0);
  const totDesp = desp.reduce((s, d) => s + d.valor, 0);
  const saldo   = totRec - totDesp;

  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtD = (s?: string) => s ? s.split('-').reverse().join('/') : '—';

  // Composição por categoria
  const porCat: Record<string, number> = {};
  vivos.forEach(a => { porCat[a.categoria] = (porCat[a.categoria] ?? 0) + 1; });
  const catRows = Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `<tr><td>${c}</td><td style="text-align:right">${n}</td></tr>`)
    .join('');

  // Últimas vendas
  const vendaRows = vendidos
    .filter(a => a.precoVenda)
    .sort((a, b) => (b.dataVenda ?? '').localeCompare(a.dataVenda ?? ''))
    .slice(0, 10)
    .map(a => `<tr><td>${a.brinco || a.nomeGrupo}</td><td>${a.categoria}</td><td>${fmtD(a.dataVenda)}</td><td style="text-align:right">${fmtR(a.precoVenda!)}</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório GadoControl — ${today()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 20px; color: #2D6A2F; margin-bottom: 4px; }
    h2 { font-size: 14px; color: #2D6A2F; border-bottom: 1px solid #2D6A2F; margin: 18px 0 8px; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .sub { color: #666; font-size: 11px; margin-top: 2px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 8px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
    .kpi .val { font-size: 18px; font-weight: 900; color: #2D6A2F; }
    .kpi .lbl { font-size: 10px; color: #666; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #666; }
    td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }
    .fin { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .fin-card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
    .fin-card .val { font-size: 16px; font-weight: 900; }
    .green { color: #16a34a; }
    .red   { color: #dc2626; }
    footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1>🐄 ${meta.fazNome || 'GadoControl'}</h1>
      ${meta.fazProprietario ? `<p class="sub">Proprietário: ${meta.fazProprietario}</p>` : ''}
      ${meta.fazMunicipio ? `<p class="sub">${meta.fazMunicipio}${meta.fazEstado ? ' — ' + meta.fazEstado : ''}</p>` : ''}
      ${meta.fazCAR ? `<p class="sub">CAR: ${meta.fazCAR}</p>` : ''}
      ${meta.fazAreaHa ? `<p class="sub">Área: ${meta.fazAreaHa} ha</p>` : ''}
    </div>
    <div style="text-align:right">
      <p style="font-weight:bold">Relatório Geral</p>
      <p class="sub">Gerado em ${fmtD(today())}</p>
    </div>
  </div>

  <h2>Rebanho</h2>
  <div class="kpis">
    <div class="kpi"><div class="val">${totalCab}</div><div class="lbl">Cabeças Vivas</div></div>
    <div class="kpi"><div class="val green">${sumCabecas(vendidos)}</div><div class="lbl">Vendidos</div></div>
    <div class="kpi"><div class="val red">${sumCabecas(mortos)}</div><div class="lbl">Mortos</div></div>
    <div class="kpi"><div class="val">${vivos.filter(a => a.categoria === 'Matriz').length}</div><div class="lbl">Matrizes</div></div>
  </div>

  <h2>Composição do Rebanho</h2>
  <table>
    <thead><tr><th>Categoria</th><th style="text-align:right">Cabeças</th></tr></thead>
    <tbody>${catRows || '<tr><td colspan="2" style="color:#999">Sem animais</td></tr>'}</tbody>
  </table>

  <h2>Financeiro (Todo o período)</h2>
  <div class="fin">
    <div class="fin-card"><div class="val green">${fmtR(totRec)}</div><div class="lbl">Receitas</div></div>
    <div class="fin-card"><div class="val red">${fmtR(totDesp)}</div><div class="lbl">Despesas</div></div>
    <div class="fin-card"><div class="val ${saldo >= 0 ? 'green' : 'red'}">${fmtR(saldo)}</div><div class="lbl">Resultado Líquido</div></div>
  </div>

  ${vendaRows ? `
  <h2>Histórico de Vendas (últimas 10)</h2>
  <table>
    <thead><tr><th>Animal</th><th>Categoria</th><th>Data</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${vendaRows}</tbody>
  </table>` : ''}

  <footer>
    GadoControl · Relatório gerado em ${new Date().toLocaleString('pt-BR')}
    ${meta.lastBackup ? ` · Último backup: ${new Date(meta.lastBackup).toLocaleDateString('pt-BR')}` : ''}
  </footer>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

// ─── helper ───────────────────────────────────────────────────────────────────

function baixar(nome: string, tipo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: tipo });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
