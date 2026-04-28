'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useDB } from '@/hooks/useDB';
import { uid, today } from '@/lib/db';
import { aplicarEfeitos } from '@/lib/eventos';
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
              <Input type="number" step="0.1" min="0" placeholder="0.0"
                value={form.peso} onChange={e => set('peso', e.target.value)} />
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
            <textarea rows={2} placeholder="Descreva o evento..."
              value={form.detalhes} onChange={e => set('detalhes', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none" />
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
