import type { DB, Evento, EventoTipo, Animal } from './types';
import { GESTACAO_DIAS, TIPO_CAT_DESPESA, ARROBA_KG } from './types';
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
    case 'Morte': {
      a.status = 'Morto';

      // ── Calcula perda financeira e registra como lançamento de despesa ──
      // Idempotente: usa ID determinístico para evitar duplicação.
      const lancId = `morte_${ev.id}`;
      const jaExiste = (db.lancamentos ?? []).some(l => l.id === lancId);

      if (!jaExiste) {
        const cabecas      = a.tipo === 'grupo' ? (a.qtdCabecas ?? 1) : 1;
        const pesoUnitario = a.pesoAtual ?? a.pesoMedio;
        const precoArroba  = db.meta?.precoArroba;
        const ident        = a.brinco || a.nomeGrupo || '—';

        let valorPerdido = 0;
        let obsCalculo   = '';

        if (pesoUnitario && precoArroba) {
          // Valor de mercado: peso vivo × rendimento 50% → arrobas × preço
          const arrobasUnit = (pesoUnitario * 0.5) / ARROBA_KG;
          valorPerdido = arrobasUnit * cabecas * precoArroba;
          obsCalculo   = `${pesoUnitario}kg/cab × ${cabecas} cab = ${(pesoUnitario * cabecas).toFixed(0)}kg → ${(arrobasUnit * cabecas).toFixed(1)}@ × R$${precoArroba}/@ (rend. 50%)`;
        } else if (a.precoCompra) {
          // Fallback: custo de aquisição como proxy do prejuízo
          valorPerdido = a.precoCompra * cabecas;
          obsCalculo   = `Custo de aquisição (sem peso ou preço de arroba configurado)`;
        }

        if (!obsCalculo) {
          obsCalculo = 'Sem peso ou preço/@ configurado — edite em Gestão → Metas.';
        }
        if (!db.lancamentos) db.lancamentos = [];
        db.lancamentos.push({
          id:         lancId,
          tipo:       'despesa',
          cat:        'Perda por Morte',
          descricao:  `Morte — ${ident}${cabecas > 1 ? ` (${cabecas} cab.)` : ''}`,
          valor:      Math.round(valorPerdido * 100) / 100,
          data:       ev.data,
          obs:        obsCalculo,
          createdAt:  new Date().toISOString(),
        });
      }
      break;
    }
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

// Migração retroativa: gera lancamentos de morte para eventos que não têm um
export function repararMorteLancamentos(db: DB): boolean {
  let alterou = false;

  (db.eventos ?? []).forEach(ev => {
    if (ev.tipo !== 'Morte') return;
    const lancId = `morte_${ev.id}`;
    if ((db.lancamentos ?? []).some(l => l.id === lancId)) return;

    const id     = (ev.brincoAnimal ?? '').toUpperCase();
    const animal = (db.animais ?? []).find(
      a => a.brinco?.toUpperCase() === id || a.nomeGrupo?.toUpperCase() === id,
    );
    const ident        = animal?.brinco || animal?.nomeGrupo || ev.brincoAnimal || '—';
    const cabecas      = animal?.tipo === 'grupo' ? (animal.qtdCabecas ?? 1) : 1;
    const pesoUnitario = animal?.pesoAtual ?? animal?.pesoMedio;
    const precoArroba  = db.meta?.precoArroba;

    let valorPerdido = 0;
    let obsCalculo   = '';

    if (pesoUnitario && precoArroba) {
      const arrobasUnit = (pesoUnitario * 0.5) / ARROBA_KG;
      valorPerdido = arrobasUnit * cabecas * precoArroba;
      obsCalculo   = `${pesoUnitario}kg/cab × ${cabecas} cab → ${(arrobasUnit * cabecas).toFixed(1)}@ × R$${precoArroba}/@ (rend. 50%) [retroativo]`;
    } else if (animal?.precoCompra) {
      valorPerdido = animal.precoCompra * cabecas;
      obsCalculo   = `Custo de aquisição [retroativo]`;
    } else {
      obsCalculo   = 'Sem peso ou preço/@ configurado — edite em Gestão → Metas.';
    }

    if (!db.lancamentos) db.lancamentos = [];
    db.lancamentos.push({
      id:        lancId,
      tipo:      'despesa',
      cat:       'Perda por Morte',
      descricao: `Morte — ${ident}${cabecas > 1 ? ` (${cabecas} cab.)` : ''}`,
      valor:     Math.round(valorPerdido * 100) / 100,
      data:      ev.data,
      obs:       obsCalculo,
      createdAt: new Date().toISOString(),
    });
    alterou = true;
  });

  return alterou;
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
