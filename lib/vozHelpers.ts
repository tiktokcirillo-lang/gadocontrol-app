'use client';

/**
 * Helpers de parsing de voz para o GadoControl.
 * Usados por EventoForm, AnimalForm, Campo e Pesagem.
 */

// ─── Normalização ─────────────────────────────────────────────────────────────

/** Remove acentos e converte para minúsculas */
export function vNorm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ─── Números por extenso → dígitos ───────────────────────────────────────────

const UNIDADES: Record<string, number> = {
  zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,
  seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,
  treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,
  dezessete:17,dezoito:18,dezenove:19,
};
const DEZENAS: Record<string, number> = {
  vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,
  setenta:70,oitenta:80,noventa:90,
};
const CENTENAS: Record<string, number> = {
  cem:100,cento:100,duzentos:200,duzentas:200,trezentos:300,trezentas:300,
  quatrocentos:400,quatrocentas:400,quinhentos:500,quinhentas:500,
  seiscentos:600,seiscentas:600,setecentos:700,setecentas:700,
  oitocentos:800,oitocentas:800,novecentos:900,novecentas:900,
};

export function numWordToDigit(tln: string): number | null {
  let acc = 0, last = 0;
  const words = tln.replace(/[^a-z\s]/g, ' ').split(/\s+/);
  let found = false;
  for (const w of words) {
    if (w === 'e') continue;
    if (CENTENAS[w] !== undefined) { acc += CENTENAS[w]; last = CENTENAS[w]; found = true; }
    else if (DEZENAS[w] !== undefined) { acc += DEZENAS[w]; last = DEZENAS[w]; found = true; }
    else if (UNIDADES[w] !== undefined) {
      if (last > 0 && last < 100) acc += UNIDADES[w] - last; // substituição (ex: "vinte e um" → 20+1-20? não)
      else acc += UNIDADES[w];
      last = UNIDADES[w]; found = true;
    }
  }
  return found ? acc : null;
}

// ─── Peso por fala ────────────────────────────────────────────────────────────

/** Extrai peso de texto: "480 kg", "480 quilos", "quatrocentos e oitenta quilos" */
export function parseWeightFromSpeech(txt: string): number | null {
  if (!txt) return null;
  // Tenta número direto com unidade
  const m = txt.match(/(\d+(?:[,.]\d+)?)\s*(?:kg|quilos?|kilos?)/i);
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'));
    return (!isNaN(n) && n > 0 && n < 2000) ? n : null;
  }
  // Tenta só número sem unidade (para pesagem contínua onde contexto é peso)
  const clean = txt.replace(/quilos?|kg|kilos?/gi, '').replace(',', '.').trim();
  const m2 = clean.match(/^(\d+(?:\.\d+)?)$/);
  if (m2) {
    const n = parseFloat(m2[1]);
    return (!isNaN(n) && n > 0 && n < 2000) ? n : null;
  }
  return null;
}

// ─── Data por fala ────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function shiftDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

const DIAS_SEMANA: Record<string, number> = {
  domingo:0, segunda:1, terca:2, quarta:3, quinta:4, sexta:5, sabado:6,
};

export function parseSpeechDate(text: string): string | undefined {
  const tln = vNorm(text);

  if (tln.includes('hoje'))    return todayStr();
  if (tln.includes('ontem'))   return shiftDay(-1);
  if (tln.includes('amanha') || tln.includes('amanha')) return shiftDay(1);

  // "anteontem" / "antes de ontem"
  if (tln.includes('anteontem') || (tln.includes('antes') && tln.includes('ontem')))
    return shiftDay(-2);

  // "dia 15" / "dia quinze"
  const diaM = tln.match(/\bdia\s+(\d{1,2}|\w+)\b/);
  if (diaM) {
    const raw   = diaM[1];
    const dia   = /^\d+$/.test(raw) ? parseInt(raw) : (numWordToDigit(raw) ?? null);
    if (dia && dia >= 1 && dia <= 31) {
      const d = new Date();
      d.setDate(dia);
      const s = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      return s;
    }
  }

  // Dia da semana: "segunda", "segunda-feira"
  for (const [nome, dow] of Object.entries(DIAS_SEMANA)) {
    if (tln.includes(nome)) {
      const hoje = new Date();
      const diff = (dow - hoje.getDay() + 7) % 7;
      const target = diff === 0 ? 0 : -7 + diff; // semana passada se não for hoje
      return shiftDay(target);
    }
  }

  return undefined;
}

// ─── Extração de brinco ───────────────────────────────────────────────────────

const CAT_KEYWORDS: [string, string[]][] = [
  ['Bezerro',   ['bezerro','bezerra','cria','terneiro','terneira']],
  ['Novilho',   ['novilho','garrote']],
  ['Novilha',   ['novilha']],
  ['Matriz',    ['matriz','vaca']],
  ['Touro',     ['touro','reprodutor']],
  ['Desmamado', ['desmamado']],
  ['Boi',       ['boi']],
];

/**
 * Tenta extrair brinco do texto:
 * 1. Prefixo explícito: "brinco A001", "número 42"
 * 2. Código alfanumérico sozinho: "A001", "B12"
 * 3. Após palavra de categoria: "o bezerro Pretinha" → "Pretinha"
 * 4. Número por extenso: "animal cento e vinte" → "120"
 */
export function extrairBrinco(text: string): string | null {
  const tu  = text.toUpperCase();
  const tln = vNorm(text);

  // 1. Explícito: "brinco X001" / "numero 42"
  const expl = text.match(/(?:brinco|numero|n[uú]mero|animal)\s+([A-Za-z0-9]+)/i);
  if (expl) return expl[1].toUpperCase();

  // 2. Código alfanumérico puro: letra(s) + número(s)
  const alphaNum = text.match(/\b([A-Z]{1,3}\d{1,4})\b/i);
  if (alphaNum) return alphaNum[1].toUpperCase();

  // 3. Após palavra de categoria: "a bezerra Pretinha"
  for (const [, kws] of CAT_KEYWORDS) {
    for (const kw of kws) {
      if (tln.includes(kw)) {
        const after = text.match(new RegExp(kw + '\\s+([A-Za-z0-9]+)', 'i'));
        if (after) return after[1].toUpperCase();
      }
    }
  }

  // 4. Número puro de 1-4 dígitos
  const numPuro = text.match(/\b(\d{1,4})\b/);
  if (numPuro) return numPuro[1];

  // 5. Número por extenso
  const n = numWordToDigit(tln);
  if (n !== null) return String(n);

  return null;
}

// ─── Detecção de tipo de evento ───────────────────────────────────────────────

import type { EventoTipo } from './types';

export function detectarTipoEvento(tln: string): EventoTipo {
  if (tln.includes('aftosa'))                              return 'Vacina Febre Aftosa';
  if (tln.includes('brucelo'))                             return 'Vacina Brucelose';
  if (tln.includes('raiva'))                               return 'Vacina Raiva';
  if (tln.includes('clostrid') || tln.includes('clostr')) return 'Vacina Clostridioses';
  if (tln.includes('vacin'))                               return 'Vacina – Outro';
  if (tln.includes('vermif') || tln.includes('vermi'))     return 'Vermífugo';
  if (tln.includes('banho') || tln.includes('carrap'))     return 'Banho Carrapaticida';
  if (tln.includes('trata') || tln.includes('medica'))     return 'Tratamento';
  if (tln.includes('nasci') || tln.includes('nasce'))      return 'Nascimento';
  if (tln.includes('desma'))                               return 'Desmame';
  if (tln.includes('insemi') || tln.includes('iatf'))      return 'Inseminação Artificial';
  if (tln.includes('cobert') || tln.includes('monta'))     return 'Cobertura Natural';
  if (tln.includes('custo') || tln.includes('despesa'))    return 'Custo / Despesa';
  if (tln.includes('venda') || tln.includes('vendeu'))     return 'Venda';
  if (tln.includes('morte') || tln.includes('morreu') || tln.includes('morto')) return 'Morte';
  return 'Pesagem';
}

// ─── Detecção de categoria de animal ─────────────────────────────────────────

import type { AnimalCategoria } from './types';

export function detectarCategoria(tln: string): AnimalCategoria {
  if (tln.includes('bezerra') || tln.includes('bezerr') ||
      tln.includes('cria')    || tln.includes('terneiro')) return 'Bezerro';
  if (tln.includes('novilha'))                             return 'Novilha';
  if (tln.includes('novil')   || tln.includes('garrote')) return 'Novilho';
  if (tln.includes('matriz')  || tln.includes('vaca'))    return 'Matriz';
  if (tln.includes('touro')   || tln.includes('reprodutor')) return 'Touro';
  if (tln.includes('desmam'))                              return 'Desmamado';
  if (tln.includes('boi'))                                 return 'Boi';
  return 'Desmamado'; // fallback
}

// ─── Detecção de raça ─────────────────────────────────────────────────────────

const RACAS: [string, string[]][] = [
  ['Nelore',    ['nelore']],
  ['Angus',     ['angus']],
  ['Brahman',   ['brahman']],
  ['Gir',       ['gir']],
  ['Girolando', ['girolando']],
  ['Simental',  ['simental']],
  ['Limousin',  ['limousin']],
  ['Caracu',    ['caracu']],
  ['Tabapuã',   ['tabapu']],
  ['Senepol',   ['senepol']],
  ['Canchim',   ['canchim']],
];

export function detectarRaca(tln: string): string | undefined {
  for (const [nome, kws] of RACAS) {
    for (const kw of kws) {
      if (tln.includes(kw)) return nome;
    }
  }
  return undefined;
}

// ─── Text-to-Speech ───────────────────────────────────────────────────────────

export function speakPt(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) setTimeout(onEnd, 0);
    return;
  }
  speechSynthesis.cancel();
  const u    = new SpeechSynthesisUtterance(text);
  u.lang     = 'pt-BR';
  u.rate     = 1.05;
  u.pitch    = 1;
  if (onEnd) u.onend = () => onEnd();
  speechSynthesis.speak(u);
}
