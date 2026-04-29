import type { DB, Evento, EventoTipo, Animal } from './types';
import { GESTACAO_DIAS, TIPO_CAT_DESPESA } from './types';
import { addDias } from './db';

// Tipos que mostram campo de peso
export const TIPOS_PESO: EventoTipo[] = ['Pesagem', 'Desmame', 'Nascimento', 'Venda'];

// Tipos que mostram campo de preço (venda)
export const TIPOS_PRECO_VENDA: EventoTipo[] = ['Venda'];

// Tipos que mostram custo opcional
export const TIPOS_CUSTO_OPCIONAL: EventoTipo[] = [
  'Vacina Clostridioses', 'Vacina Febre Aftosa', 'Vacina Brucelose',
  'Vacina Raiva', 'Vacina – Outro', 'Vermífugo',
  'Inseminação Artificial', 'Cobertura Natural',
  'IATF — D0 (Início Protocolo)', 'IATF — D8 (Prostaglandina)',
  'IATF — D17 (Retirada + EB)', 'IATF — Inseminação',
  'Banho Carrapaticida', 'Suplementação Mineral', 'Tratamento',
];

// Tipos que mostram touro/doador
export const TIPOS_TOURO: EventoTipo[] = ['Inseminação Artificial', 'Cobertura Natural'];

// Aplica efeitos no animal após registrar evento
export function aplicarEfeitos(db: DB, ev: Evento): void {
  const id  = ev.brincoAnimal?.toUpperCase() ?? '';
  const idx = db.animais.findIndex(
    a => (a.brinco?.toUpperCase() === id) || (a.nomeGrupo?.toUpperCase() === id),
  );
  if (idx === -1) return;
  const a = { ...db.animais[idx] };

  switch (ev.tipo) {
    case 'Desmame':
      a.categoria    = 'Desmamado';
      a.dataDesmame  = ev.data;
      if (ev.peso) a.pesoAtual = ev.peso;
      break;
    case 'Venda':
      a.status     = 'Vendido';
      a.dataVenda  = ev.data;
      if (ev.preco) a.precoVenda = ev.preco;
      break;
    case 'Morte':
      a.status = 'Morto';
      break;
    case 'Pesagem':
      if (ev.peso) a.pesoAtual = ev.peso;
      break;
    case 'Cobertura Natural':
    case 'Inseminação Artificial':
    case 'IATF — Inseminação':
      if (a.categoria === 'Matriz') {
        a.statusReprodutivo  = 'Prenhe';
        a.dataPrevistoParto  = addDias(ev.data, GESTACAO_DIAS);
      }
      break;
    case 'Nascimento':
      a.statusReprodutivo = 'Parida';
      a.dataUltimoParto   = ev.data;
      a.numeroParto       = (a.numeroParto ?? 0) + 1;
      a.dataPrevistoParto = undefined;
      break;
    case 'ECC — Avaliação':
      if (ev.ecc) a.eccAtual = ev.ecc;
      break;
    case 'Diagnóstico de Gestação':
      if (ev.diagResult === 'Positivo (Prenhe)') {
        a.statusReprodutivo = 'Prenhe';
        if (ev.diagDias) a.dataPrevistoParto = addDias(ev.data, GESTACAO_DIAS - ev.diagDias);
      } else if (ev.diagResult === 'Negativo (Vazia)') {
        a.statusReprodutivo = 'Vazia';
      }
      break;
    case 'Banho Carrapaticida':
      a.ultimoBanho = ev.data;
      break;
  }

  db.animais[idx] = a;
}

// Agrega despesas: Custo/Despesa + sanidade/reprodução com preco
export function calcDespesas(db: DB, de?: string | null, ate?: string | null) {
  const itens: Array<{
    id: string; tipo: 'despesa'; cat: string;
    desc: string; valor: number; data: string; origem: 'auto' | 'manual';
  }> = [];

  const todosTipos = new Set<string>([...Object.keys(TIPO_CAT_DESPESA), 'Custo / Despesa']);

  (db.eventos ?? [])
    .filter(e => todosTipos.has(e.tipo) && (e.preco ?? 0) > 0)
    .forEach(e => {
      if (de  && e.data < de)  return;
      if (ate && e.data > ate) return;
      const cat = e.tipo === 'Custo / Despesa'
        ? (e.custoCat || 'Outro')
        : (TIPO_CAT_DESPESA[e.tipo as keyof typeof TIPO_CAT_DESPESA] ?? 'Outro');
      itens.push({
        id: 'evt_' + e.id, tipo: 'despesa', cat,
        desc: e.detalhes || e.tipo,
        valor: e.preco!, data: e.data, origem: 'auto',
      });
    });

  (db.lancamentos ?? [])
    .filter(l => l.tipo === 'despesa')
    .forEach(l => {
      if (de  && l.data < de)  return;
      if (ate && l.data > ate) return;
      itens.push({ id: l.id, tipo: 'despesa', cat: l.cat, desc: l.descricao, valor: l.valor, data: l.data, origem: 'manual' });
    });

  return itens.sort((a, b) => b.data.localeCompare(a.data));
}

// Agrega receitas
export function calcReceitas(db: DB, de?: string | null, ate?: string | null) {
  const itens: Array<{
    id: string; tipo: 'receita'; cat: string;
    desc: string; valor: number; data: string; origem: 'auto' | 'manual';
  }> = [];

  // IDs de animais já contabilizados via status 'Vendido' (evita dupla contagem)
  const jaContados = new Set<string>();

  (db.animais ?? [])
    .filter(a => a.status === 'Vendido' && (a.precoVenda ?? 0) > 0)
    .forEach(a => {
      const data = a.dataVenda ?? '';
      if (de  && data && data < de)  return;
      if (ate && data && data > ate) return;
      const ident  = a.brinco || a.nomeGrupo || '—';
      const qtdStr = a.tipo === 'grupo' && a.qtdCabecas ? ` (${a.qtdCabecas} cab.)` : '';
      itens.push({
        id: 'venda_' + a.id, tipo: 'receita', cat: 'Venda de Animal',
        desc: ident + qtdStr + (a.categoria ? ' — ' + a.categoria : ''),
        valor: a.precoVenda!, data, origem: 'auto',
      });
      jaContados.add((ident).toUpperCase());
    });

  // Fallback: eventos de Venda com preco onde o efeito não foi aplicado (dados antigos / bug de lote)
  (db.eventos ?? [])
    .filter(e => e.tipo === 'Venda' && (e.preco ?? 0) > 0)
    .forEach(e => {
      const id = (e.brincoAnimal ?? '').toUpperCase();
      if (jaContados.has(id)) return; // já contabilizado via animal.precoVenda
      if (de  && e.data < de)  return;
      if (ate && e.data > ate) return;
      const animal = (db.animais ?? []).find(
        a => a.brinco?.toUpperCase() === id || a.nomeGrupo?.toUpperCase() === id,
      );
      const qtdStr = animal?.tipo === 'grupo' && animal.qtdCabecas
        ? ` (${animal.qtdCabecas} cab.)` : '';
      itens.push({
        id: 'evt_venda_' + e.id, tipo: 'receita', cat: 'Venda de Animal',
        desc: (e.brincoAnimal ?? '—') + qtdStr + (animal?.categoria ? ' — ' + animal.categoria : ''),
        valor: e.preco!, data: e.data, origem: 'auto',
      });
    });

  (db.lancamentos ?? [])
    .filter(l => l.tipo === 'receita')
    .forEach(l => {
      if (de  && l.data < de)  return;
      if (ate && l.data > ate) return;
      itens.push({ id: l.id, tipo: 'receita', cat: l.cat, desc: l.descricao, valor: l.valor, data: l.data, origem: 'manual' });
    });

  return itens.sort((a, b) => b.data.localeCompare(a.data));
}

// Datas de período (sem bug de timezone)
export function periodDates(periodo: string): { de: string | null; ate: string | null } {
  const now  = new Date();
  const ymd  = (d: Date) =>
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  const hoje = ymd(now);
  const y    = now.getFullYear();
  const m    = now.getMonth();

  if (periodo === 'mes')  return { de: ymd(new Date(y, m, 1)),  ate: ymd(new Date(y, m + 1, 0)) };
  if (periodo === 'trim') return { de: ymd(new Date(y, m - 3, 1)), ate: hoje };
  if (periodo === 'sem')  return { de: ymd(new Date(y, m - 6, 1)), ate: hoje };
  if (periodo === 'ano')  return { de: ymd(new Date(y, 0, 1)),  ate: ymd(new Date(y, 11, 31)) };
  return { de: null, ate: null };
}
