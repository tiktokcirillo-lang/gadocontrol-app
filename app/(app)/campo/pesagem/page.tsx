'use client';
import { useState, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Mic, MicOff, CheckCircle2, Scale, SkipForward, List, TableProperties, Zap, Bluetooth, BluetoothConnected, BluetoothOff } from 'lucide-react';

// ── Minimal Web Bluetooth type declarations ──────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
type BTDevice = {
  name?: string;
  gatt?: { connect(): Promise<BTServer>; disconnect(): void; connected: boolean };
  addEventListener(event: string, cb: () => void): void;
};
type BTServer  = { getPrimaryService(uuid: string): Promise<BTService> };
type BTService = { getCharacteristic(uuid: string): Promise<BTChar> };
type BTChar    = {
  startNotifications(): Promise<void>;
  addEventListener(e: string, cb: (ev: any) => void): void;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const BT_WEIGHT_SERVICE = '0000181d-0000-1000-8000-00805f9b34fb';
const BT_WEIGHT_CHAR    = '00002a9d-0000-1000-8000-00805f9b34fb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDB } from '@/hooks/useDB';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { uid, today } from '@/lib/db';
import { aplicarEfeitos } from '@/lib/eventos';
import { speakPt, parseWeightFromSpeech, vNorm } from '@/lib/vozHelpers';
import type { Animal, Evento } from '@/lib/types';
import Link from 'next/link';

type ViewMode = 'voz' | 'tabela';

interface Registro {
  brinco: string;
  peso:   number;
  saved:  boolean;
}

// Extrai peso numérico de frases como "brinco A-1 peso 480" ou somente "480"
function parsarVoz(transcript: string): { brinco?: string; peso?: number; pular?: boolean } {
  const t   = transcript.toLowerCase().trim();
  const tln = vNorm(t);

  // Detectar "próximo" / "pular" / "avançar"
  if (tln.includes('proximo') || tln.includes('pular') || tln.includes('avancar') || tln.includes('skip')) {
    return { pular: true };
  }

  // Tenta padrão: "brinco A001 peso 480"
  const padraoCompleto = t.match(/brinco\s+([a-z0-9\-]+)\s+(?:peso\s+)?([\d]+(?:[.,]\d+)?)/i);
  if (padraoCompleto) {
    return {
      brinco: padraoCompleto[1].toUpperCase(),
      peso:   parseFloat(padraoCompleto[2].replace(',', '.')),
    };
  }

  // Tenta parseWeightFromSpeech para frases como "quatrocentos quilos"
  const pesoParsed = parseWeightFromSpeech(transcript);
  if (pesoParsed) return { peso: pesoParsed };

  // Só número → peso
  const soPeso = t.match(/^([\d]+(?:[.,]\d+)?)(?:\s*kg)?$/);
  if (soPeso) {
    return { peso: parseFloat(soPeso[1].replace(',', '.')) };
  }

  // Identificador + número
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
  const [viewMode, setViewMode]   = useState<ViewMode>('voz');
  const [brinco, setBrinco]       = useState('');
  const [peso,   setPeso]         = useState('');
  const [registros, setRegistros] = useState<Registro[]>([]);

  // ── Modo Fila ────────────────────────────────────────────────────────────────
  const [filaAtiva,  setFilaAtiva]  = useState(false);
  const [filaAnimais, setFilaAnimais] = useState<Animal[]>([]);
  const [filaIdx,    setFilaIdx]    = useState(0);
  const [loteEscolhido, setLoteEscolhido] = useState('');

  // ── Bluetooth ─────────────────────────────────────────────────────────────────
  const [btStatus,   setBtStatus]   = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [btName,     setBtName]     = useState('');
  const btDeviceRef = useRef<BTDevice | null>(null);
  const btSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  async function conectarBT() {
    if (!btSupported) return;
    setBtStatus('connecting');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bt = (navigator as any).bluetooth;
      const device: BTDevice = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [BT_WEIGHT_SERVICE],
      });
      btDeviceRef.current = device;
      setBtName(device.name ?? 'Balança BT');
      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('idle');
        setBtName('');
        btDeviceRef.current = null;
        toast('Balança desconectada.');
      });
      const server  = await device.gatt!.connect();
      const service = await server.getPrimaryService(BT_WEIGHT_SERVICE);
      const char    = await service.getCharacteristic(BT_WEIGHT_CHAR);
      await char.startNotifications();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      char.addEventListener('characteristicvaluechanged', (e: any) => {
        const view: DataView = e.target.value;
        const flags   = view.getUint8(0);
        const isSI    = (flags & 0x01) === 0;
        const raw     = view.getUint16(1, true);
        const weightKg = isSI ? raw * 0.005 : raw * 0.01 * 0.453592;
        if (weightKg > 0 && weightKg <= 2000) {
          const rounded = Math.round(weightKg * 10) / 10;
          setPeso(String(rounded));
          speakPt(`${rounded} quilos`);
        }
      });
      setBtStatus('connected');
      toast.success(`Balança conectada: ${device.name ?? 'dispositivo BT'}`);
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'NotFoundError') {
        toast.error('Erro ao conectar balança. Verifique se ela suporta o perfil GATT Weight Scale.');
      }
      setBtStatus('idle');
    }
  }

  function desconectarBT() {
    btDeviceRef.current?.gatt?.disconnect();
    btDeviceRef.current = null;
    setBtStatus('idle');
    setBtName('');
  }

  // ── Modo Tabela ───────────────────────────────────────────────────────────────
  const [tabelaLote,  setTabelaLote]  = useState('');
  const [tabelaPesos, setTabelaPesos] = useState<Record<string, string>>({});

  const animais = (db.animais ?? []).filter(a => a.status === 'Vivo');
  const lotes   = db.lotes ?? [];

  const animalAtual = filaAtiva && filaAnimais.length > 0 && filaIdx < filaAnimais.length
    ? filaAnimais[filaIdx]
    : null;

  function iniciarFila() {
    const lista = loteEscolhido
      ? animais.filter(a => a.loteId === loteEscolhido)
      : animais;
    if (lista.length === 0) { toast.error('Nenhum animal encontrado.'); return; }
    setFilaAnimais(lista);
    setFilaIdx(0);
    setFilaAtiva(true);
    const brincoFirst = lista[0].brinco || lista[0].nomeGrupo || '';
    setBrinco(brincoFirst);
    setPeso('');
    speakPt(`Iniciando pesagem. Primeiro animal: ${brincoFirst}`);
    toast.success(`Fila iniciada: ${lista.length} animais`);
  }

  function encerrarFila() {
    setFilaAtiva(false);
    setFilaAnimais([]);
    setFilaIdx(0);
    setBrinco('');
    setPeso('');
  }

  function avancarFila() {
    const proximo = filaIdx + 1;
    if (proximo >= filaAnimais.length) {
      speakPt('Pesagem concluída! Todos os animais foram pesados.');
      toast.success('Fila concluída!');
      encerrarFila();
      return;
    }
    setFilaIdx(proximo);
    const brincoProx = filaAnimais[proximo].brinco || filaAnimais[proximo].nomeGrupo || '';
    setBrinco(brincoProx);
    setPeso('');
    speakPt(`Próximo: ${brincoProx}`);
  }

  // ── Voz ──────────────────────────────────────────────────────────────────────
  const handleVoz = useCallback((transcript: string) => {
    const parsed = parsarVoz(transcript);

    // Pular animal na fila
    if (parsed.pular && filaAtiva) {
      avancarFila();
      return;
    }

    const novoBrinco = parsed.brinco ?? (filaAtiva && animalAtual
      ? (animalAtual.brinco || animalAtual.nomeGrupo || '')
      : undefined);

    if (parsed.brinco) setBrinco(parsed.brinco);
    if (parsed.peso)   setPeso(String(parsed.peso));

    // Auto-save quando temos brinco + peso
    if (novoBrinco && parsed.peso) {
      salvarRegistro(novoBrinco, parsed.peso, /* autoAvanca */ filaAtiva);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, filaAtiva, filaIdx, filaAnimais, animalAtual]);

  const { listening, supported, toggle } = useVoiceInput({
    onResult: handleVoz,
    continuous: true,
  });

  function salvarRegistro(b: string, p: number, autoAvanca = false) {
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
    speakPt(`${b}, ${Math.round(p)} quilos. Confirmado.`);

    if (autoAvanca) {
      setTimeout(() => avancarFila(), 1200);
    }
  }

  function handleSalvarManual() {
    const b = brinco.trim().toUpperCase();
    const p = parseFloat(peso.replace(',', '.'));
    if (!b) { toast.error('Informe o brinco.'); return; }
    if (!p) { toast.error('Informe o peso.'); return; }
    salvarRegistro(b, p, filaAtiva);
  }

  const filaRestante = filaAnimais.length - filaIdx;

  // ── Funções Modo Tabela ───────────────────────────────────────────────────────
  const animaisTabelaFiltrados = useMemo(() => {
    const lista = animais;
    if (!tabelaLote) return lista;
    return lista.filter(a => a.loteId === tabelaLote);
  }, [animais, tabelaLote]);

  function salvarTabela() {
    const entradas = Object.entries(tabelaPesos).filter(([, v]) => v.trim() !== '');
    if (entradas.length === 0) { toast.error('Nenhum peso preenchido.'); return; }

    let salvos = 0, erros = 0;
    const now = new Date().toISOString();

    update(d => {
      if (!d.eventos) d.eventos = [];
      entradas.forEach(([animalId, pesoStr]) => {
        const p = parseFloat(pesoStr.replace(',', '.'));
        if (isNaN(p) || p <= 0 || p > 2000) { erros++; return; }

        const animal = animais.find(a => a.id === animalId);
        if (!animal) { erros++; return; }

        const b = (animal.brinco || animal.nomeGrupo || '').toUpperCase();
        const ev: Evento = {
          id:           uid(),
          brincoAnimal: b,
          tipo:         'Pesagem',
          data:         today(),
          peso:         p,
          createdAt:    now,
          updatedAt:    now,
        };
        d.eventos.push(ev);
        aplicarEfeitos(d, ev);
        setRegistros(r => [{ brinco: b, peso: p, saved: true }, ...r]);
        salvos++;
      });
    });

    setTabelaPesos({});
    toast.success(`${salvos} pesagem(ns) salva(s)${erros > 0 ? ` · ${erros} erro(s)` : ''}`);
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
          <p className="text-xs text-muted-foreground">Voz com TTS · Modo fila · Tabela · Bluetooth</p>
        </div>
      </div>

      {/* Toggle modo */}
      <div className="flex rounded-lg border p-1 gap-1">
        <button
          onClick={() => setViewMode('voz')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-colors ${viewMode === 'voz' ? 'text-white' : 'text-muted-foreground'}`}
          style={viewMode === 'voz' ? { background: '#2D6A2F' } : {}}
        >
          <Zap className="w-3.5 h-3.5" /> Voz / Fila
        </button>
        <button
          onClick={() => setViewMode('tabela')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-bold transition-colors ${viewMode === 'tabela' ? 'text-white' : 'text-muted-foreground'}`}
          style={viewMode === 'tabela' ? { background: '#2D6A2F' } : {}}
        >
          <TableProperties className="w-3.5 h-3.5" /> Tabela
        </button>
      </div>

      {/* ── MODO TABELA ── */}
      {viewMode === 'tabela' && (
        <div className="space-y-3">
          {lotes.length > 0 && (
            <select
              value={tabelaLote}
              onChange={e => { setTabelaLote(e.target.value); setTabelaPesos({}); }}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Todos os animais</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          )}

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-0 bg-muted/50 px-3 py-2 text-[10px] font-black uppercase text-muted-foreground tracking-wide">
              <div className="col-span-3">Brinco</div>
              <div className="col-span-3">Cat.</div>
              <div className="col-span-3 text-right">Anterior</div>
              <div className="col-span-3 text-right">Novo (kg)</div>
            </div>
            <div className="divide-y max-h-[50vh] overflow-y-auto">
              {animaisTabelaFiltrados.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum animal encontrado
                </div>
              ) : (
                animaisTabelaFiltrados.map(a => (
                  <div key={a.id} className="grid grid-cols-12 gap-0 px-3 py-2 items-center">
                    <div className="col-span-3 font-bold text-sm truncate">
                      {a.brinco || a.nomeGrupo}
                    </div>
                    <div className="col-span-3 text-xs text-muted-foreground truncate">
                      {a.categoria}
                    </div>
                    <div className="col-span-3 text-xs text-right text-muted-foreground">
                      {a.pesoAtual ? `${a.pesoAtual} kg` : '—'}
                    </div>
                    <div className="col-span-3 pl-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        max="2000"
                        placeholder="—"
                        value={tabelaPesos[a.id] ?? ''}
                        onChange={e => setTabelaPesos(prev => ({ ...prev, [a.id]: e.target.value }))}
                        className="h-8 text-right text-sm px-2"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {animaisTabelaFiltrados.length > 0 && (
            <Button
              className="w-full font-bold h-11"
              style={{ background: '#2D6A2F' }}
              onClick={salvarTabela}
            >
              ✓ Salvar {Object.values(tabelaPesos).filter(v => v.trim() !== '').length} Pesagem(ns)
            </Button>
          )}
        </div>
      )}

      {viewMode === 'voz' && (<>

      {/* ── MODO FILA ── */}
      {!filaAtiva ? (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
              Modo Fila (TTS)
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Pese animais um a um com anúncio de voz. Fale o peso e avance automaticamente.
          </p>
          {lotes.length > 0 && (
            <select
              value={loteEscolhido}
              onChange={e => setLoteEscolhido(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Todos os animais</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          )}
          <Button
            className="w-full font-bold"
            style={{ background: '#2D6A2F' }}
            onClick={iniciarFila}
          >
            Iniciar Fila com TTS
          </Button>
        </div>
      ) : (
        /* Painel da fila ativa */
        <div className="rounded-2xl border-2 border-green-400 bg-green-50 dark:bg-green-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-green-700 dark:text-green-300 uppercase tracking-wide">
              Modo Fila Ativo · {filaRestante} restante{filaRestante !== 1 ? 's' : ''}
            </p>
            <button onClick={encerrarFila} className="text-xs font-bold text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
              ✕ Encerrar
            </button>
          </div>

          {animalAtual && (
            <div className="text-center py-2">
              <p className="text-[11px] text-green-600 dark:text-green-400 font-bold uppercase">Pesar agora</p>
              <p className="text-3xl font-black text-green-900 dark:text-green-100 mt-1">
                {animalAtual.brinco || animalAtual.nomeGrupo}
              </p>
              {animalAtual.categoria && (
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  {animalAtual.categoria}{animalAtual.raca ? ' · ' + animalAtual.raca : ''}
                  {animalAtual.pesoAtual ? ` · Último: ${animalAtual.pesoAtual} kg` : ''}
                </p>
              )}
            </div>
          )}

          {/* Progresso */}
          <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-green-600 h-1.5 rounded-full transition-all"
              style={{ width: `${((filaIdx) / filaAnimais.length) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-green-600 dark:text-green-400 text-center">
            {filaIdx} / {filaAnimais.length} — diga &quot;pular&quot; para avançar sem pesar
          </p>

          <button
            onClick={avancarFila}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-green-300 py-2 text-sm font-bold text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
          >
            <SkipForward className="w-4 h-4" /> Pular / Próximo
          </button>
        </div>
      )}

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
              ? filaAtiva ? 'Fale o peso · diga "pular" para avançar' : 'Fale: "A001 480" ou "Brinco A001 peso 480"'
              : 'Toque para ativar o microfone'}
          </span>
        </button>
      )}

      {/* Preview do que o voice captou */}
      {listening && (brinco || peso) && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50 dark:bg-green-950/40 p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Capturado</p>
            <p className="text-lg font-black text-green-900 dark:text-green-100">
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

      {/* Balança Bluetooth */}
      {btSupported && (
        <div className={`rounded-xl border p-4 space-y-3 ${btStatus === 'connected' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30' : 'bg-card'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Bluetooth className="w-3.5 h-3.5" /> Balança Bluetooth
            </p>
            {btStatus === 'connected' && (
              <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <BluetoothConnected className="w-3 h-3" /> {btName}
              </span>
            )}
          </div>

          {btStatus === 'idle' && (
            <>
              <p className="text-xs text-muted-foreground">
                Conecte uma balança BLE compatível com o perfil GATT Weight Scale. O peso será preenchido automaticamente.
              </p>
              <button
                onClick={conectarBT}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white"
                style={{ background: '#1a56db' }}
              >
                <Bluetooth className="w-4 h-4" /> Conectar Balança
              </button>
            </>
          )}

          {btStatus === 'connecting' && (
            <p className="text-xs text-center text-blue-700 font-bold py-1 animate-pulse">Buscando dispositivos…</p>
          )}

          {btStatus === 'connected' && (
            <div className="space-y-2">
              <p className="text-xs text-blue-700">
                Aguardando leitura — o peso será preenchido automaticamente ao pesar.
              </p>
              <button
                onClick={desconectarBT}
                className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline"
              >
                <BluetoothOff className="w-3.5 h-3.5" /> Desconectar
              </button>
            </div>
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

      {registros.length === 0 && (
        <div className="rounded-xl border bg-muted/30 p-8 text-center">
          <p className="text-4xl mb-2">⚖️</p>
          <p className="text-sm font-bold">Nenhuma pesagem ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Use o microfone, o modo fila ou o formulário acima para começar
          </p>
        </div>
      )}
      </>)}

      {/* Registros da sessão — visíveis em ambos os modos */}
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
    </div>
  );
}
