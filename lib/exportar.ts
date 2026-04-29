'use client';
import { getDB, saveDB, today, sumCabecas, uid } from './db';
import { calcReceitas, calcDespesas } from './eventos';
import * as XLSX from 'xlsx';
import type { Animal, AnimalCategoria, AnimalSexo, AnimalStatus } from './types';

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

// ─── Exportar XLSX ────────────────────────────────────────────────────────────

export function exportarXLSX(): void {
  const db   = getDB();
  const fmtD = (s?: string) => s ? s.split('-').reverse().join('/') : '';

  // Aba: Animais
  const animaisRows = (db.animais ?? []).map(a => ({
    'Brinco/Grupo':  a.brinco || a.nomeGrupo || '',
    'Tipo':          a.tipo,
    'Categoria':     a.categoria,
    'Sexo':          a.sexo ?? '',
    'Raça':          a.raca ?? '',
    'Status':        a.status,
    'Nascimento':    fmtD(a.dataNascimento),
    'Peso Atual (kg)': a.pesoAtual ?? '',
    'Peso Médio (kg)': a.pesoMedio ?? '',
    'Cabeças':       a.qtdCabecas ?? 1,
    'Mãe':           a.mae ?? '',
    'Pai/Touro':     a.pai ?? '',
    'SISBOV':        a.sisbov ?? '',
    'GTA':           a.gta ?? '',
    'Marca a Fogo':  a.marcaFogo ?? '',
    'Observação':    a.observacao ?? '',
  }));

  // Aba: Eventos
  const eventosRows = (db.eventos ?? []).map(e => ({
    'Animal':   e.brincoAnimal,
    'Tipo':     e.tipo,
    'Data':     fmtD(e.data),
    'Peso (kg)': e.peso ?? '',
    'Valor (R$)': e.preco ?? '',
    'Detalhes': e.detalhes ?? '',
  }));

  // Aba: Financeiro
  const rec  = calcReceitas(db);
  const desp = calcDespesas(db);
  const finRows = [
    ...rec.map(r => ({ 'Data': fmtD(r.data), 'Tipo': 'Receita', 'Categoria': r.cat, 'Descrição': r.desc, 'Valor (R$)': r.valor })),
    ...desp.map(d => ({ 'Data': fmtD(d.data), 'Tipo': 'Despesa', 'Categoria': d.cat, 'Descrição': d.desc, 'Valor (R$)': -d.valor })),
  ].sort((a, b) => (b.Data).localeCompare(a.Data));

  // Aba: Estoque
  const estoqueRows = (db.estoque ?? []).map(i => ({
    'Nome':       i.nome,
    'Categoria':  i.categoria,
    'Quantidade': i.quantidade,
    'Unidade':    i.unidade,
    'Validade':   fmtD(i.dataValidade),
    'Fornecedor': i.fornecedor ?? '',
    'Preço Unit.': i.precoUnitario ?? '',
    'Qtd. Mínima': i.quantidadeMinima ?? '',
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(animaisRows),  'Animais');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventosRows),  'Eventos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finRows),      'Financeiro');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(estoqueRows),  'Estoque');

  XLSX.writeFile(wb, `gadocontrol-${today()}.xlsx`);
}

// ─── Relatório PDF individual de animal ──────────────────────────────────────

export function imprimirAnimal(animalId: string): void {
  const db     = getDB();
  const animal = (db.animais ?? []).find(a => a.id === animalId);
  if (!animal) return;

  const meta    = db.meta ?? {};
  const eventos = (db.eventos ?? [])
    .filter(e => e.brincoAnimal === (animal.brinco || animal.nomeGrupo))
    .sort((a, b) => b.data.localeCompare(a.data));

  const fmtD = (s?: string) => s ? s.split('-').reverse().join('/') : '—';
  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const evRows = eventos.map(e =>
    `<tr>
      <td>${fmtD(e.data)}</td>
      <td>${e.tipo}</td>
      <td>${e.peso ? e.peso + ' kg' : '—'}</td>
      <td>${e.preco ? fmtR(e.preco) : '—'}</td>
      <td>${e.detalhes || ''}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Animal ${animal.brinco || animal.nomeGrupo} — GadoControl</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 20px; color: #2D6A2F; margin-bottom: 4px; }
    h2 { font-size: 13px; color: #2D6A2F; border-bottom: 1px solid #2D6A2F; margin: 16px 0 8px; padding-bottom: 3px; }
    .sub { color: #666; font-size: 11px; margin-top: 2px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { padding: 8px; border: 1px solid #eee; border-radius: 6px; }
    .field .lbl { font-size: 10px; color: #999; text-transform: uppercase; }
    .field .val { font-weight: bold; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #666; }
    td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }
    footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>🐄 ${animal.brinco || animal.nomeGrupo}</h1>
  <p class="sub">${meta.fazNome || 'GadoControl'} · Relatório gerado em ${fmtD(today())}</p>

  <h2>Dados do Animal</h2>
  <div class="grid">
    <div class="field"><div class="lbl">Categoria</div><div class="val">${animal.categoria}</div></div>
    <div class="field"><div class="lbl">Sexo</div><div class="val">${animal.sexo || '—'}</div></div>
    <div class="field"><div class="lbl">Raça</div><div class="val">${animal.raca || '—'}</div></div>
    <div class="field"><div class="lbl">Status</div><div class="val">${animal.status}</div></div>
    <div class="field"><div class="lbl">Nascimento</div><div class="val">${fmtD(animal.dataNascimento)}</div></div>
    <div class="field"><div class="lbl">Peso Atual</div><div class="val">${animal.pesoAtual ? animal.pesoAtual + ' kg' : '—'}</div></div>
    ${animal.mae ? `<div class="field"><div class="lbl">Mãe</div><div class="val">${animal.mae}</div></div>` : ''}
    ${animal.pai ? `<div class="field"><div class="lbl">Pai/Touro</div><div class="val">${animal.pai}</div></div>` : ''}
    ${animal.sisbov ? `<div class="field"><div class="lbl">SISBOV</div><div class="val">${animal.sisbov}</div></div>` : ''}
    ${animal.gta ? `<div class="field"><div class="lbl">GTA</div><div class="val">${animal.gta}</div></div>` : ''}
    ${animal.marcaFogo ? `<div class="field"><div class="lbl">Marca a Fogo</div><div class="val">${animal.marcaFogo}</div></div>` : ''}
  </div>

  ${animal.observacao ? `<h2>Observações</h2><p>${animal.observacao}</p>` : ''}

  <h2>Histórico de Eventos (${eventos.length})</h2>
  ${eventos.length === 0 ? '<p class="sub">Nenhum evento registrado.</p>' : `
  <table>
    <thead><tr><th>Data</th><th>Tipo</th><th>Peso</th><th>Valor</th><th>Detalhes</th></tr></thead>
    <tbody>${evRows}</tbody>
  </table>`}

  <footer>
    GadoControl · Gerado em ${new Date().toLocaleString('pt-BR')}
  </footer>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── GTA Digital ─────────────────────────────────────────────────────────────

export function imprimirGTA(params: {
  animalIds: string[];
  origem: string;
  destino: string;
  data: string;
  motorista?: string;
  placa?: string;
}): void {
  const db      = getDB();
  const meta    = db.meta ?? {};
  const animais = (db.animais ?? []).filter(a => params.animalIds.includes(a.id));
  const fmtD    = (s?: string) => s ? s.split('-').reverse().join('/') : '—';
  const totalCab = animais.reduce((s, a) => s + (a.qtdCabecas ?? 1), 0);

  const animalRows = animais.map(a =>
    `<tr>
      <td>${a.brinco || a.nomeGrupo || '—'}</td>
      <td>${a.categoria}</td>
      <td>${a.sexo || '—'}</td>
      <td>${a.raca || '—'}</td>
      <td>${a.pesoAtual ? a.pesoAtual + ' kg' : '—'}</td>
      <td>${a.sisbov || '—'}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>GTA Digital — ${params.data}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 18px; color: #2D6A2F; margin-bottom: 8px; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .field { padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
    .field .lbl { font-size: 10px; color: #999; text-transform: uppercase; }
    .field .val { font-weight: bold; margin-top: 2px; font-size: 13px; }
    h2 { font-size: 13px; color: #2D6A2F; border-bottom: 1px solid #2D6A2F; margin: 14px 0 8px; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #666; }
    td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; }
    .total { text-align: right; font-weight: bold; padding: 8px; background: #f3f4f6; border-radius: 6px; margin-top: 8px; }
    .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
    .assinatura { border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 11px; color: #666; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>🐄 Guia de Trânsito Animal (GTA) — Digital</h1>
  <p style="font-size:11px;color:#666;margin-bottom:16px">
    ${meta.fazNome || 'Fazenda'} · Emitido em ${fmtD(params.data)}
    <span style="color:#dc2626;font-weight:bold"> ⚠️ Documento informativo — substitua pela GTA oficial emitida pelo IAGRO/IMA/ADAB.</span>
  </p>

  <div class="header-grid">
    <div class="field"><div class="lbl">Propriedade Origem</div><div class="val">${params.origem || meta.fazNome || '—'}</div></div>
    <div class="field"><div class="lbl">Destino</div><div class="val">${params.destino}</div></div>
    <div class="field"><div class="lbl">Data de Trânsito</div><div class="val">${fmtD(params.data)}</div></div>
    <div class="field"><div class="lbl">Proprietário</div><div class="val">${meta.fazProprietario || '—'}</div></div>
    ${params.motorista ? `<div class="field"><div class="lbl">Motorista</div><div class="val">${params.motorista}</div></div>` : ''}
    ${params.placa ? `<div class="field"><div class="lbl">Placa do Veículo</div><div class="val">${params.placa}</div></div>` : ''}
    <div class="field"><div class="lbl">Total de Animais</div><div class="val" style="color:#2D6A2F">${totalCab} cabeças</div></div>
  </div>

  <h2>Relação de Animais</h2>
  <table>
    <thead>
      <tr><th>Identificação</th><th>Categoria</th><th>Sexo</th><th>Raça</th><th>Peso</th><th>SISBOV</th></tr>
    </thead>
    <tbody>${animalRows}</tbody>
  </table>
  <div class="total">Total: ${totalCab} cabeça${totalCab !== 1 ? 's' : ''}</div>

  <div class="assinaturas">
    <div class="assinatura">Assinatura do Remetente<br/><br/>${meta.fazProprietario || '________________'}</div>
    <div class="assinatura">Assinatura do Destinatário<br/><br/>________________</div>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── Importar animais via XLSX ────────────────────────────────────────────────

export interface ImportXLSXResult {
  adicionados: number;
  atualizados: number;
  ignorados:   number;
  erros:       string[];
}

/**
 * Lê a aba "Animais" de um arquivo XLSX exportado pelo GadoControl e
 * mescla com o banco local — adiciona novos e atualiza existentes por brinco.
 *
 * Colunas esperadas (case-insensitive, correspondendo ao exportarXLSX):
 * Brinco/Grupo | Tipo | Categoria | Sexo | Raça | Status | Nascimento |
 * Peso Atual (kg) | Peso Médio (kg) | Cabeças | Mãe | Pai/Touro |
 * SISBOV | GTA | Marca a Fogo | Observação
 */
export function importarXLSX(file: File): Promise<ImportXLSXResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const data  = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb    = XLSX.read(data, { type: 'array' });

        // Tenta encontrar a aba "Animais" (insensível a maiúsculas)
        const sheetName = wb.SheetNames.find(
          n => n.toLowerCase() === 'animais'
        ) ?? wb.SheetNames[0];

        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

        const db  = getDB();
        const now = new Date().toISOString();

        let adicionados = 0, atualizados = 0, ignorados = 0;
        const erros: string[] = [];

        const CATS_VALIDAS: AnimalCategoria[] = [
          'Bezerro','Bezerra','Desmamado','Novilho','Novilha','Matriz','Touro','Boi',
        ];
        const STATUS_VALIDOS: AnimalStatus[] = ['Vivo','Vendido','Morto'];

        // Normaliza cabeçalhos (remove acentos, converte para minúsculas)
        function col(row: Record<string, unknown>, ...keys: string[]): string {
          for (const k of keys) {
            const found = Object.keys(row).find(
              rk => rk.toLowerCase().replace(/[^a-z0-9]/gi, '') === k.toLowerCase().replace(/[^a-z0-9]/gi, '')
            );
            if (found !== undefined && row[found] !== '') return String(row[found]);
          }
          return '';
        }

        function parseDate(s: string): string | undefined {
          if (!s) return undefined;
          // Formatos: DD/MM/YYYY ou YYYY-MM-DD
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
            const [d, m, y] = s.split('/');
            return `${y}-${m}-${d}`;
          }
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          return undefined;
        }

        rows.forEach((row, idx) => {
          const brinco = col(row, 'BrincoGrupo', 'Brinco', 'brinco').trim();
          if (!brinco) { ignorados++; return; }

          const categoriaRaw = col(row, 'Categoria');
          const categoria    = CATS_VALIDAS.includes(categoriaRaw as AnimalCategoria)
            ? (categoriaRaw as AnimalCategoria)
            : 'Boi'; // fallback

          const statusRaw = col(row, 'Status');
          const status    = STATUS_VALIDOS.includes(statusRaw as AnimalStatus)
            ? (statusRaw as AnimalStatus)
            : 'Vivo';

          const sexoRaw = col(row, 'Sexo');
          const sexo    = (sexoRaw === 'Macho' || sexoRaw === 'Fêmea')
            ? sexoRaw as AnimalSexo
            : undefined;

          const pesoAtual = parseFloat(col(row, 'PesoAtualkg', 'PesoAtual')) || undefined;
          const pesoMedio = parseFloat(col(row, 'PesoMediokg', 'PesoMedio')) || undefined;
          const cabecas   = parseInt(col(row, 'Cabecas', 'Cabeças'))       || 1;
          const tipo      = col(row, 'Tipo') === 'grupo' ? 'grupo' : 'individual';

          const animal: Partial<Animal> = {
            brinco:         tipo === 'individual' ? brinco : '',
            nomeGrupo:      tipo === 'grupo'      ? brinco : undefined,
            tipo:           tipo as Animal['tipo'],
            categoria,
            sexo,
            status,
            raca:           col(row, 'Raca', 'Raça') || undefined,
            dataNascimento: parseDate(col(row, 'Nascimento')),
            pesoAtual,
            pesoMedio,
            qtdCabecas:     tipo === 'grupo' ? cabecas : undefined,
            cabecas:        tipo === 'individual' ? cabecas : undefined,
            mae:            col(row, 'Mae', 'Mãe') || undefined,
            pai:            col(row, 'PaiTouro', 'Pai') || undefined,
            sisbov:         col(row, 'SISBOV') || undefined,
            gta:            col(row, 'GTA') || undefined,
            marcaFogo:      col(row, 'MarcaaFogo', 'MarcaFogo') || undefined,
            observacao:     col(row, 'Observacao', 'Observação') || undefined,
          };

          // Procura animal existente pelo brinco
          const existing = db.animais.findIndex(
            a => (a.brinco || a.nomeGrupo || '').toLowerCase() === brinco.toLowerCase()
          );

          if (existing !== -1) {
            db.animais[existing] = {
              ...db.animais[existing],
              ...animal,
              updatedAt: now,
            };
            atualizados++;
          } else {
            db.animais.push({
              ...(animal as Omit<Animal, 'id' | 'createdAt' | 'updatedAt'>),
              id:        uid(),
              createdAt: now,
              updatedAt: now,
            } as Animal);
            adicionados++;
          }
        });

        saveDB(db);
        resolve({ adicionados, atualizados, ignorados, erros });
      } catch (err) {
        reject(new Error('Erro ao processar o arquivo XLSX: ' + String(err)));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
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
