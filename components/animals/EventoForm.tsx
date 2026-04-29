'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Mic, MicOff } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { VoiceButton } from '@/components/shared/VoiceButton';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useDB } from '@/hooks/useDB';
import { uid, today } from '@/lib/db';
import { aplicarEfeitos } from '@/lib/eventos';
import {
  vNorm, extrairBrinco, detectarTipoEvento,
  parseWeightFromSpeech, parseSpeechDate,
} from '@/lib/vozHelpers';
import {
  TIPOS_PESO, TIPOS_PRECO_VENDA, TIPOS_CUSTO_OPCIONAL, TIPOS_TOURO,
} from '@/lib/eventos';
import type { EventoTipo, Evento } from '@/lib/types';

const TODOS_TIPOS: EventoTipo[] = [
  'Nascimento', 'Desmame', 'Pesagem',
  'Vacina Clostridioses', 'Vacina Febre Aftosa', 'Vacina Brucelose',
  'Vacina Raiva', 'Vacina – Outro', 'Vermífugo',
  'Inseminação Artificial', 'Cobertura Natural',
  'IATF — D0 (Início Protocolo)', 'IATF — D8 (Prostaglandina)',
  'IATF — D17 (Retirada + EB)', 'IATF — Inseminação',
  'Diagnóstico de Gestação', 'ECC — Avaliação',
  'Banho Carrapaticida', 'Suplementação Mineral',
  'Custo / Despesa', 'Tratamento', 'Venda', 'Morte',
];

const CUSTO_CATS = [
  'Sanidade (vacinas)', 'Sanidade (vermífugo)', 'Sanidade (carrapaticida)',
  'Sanidade (tratamento)', 'Nutrição (suplemento)', 'Reprodução (IATF)',
  'Reprodução (monta natural)', 'Mão de obra', 'Combustível',
  'Manutenção', 'Equipamentos', 'Outro',
];

const DIAG_RESULTADOS = ['Positivo (Prenhe)', 'Negativo (Vazia)', 'Inconclusivo'];
const DIAG_METODOS    = ['Ultrassom', 'Palpação retal', 'Diagnóstico visual'];
const ECC_OPCOES      = [1,2,3,4,5,6,7,8,9];

interface Props {
  open:        boolean;
  eventoId?:   string | null;
  brincoFixed?: string;       // pré-seleciona animal (vindo do detalhe)
  tipoFixed?:  EventoTipo;    // pré-seleciona tipo
  onClose:     () => void;
}

function emptyForm() {
  return {
    brinco:     '',
    tipo:       '' as EventoTipo | '',
    data:       today(),
    detalhes:   '',
    peso:       '',
    preco:      '',
    touro:      '',
    custoCat:   '',
    custoCab:   '',
    custoVal:   '',
    ecc:        '',
    diagResult: '',
    diagMetodo: '',
    diagDias:   '',
    carrapProd: '',
    carrapPA:   '',
    carrapLote: '',
    suplProd:   '',
    suplCons:   '',
  };
}

export function EventoForm({ open, eventoId, brincoFixed, tipoFixed, onClose }: Props) {
  const { db, update } = useDB();
  const [form,   setForm]   = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [vozFeedback, setVozFeedback] = useState('');

  // Voz inteligente — preenche form todo a partir de uma frase
  const animaisVivos = (db.animais ?? []).filter(a => a.status === 'Vivo');

  function aplicarVozEvento(text: string) {
    const tln = vNorm(text);
    const partes: string[] = [];

    // Animal: busca brinco exato primeiro, depois extração
    let brinco = '';
    const tu = text.toUpperCase();
    for (const a of animaisVivos) {
      const b = (a.brinco || a.nomeGrupo || '').toUpperCase();
      if (b && tu.includes(b)) { brinco = a.brinco || a.nomeGrupo || ''; break; }
    }
    if (!brinco) {
      const b = extrairBrinco(text);
      if (b) {
        const found = animaisVivos.find(a =>
          (a.brinco || a.nomeGrupo || '').toUpperCase() === b ||
          (a.brinco || '').toUpperCase().endsWith(b)
        );
        brinco = found ? (found.brinco || found.nomeGrupo || '') : b;
      }
    }

    const tipo     = detectarTipoEvento(tln);
    const peso     = parseWeightFromSpeech(text);
    const data     = parseSpeechDate(text);

    setForm(f => ({
      ...f,
      ...(brinco && !brincoFixed ? { brinco } : {}),
      tipo,
      ...(peso  ? { peso: String(peso) } : {}),
      ...(data  ? { data }               : {}),
    }));

    if (brinco) partes.push('🐄 ' + brinco);
    else        partes.push('⚠️ Animal não identificado');
    partes.push('📋 ' + tipo);
    if (peso)  partes.push('⚖️ ' + peso + ' kg');
    if (data)  partes.push('📅 ' + data.split('-').reverse().join('/'));

    setVozFeedback(partes.join(' · ') + `\n"${text}"`);
    if (!brinco) toast.warning('Animal não reconhecido — selecione manualmente.');
    else         toast.success('Voz reconhecida! Confira e ajuste se necessário.');
  }

  const { listening, supported: vozSupported, toggle: toggleVoz } = useVoiceInput({
    onResult: aplicarVozEvento,
    continuous: false,
  });

  const tipo = form.tipo as EventoTipo | '';

  // Carrega dados ao abrir
  useEffect(() => {
    if (!open) return;
    if (eventoId) {
      const ev = (db.eventos ?? []).find(e => e.id === eventoId);
      if (ev) {
        setForm({
          brinco:     ev.brincoAnimal,
          tipo:       ev.tipo,
          data:       ev.data,
          detalhes:   ev.detalhes   ?? '',
          peso:       String(ev.peso   ?? ''),
          preco:      String(ev.preco  ?? ''),
          touro:      ev.touroDoador ?? '',
          custoCat:   ev.custoCat   ?? '',
          custoCab:   String(ev.custoCab ?? ''),
          custoVal:   String(ev.tipo === 'Custo / Despesa' ? (ev.preco ?? '') : ''),
          ecc:        String(ev.ecc        ?? ''),
          diagResult: ev.diagResult  ?? '',
          diagMetodo: ev.diagMetodo  ?? '',
          diagDias:   String(ev.diagDias   ?? ''),
          carrapProd: ev.carrapProd  ?? '',
          carrapPA:   ev.carrapPA    ?? '',
          carrapLote: ev.carrapLote  ?? '',
          suplProd:   ev.suplProd    ?? '',
          suplCons:   String(ev.suplCons   ?? ''),
        });
        return;
      }
    }
    const f = emptyForm();
    if (brincoFixed) f.brinco = brincoFixed;
    if (tipoFixed)   f.tipo   = tipoFixed;
    setForm(f);
    setVozFeedback('');
  }, [open, eventoId, brincoFixed, tipoFixed]);

  const set = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const showPeso       = tipo && TIPOS_PESO.includes(tipo as EventoTipo);
  const showPrecoVenda = tipo && TIPOS_PRECO_VENDA.includes(tipo as EventoTipo);
  const showCustoOpc   = tipo && TIPOS_CUSTO_OPCIONAL.includes(tipo as EventoTipo);
  const showTouro      = tipo && TIPOS_TOURO.includes(tipo as EventoTipo);
  const showCustoDirect = tipo === 'Custo / Despesa';
  const showECC        = tipo === 'ECC — Avaliação';
  const showDiag       = tipo === 'Diagnóstico de Gestação';
  const showCarrap     = tipo === 'Banho Carrapaticida';
  const showSupl       = tipo === 'Suplementação Mineral';

  function validate(): string | null {
    if (!form.brinco) return 'Selecione o animal.';
    if (!form.tipo)   return 'Selecione o tipo de evento.';
    if (!form.data)   return 'Data obrigatória.';
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    const now = new Date().toISOString();

    // Resolve preço final
    let precoFinal: number | undefined;
    if (showCustoDirect && form.custoVal) {
      precoFinal = Number(form.custoVal);
    } else if (showPrecoVenda && form.preco) {
      precoFinal = Number(form.preco);
    } else if (showCustoOpc && form.preco) {
      precoFinal = Number(form.preco);
    }

    update(d => {
      if (!d.eventos) d.eventos = [];

      const ev: Evento = {
        id:           eventoId ?? uid(),
        brincoAnimal: form.brinco,
        tipo:         form.tipo as EventoTipo,
        data:         form.data,
        detalhes:     form.detalhes.trim() || undefined,
        peso:         showPeso && form.peso ? Number(form.peso) : undefined,
        preco:        precoFinal,
        touroDoador:  showTouro ? form.touro.trim() || undefined : undefined,
        // Custo / Despesa
        custoCat:     showCustoDirect ? form.custoCat || undefined : undefined,
        custoCab:     showCustoDirect && form.custoCab ? Number(form.custoCab) : undefined,
        // ECC
        ecc:          showECC && form.ecc ? Number(form.ecc) : undefined,
        // Diagnóstico
        diagResult:   showDiag ? form.diagResult || undefined : undefined,
        diagMetodo:   showDiag ? form.diagMetodo || undefined : undefined,
        diagDias:     showDiag && form.diagDias ? Number(form.diagDias) : undefined,
        // Carrapaticida
        carrapProd:   showCarrap ? form.carrapProd || undefined : undefined,
        carrapPA:     showCarrap ? form.carrapPA   || undefined : undefined,
        carrapLote:   showCarrap ? form.carrapLote || undefined : undefined,
        // Suplementação
        suplProd:     showSupl ? form.suplProd   || undefined : undefined,
        suplCons:     showSupl && form.suplCons ? Number(form.suplCons) : undefined,
        createdAt:    now,
        updatedAt:    now,
      };

      if (eventoId) {
        const idx = d.eventos.findIndex(e => e.id === eventoId);
        if (idx !== -1) { d.eventos[idx] = ev; }
        toast.success('Evento atualizado!');
      } else {
        d.eventos.push(ev);
        aplicarEfeitos(d, ev);
        toast.success('Evento registrado!');
      }
    });

    setSaving(false);
    onClose();
  }

  // Animais disponíveis
  const animais = (db.animais ?? []).filter(a => a.status === 'Vivo').sort((a,b) =>
    (a.brinco || a.nomeGrupo || '').localeCompare(b.brinco || b.nomeGrupo || '')
  );

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle>{eventoId ? 'Editar Evento' : 'Registrar Evento'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-8">

          {/* Botão de voz global — preenche todos os campos */}
          {vozSupported && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={toggleVoz}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  listening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 border'
                }`}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {listening ? '⏹ Ouvindo... toque para parar' : '🎤 Registrar por Voz'}
              </button>
              {vozFeedback && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 px-3 py-2 text-xs text-green-800 dark:text-green-200 whitespace-pre-line">
                  🎙️ {vozFeedback}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center">
                Diga: <em>"brinco A001, vacina aftosa, 480 kg, hoje"</em>
              </p>
            </div>
          )}

          {/* Animal */}
          <Field label="Animal *">
            {brincoFixed ? (
              <div className="border rounded-md px-3 py-2 text-sm bg-muted">{brincoFixed}</div>
            ) : (
              <select
                value={form.brinco}
                onChange={e => set('brinco', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Selecione o animal...</option>
                {animais.map(a => (
                  <option key={a.id} value={a.brinco || a.nomeGrupo}>
                    {a.brinco || a.nomeGrupo} — {a.categoria}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* Tipo */}
          <Field label="Tipo *">
            <select
              value={form.tipo}
              onChange={e => set('tipo', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Selecione o tipo...</option>
              {TODOS_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          {/* Data */}
          <Field label="Data *">
            <Input type="date" value={form.data} onChange={e => set('data', e.target.value)} />
          </Field>

          {/* Peso */}
          {showPeso && (
            <Field label="Peso (kg)">
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.1" min="0" placeholder="0.0"
                  value={form.peso} onChange={e => set('peso', e.target.value)} />
                <VoiceButton onResult={t => {
                  const num = t.replace(/[^\d,.]/g, '').replace(',', '.');
                  if (num) set('peso', num);
                }} />
              </div>
            </Field>
          )}

          {/* Preço de venda */}
          {showPrecoVenda && (
            <Field label="Preço de Venda (R$)">
              <Input type="number" step="0.01" min="0" placeholder="0,00"
                value={form.preco} onChange={e => set('preco', e.target.value)} />
            </Field>
          )}

          {/* Custo opcional para eventos sanitários */}
          {showCustoOpc && (
            <Field label="Custo do procedimento (R$) — opcional">
              <Input type="number" step="0.01" min="0" placeholder="0,00"
                value={form.preco} onChange={e => set('preco', e.target.value)} />
            </Field>
          )}

          {/* Touro / Doador */}
          {showTouro && (
            <Field label="Touro / Doador (sêmen)">
              <Input placeholder="Nome ou código" value={form.touro} onChange={e => set('touro', e.target.value)} />
            </Field>
          )}

          {/* ECC */}
          {showECC && (
            <Field label="Escore de Condição Corporal (1–9)">
              <select value={form.ecc} onChange={e => set('ecc', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Selecione...</option>
                {ECC_OPCOES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          )}

          {/* Diagnóstico de Gestação */}
          {showDiag && (
            <div className="space-y-3">
              <Field label="Resultado">
                <select value={form.diagResult} onChange={e => set('diagResult', e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">Selecione...</option>
                  {DIAG_RESULTADOS.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Método">
                <select value={form.diagMetodo} onChange={e => set('diagMetodo', e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">Selecione...</option>
                  {DIAG_METODOS.map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Dias de gestação confirmados">
                <Input type="number" min="0" placeholder="Ex: 60"
                  value={form.diagDias} onChange={e => set('diagDias', e.target.value)} />
              </Field>
            </div>
          )}

          {/* Banho Carrapaticida */}
          {showCarrap && (
            <div className="space-y-3">
              <Field label="Produto Carrapaticida">
                <Input placeholder="Nome do produto" value={form.carrapProd} onChange={e => set('carrapProd', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Princípio Ativo">
                  <Input placeholder="Ex: Cipermetrina" value={form.carrapPA} onChange={e => set('carrapPA', e.target.value)} />
                </Field>
                <Field label="Nº Lote">
                  <Input placeholder="Lote do produto" value={form.carrapLote} onChange={e => set('carrapLote', e.target.value)} />
                </Field>
              </div>
              <Field label="Custo (R$) — opcional">
                <Input type="number" step="0.01" min="0" placeholder="0,00"
                  value={form.preco} onChange={e => set('preco', e.target.value)} />
              </Field>
            </div>
          )}

          {/* Suplementação Mineral */}
          {showSupl && (
            <div className="space-y-3">
              <Field label="Produto / Suplemento">
                <Input placeholder="Nome do suplemento" value={form.suplProd} onChange={e => set('suplProd', e.target.value)} />
              </Field>
              <Field label="Consumo (kg/cab/dia)">
                <Input type="number" step="0.01" min="0" placeholder="0,00"
                  value={form.suplCons} onChange={e => set('suplCons', e.target.value)} />
              </Field>
              <Field label="Custo (R$) — opcional">
                <Input type="number" step="0.01" min="0" placeholder="0,00"
                  value={form.preco} onChange={e => set('preco', e.target.value)} />
              </Field>
            </div>
          )}

          {/* Custo / Despesa direto */}
          {showCustoDirect && (
            <div className="space-y-3">
              <Field label="Categoria do Custo">
                <select value={form.custoCat} onChange={e => set('custoCat', e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">Selecione...</option>
                  {CUSTO_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor (R$)">
                  <Input type="number" step="0.01" min="0" placeholder="0,00"
                    value={form.custoVal} onChange={e => set('custoVal', e.target.value)} />
                </Field>
                <Field label="Nº animais">
                  <Input type="number" min="1" placeholder="1"
                    value={form.custoCab} onChange={e => set('custoCab', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {/* Detalhes */}
          <Field label="Detalhes / Observação">
            <div className="flex gap-2 items-start">
              <textarea rows={2} placeholder="Descreva o evento..."
                value={form.detalhes} onChange={e => set('detalhes', e.target.value)}
                className="flex-1 border rounded-md px-3 py-2 text-sm bg-background resize-none" />
              <VoiceButton onResult={t => set('detalhes', t)} />
            </div>
          </Field>

          <Button className="w-full font-bold h-11" style={{ background: '#2D6A2F' }}
            onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {eventoId ? 'Salvar Alterações' : 'Registrar Evento'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}
