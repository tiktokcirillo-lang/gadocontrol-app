'use client';
import type { DB, Animal } from './types';

const DB_KEY = 'gadocontrol_db';

export const emptyDB = (): DB => ({
  animais:       [],
  eventos:       [],
  lancamentos:   [],
  lotes:         [],
  pastos:        [],
  estoque:       [],
  protocolos:    [],
  estacoesMonta: [],
  meta:          {},
});

export function getDB(): DB {
  if (typeof window === 'undefined') return emptyDB();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDB();
    const parsed = JSON.parse(raw) as Partial<DB>;
    return {
      animais:       parsed.animais       ?? [],
      eventos:       parsed.eventos       ?? [],
      lancamentos:   parsed.lancamentos   ?? [],
      lotes:         parsed.lotes         ?? [],
      pastos:        parsed.pastos        ?? [],
      estoque:       parsed.estoque       ?? [],
      protocolos:    parsed.protocolos    ?? [],
      estacoesMonta: parsed.estacoesMonta ?? [],
      meta:          parsed.meta          ?? {},
    };
  } catch {
    return emptyDB();
  }
}

export function saveDB(db: DB): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Conta cabeças reais (inclui grupos)
export function getCabecas(animal: Animal): number {
  if (animal.tipo === 'grupo') return animal.qtdCabecas ?? 1;
  return animal.cabecas ?? 1;
}

export function sumCabecas(animais: Animal[]): number {
  return animais.reduce((s, a) => s + getCabecas(a), 0);
}

export function countAnimaisVivos(): number {
  const db = getDB();
  return sumCabecas((db.animais ?? []).filter(a => a.status === 'Vivo'));
}

// Gera ID único
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Formata moeda BRL
export function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata data DD/MM/AAAA
export function fmtDate(s?: string): string {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// Data de hoje em YYYY-MM-DD (timezone local)
export function today(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  );
}

// Adiciona dias a uma data
export function addDias(dateStr: string, dias: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Diferença em dias entre duas datas
export function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// Idade em meses
export function idadeMeses(dataNasc?: string): number | null {
  if (!dataNasc) return null;
  const d = diffDays(dataNasc, today());
  return Math.floor(d / 30);
}
