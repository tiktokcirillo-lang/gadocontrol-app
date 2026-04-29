'use client';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Mic, MicOff, CheckCircle2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDB } from '@/hooks/useDB';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { uid, today } from '@/lib/db';
import { aplicarEfeitos } from '@/lib/eventos';
import type { Evento } from '@/lib/types';
import Link from 'next/link';

interface Registro {
  brinco: string;
  peso:   number;
  saved:  boolean;
}

// Extrai peso numérico de frases como "brinco A-1 peso 480" ou somente "480"
function parsarVoz(transcript: string): { brinco?: string; peso?: number } {
  const t = transcript.toLowerCase().trim();

  // Tenta padrão: "<brinco> <peso>"  ou  "brinco <id> peso <num>"
  const padraoCompleto = t.match(/brinco\s+([a-z0-9\-]+)\s+(?:peso\s+)?([\d]+(?:[.,]\d+)?)/i);
  if (padraoCompleto) {
    return {
      brinco: padraoCompleto[1].toUpperCase(),
      peso:   parseFloat(padraoCompleto[2].replace(',', '.')),
    };
  }

  // Só número → peso
  const soPeso = t.match(/^([\d]+(?:[.,]\d+)?)(?:\s*kg)?$/);
  if (soPeso) {
    return { peso: parseFloat(soPeso[1].replace(',', '.')) };
  }

  // Possível identificador + número
  const idNum = t.match(/([a-z][a-z0-9\-]*)\s+([\d]+(?:[.,]\d+)?)/i);
  if (idNum) {
    return {
      brinco: idNum[1].toUpperCase(),
      peso:   parseFloat(idNum[2].replace(',', '.')),
    };
  }

  return {};
}

export default function PesagemEmMassaPage() {
  const { db, update } = useDB();
  const [brinco, setBrinco]   = useState('');
  const [peso, setPeso]       = useState('');
  const [registros, setRegistros] = useState<Registro[]>([]);

  const animais = (db.animais ?? []).filter(a => a.status === 'Vivo');

  const handleVoz = useCallback((transcript: string) => {
    const parsed = parsarVoz(transcript);
    if (parsed.brinco) setBrinco(parsed.brinco);
    if (parsed.peso)   setPeso(String(parsed.peso));

    // Se tiver tudo, salva automaticamente
    if (parsed.brinco && parsed.peso) {
      salvarRegistro(parsed.brinco, parsed.peso);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const { listening, supported, toggle } = useVoiceInput({
    onResult: handleVoz,
    continuous: true,
  });

  function salvarRegistro(b: string, p: number) {
    const animalExiste = animais.some(
      a => a.brinco?.toUpperCase() === b.toUpperCase() ||
           a.nomeGrupo?.toUpperCase() === b.toUpperCase()
    );
    if (!animalExiste) {
      toast.error(`Animal "${b}" não encontrado!`);
      return;
    }
    if (p <= 0 || p > 2000) {
      toast.error('Peso inválido. Deve ser entre 1 e 2000 kg.');
      return;
    }

    const now = new Date().toISOString();
    const ev: Evento = {
      id:           uid(),
      brincoAnimal: b.toUpperCase(),
      tipo:         'Pesagem',
      data:         today(),
      peso:         p,
      createdAt:    now,
      updatedAt:    now,
    };

    update(d => {
      if (!d.eventos) d.eventos = [];
      d.eventos.push(ev);
      aplicarEfeitos(d, ev);
    });

    setRegistros(r => [{ brinco: b.toUpperCase(), peso: p, saved: true }, ...r]);
    setBrinco('');
    setPeso('');
    toast.success(`✓ ${b.toUpperCase()} — ${p} kg`);
  }

  function handleSalvarManual() {
    const b = brinco.trim().toUpperCase();
    const p = parseFloat(peso.replace(',', '.'));
    if (!b) { toast.error('Informe o brinco.'); return; }
    if (!p) { toast.error('Informe o peso.'); return; }
    salvarRegistro(b, p);
  }

  return (
    <div className="px-4 pt-4 pb-28 max-w-xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/campo" className="text-muted-foreground text-sm font-semibold">← Campo</Link>
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <Scale className="w-5 h-5" /> Pesagem em Massa
          </h1>
          <p className="text-xs text-muted-foreground">Fale o brinco e o peso ou digite</p>
        </div>
      </div>

      {/* Botão voz */}
      {supported && (
        <button
          onClick={toggle}
          className={`w-full py-6 rounded-2xl flex flex-col items-center gap-2 transition-all select-none shadow-md ${
            listening
              ? 'bg-red-500 text-white animate-pulse'
              : 'text-white'
          }`}
          style={listening ? {} : { background: '#2D6A2F' }}
        >
          {listening
            ? <MicOff className="w-10 h-10" />
            : <Mic    className="w-10 h-10" />}
          <span className="font-black text-lg">
            {listening ? 'PARAR — gravando...' : 'INICIAR PESAGEM POR VOZ'}
          </span>
          <span className="text-xs opacity-80">
            {listening
              ? 'Fale: "A001 480" ou "Brinco A001 peso 480"'
              : 'Toque para ativar o microfone'}
          </span>
        </button>
      )}

      {/* Preview do que o voice captou */}
      {listening && (brinco || peso) && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-bold text-green-700 uppercase">Capturado</p>
            <p className="text-lg font-black text-green-900">
              {brinco || '–'} &nbsp;|&nbsp; {peso ? `${peso} kg` : '– kg'}
            </p>
          </div>
          {brinco && peso && (
            <button
              onClick={handleSalvarManual}
              className="shrink-0 px-4 py-2 rounded-xl bg-green-600 text-white font-bold text-sm"
            >
              Confirmar
            </button>
          )}
        </div>
      )}

      {/* Entrada manual */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
          Entrada Manual
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Brinco</label>
            <Input
              placeholder="Ex: A001"
              value={brinco}
              onChange={e => setBrinco(e.target.value.toUpperCase())}
              list="animais-list"
            />
            <datalist id="animais-list">
              {animais.map(a => (
                <option key={a.id} value={a.brinco || a.nomeGrupo} />
              ))}
            </datalist>
          </div>
          <div style={{ width: 110 }}>
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Peso (kg)</label>
            <Input
              type="number"
              step="0.1"
              min="1"
              max="2000"
              placeholder="480"
              value={peso}
              onChange={e => setPeso(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="w-full font-bold"
          style={{ background: '#2D6A2F' }}
          onClick={handleSalvarManual}
        >
          + Registrar Pesagem
        </Button>
      </div>

      {/* Lista de registros da sessão */}
      {registros.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
              Registros desta sessão
            </p>
            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              {registros.length} pesagem{registros.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {registros.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold text-sm">{r.brinco}</p>
                </div>
                <span className="font-black text-sm tabular-nums">{r.peso} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {registros.length === 0 && (
        <div className="rounded-xl border bg-muted/30 p-8 text-center">
          <p className="text-4xl mb-2">⚖️</p>
          <p className="text-sm font-bold">Nenhuma pesagem ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Use o microfone ou o formulário acima para começar
          </p>
        </div>
      )}
    </div>
  );
}
