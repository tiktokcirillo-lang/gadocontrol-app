'use client';
import { useState, useMemo } from 'react';
import { useDB } from '@/hooks/useDB';
import { getDB, fmtDate } from '@/lib/db';
import { EventoForm } from '@/components/animals/EventoForm';
import type { EventoTipo } from '@/lib/types';

// ─── Vacinas como sub-menu ────────────────────────────────────────────────────
const VACINAS: { tipo: EventoTipo; label: string }[] = [
  { tipo: 'Vacina Febre Aftosa',  label: 'Febre Aftosa'  },
  { tipo: 'Vacina Clostridioses', label: 'Clostridioses' },
  { tipo: 'Vacina Brucelose',     label: 'Brucelose'     },
  { tipo: 'Vacina Raiva',         label: 'Raiva'         },
  { tipo: 'Vacina – Outro',       label: 'Outro'         },
];

// ─── Botões do modo campo ─────────────────────────────────────────────────────
type AcaoKey = EventoTipo | 'vacina-menu';

interface Acao {
  key:   AcaoKey;
  emoji: string;
  label: string;
  bg:    string;
}

const ACOES: Acao[] = [
  { key: 'Pesagem',             emoji: '⚖️',  label: 'Pesagem',    bg: '#2D6A2F' },
  { key: 'vacina-menu',         emoji: '💉',  label: 'Vacina',     bg: '#2563eb' },
  { key: 'Vermífugo',           emoji: '💊',  label: 'Vermífugo',  bg: '#7c3aed' },
  { key: 'Banho Carrapaticida', emoji: '🪣',  label: 'Banho',      bg: '#0891b2' },
  { key: 'Nascimento',          emoji: '🐮',  label: 'Nascimento', bg: '#16a34a' },
  { key: 'Tratamento',          emoji: '🩺',  label: 'Tratamento', bg: '#dc2626' },
  { key: 'Desmame',             emoji: '🍼',  label: 'Desmame',    bg: '#d97706' },
  { key: 'Venda',               emoji: '💰',  label: 'Venda',      bg: '#059669' },
  { key: 'Morte',               emoji: '🪦',  label: 'Morte',      bg: '#4b5563' },
  { key: 'Custo / Despesa',     emoji: '📋',  label: 'Custo',      bg: '#b45309' },
];

// ─── Página ──────────────────────────────────────────────────────────────────
export default function CampoPage() {
  const { db } = useDB();

  const [eventoOpen,   setEventoOpen]   = useState(false);
  const [tipoFixed,    setTipoFixed]    = useState<EventoTipo | undefined>();
  const [brincoFixed,  setBrincoFixed]  = useState<string | undefined>();
  const [showVacinas,  setShowVacinas]  = useState(false);
  const [ultimoBrinco, setUltimoBrinco] = useState<string | undefined>();

  // Últimos 6 eventos registrados (por createdAt desc)
  const ultimosEventos = useMemo(() =>
    [...(db.eventos ?? [])]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6),
    [db],
  );

  function abrir(tipo: EventoTipo, brinco?: string) {
    setTipoFixed(tipo);
    setBrincoFixed(brinco);
    setShowVacinas(false);
    setEventoOpen(true);
  }

  function fechar() {
    // Pega o animal do último evento registrado para o shortcut
    const todos = getDB().eventos ?? [];
    const ultimo = [...todos].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (ultimo?.brincoAnimal) setUltimoBrinco(ultimo.brincoAnimal);

    setEventoOpen(false);
    setTipoFixed(undefined);
    setBrincoFixed(undefined);
  }

  function handleAcao(acao: Acao) {
    if (acao.key === 'vacina-menu') {
      setShowVacinas(v => !v);
    } else {
      abrir(acao.key as EventoTipo);
    }
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black">⚡ Modo Campo</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Registros rápidos para uso no campo</p>
      </div>

      {/* Shortcut: último animal registrado */}
      {ultimoBrinco && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-3">
          <span className="text-2xl">🐄</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-green-700 uppercase tracking-wide">Último animal</p>
            <p className="text-sm font-black text-green-900 truncate">{ultimoBrinco}</p>
          </div>
          <button
            onClick={() => { setBrincoFixed(ultimoBrinco); setTipoFixed(undefined); setEventoOpen(true); }}
            className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl text-white"
            style={{ background: '#2D6A2F' }}>
            + Evento
          </button>
        </div>
      )}

      {/* Grid de ações */}
      <div className="grid grid-cols-2 gap-3">
        {ACOES.map(acao => (
          <div key={acao.key}>
            <button
              onClick={() => handleAcao(acao)}
              className="w-full py-5 rounded-2xl flex flex-col items-center gap-2 shadow-sm transition-transform active:scale-95 select-none"
              style={{ background: acao.bg }}>
              <span className="text-4xl leading-none">{acao.emoji}</span>
              <span className="text-white font-black text-sm tracking-wide">{acao.label}</span>
            </button>

            {/* Sub-menu vacinas */}
            {acao.key === 'vacina-menu' && showVacinas && (
              <div className="mt-1.5 rounded-xl border bg-blue-50 border-blue-200 p-2 space-y-0.5">
                {VACINAS.map(v => (
                  <button key={v.tipo}
                    onClick={() => abrir(v.tipo)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold text-blue-800 hover:bg-blue-100 active:bg-blue-200 transition-colors">
                    💉 {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Últimos registros */}
      {ultimosEventos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
            Últimos Registros
          </p>
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {ultimosEventos.map(ev => {
              const animal = (db.animais ?? []).find(a =>
                a.brinco === ev.brincoAnimal || a.nomeGrupo === ev.brincoAnimal,
              );
              return (
                <div key={ev.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{ev.brincoAnimal}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.tipo} · {fmtDate(ev.data)}
                      {animal && ` · ${animal.categoria}`}
                    </p>
                  </div>
                  <button
                    onClick={() => abrir(ev.tipo, ev.brincoAnimal)}
                    className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border text-muted-foreground hover:bg-muted active:bg-muted/80 transition-colors">
                    Repetir
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ultimosEventos.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center space-y-1">
          <p className="text-3xl">🐄</p>
          <p className="text-sm font-bold mt-2">Nenhum evento registrado ainda</p>
          <p className="text-xs text-muted-foreground">
            Toque em um botão acima para registrar o primeiro evento.
          </p>
        </div>
      )}

      <EventoForm
        open={eventoOpen}
        brincoFixed={brincoFixed}
        tipoFixed={tipoFixed}
        onClose={fechar}
      />
    </div>
  );
}
