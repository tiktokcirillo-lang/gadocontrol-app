'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDB } from '@/hooks/useDB';
import { useAuth } from '@/contexts/AuthContext';
import { uid, today, sumCabecas } from '@/lib/db';
import { PLAN_LIMIT_FREE } from '@/lib/types';
import type { Animal, AnimalCategoria, AnimalSexo, AnimalTipo } from '@/lib/types';

interface Props {
  open:       boolean;
  animalId?:  string | null;
  onClose:    () => void;
}

type Mode = 'individual' | 'grupo';

const CATEGORIAS: AnimalCategoria[] = [
  'Bezerro','Bezerra','Desmamado','Novilho','Novilha','Matriz','Touro','Boi',
];

const RACAS = [
  'Nelore','Angus','Hereford','Brahman','Gir','Girolando','Senepol',
  'Simental','Limousin','Charolês','Tabapuã','Cruzamento','Outro',
];

function emptyForm() {
  return {
    brinco: '', nomeGrupo: '', qtdCabecas: '', categoria: '' as AnimalCategoria | '',
    sexo: '' as AnimalSexo | '', raca: '', dataNascimento: '', pesoAtual: '',
    pesoMedio: '', mae: '', pai: '', observacao: '', status: 'Vivo' as Animal['status'],
    sisbov: '', gta: '', marcaFogo: '', corteOrelha: '',
  };
}

export function AnimalForm({ open, animalId, onClose }: Props) {
  const { db, update } = useDB();
  const { plan }       = useAuth();
  const [mode,    setMode]    = useState<Mode>('individual');
  const [form,    setForm]    = useState(emptyForm());
  const [saving,  setSaving]  = useState(false);

  // Carrega dados ao editar
  useEffect(() => {
    if (!open) return;
    if (animalId) {
      const a = (db.animais ?? []).find(x => x.id === animalId);
      if (a) {
        setMode(a.tipo === 'grupo' ? 'grupo' : 'individual');
        setForm({
          brinco:        a.brinco       ?? '',
          nomeGrupo:     a.nomeGrupo    ?? '',
          qtdCabecas:    String(a.qtdCabecas ?? ''),
          categoria:     a.categoria    ?? '',
          sexo:          a.sexo         ?? '',
          raca:          a.raca         ?? '',
          dataNascimento: a.dataNascimento ?? '',
          pesoAtual:     String(a.pesoAtual  ?? ''),
          pesoMedio:     String(a.pesoMedio  ?? ''),
          mae:           a.mae          ?? '',
          pai:           a.pai          ?? '',
          observacao:    a.observacao   ?? '',
          status:        a.status,
          sisbov:        a.sisbov       ?? '',
          gta:           a.gta          ?? '',
          marcaFogo:     a.marcaFogo    ?? '',
          corteOrelha:   a.corteOrelha  ?? '',
        });
      }
    } else {
      setMode('individual');
      setForm(emptyForm());
    }
  }, [open, animalId]);

  const set = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  function validate(): string | null {
    if (mode === 'individual') {
      if (!form.brinco.trim()) return 'Informe o brinco / identificação.';
    } else {
      if (!form.nomeGrupo.trim()) return 'Informe o nome do grupo/lote.';
      if (!form.qtdCabecas || Number(form.qtdCabecas) < 2) return 'Grupo precisa ter ao menos 2 cabeças.';
    }
    if (!form.categoria) return 'Selecione a categoria.';
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { toast.error(err); return; }

    // Limite do plano free
    if (!animalId && plan !== 'pro') {
      const vivos = sumCabecas((db.animais ?? []).filter(a => a.status === 'Vivo'));
      const novas = mode === 'grupo' ? (Number(form.qtdCabecas) || 1) : 1;
      if (vivos + novas > PLAN_LIMIT_FREE) {
        toast.error(`Limite de ${PLAN_LIMIT_FREE} animais atingido no plano gratuito.`);
        return;
      }
    }

    setSaving(true);
    const now = new Date().toISOString();

    update(d => {
      if (!d.animais) d.animais = [];
      const tipo: AnimalTipo = mode;

      if (animalId) {
        const idx = d.animais.findIndex(a => a.id === animalId);
        if (idx !== -1) {
          d.animais[idx] = {
            ...d.animais[idx],
            tipo,
            brinco:        form.brinco.trim(),
            nomeGrupo:     form.nomeGrupo.trim() || undefined,
            qtdCabecas:    mode === 'grupo' ? Number(form.qtdCabecas) : undefined,
            categoria:     form.categoria as AnimalCategoria,
            sexo:          form.sexo as AnimalSexo || undefined,
            raca:          form.raca || undefined,
            dataNascimento: form.dataNascimento || undefined,
            pesoAtual:     form.pesoAtual  ? Number(form.pesoAtual)  : undefined,
            pesoMedio:     form.pesoMedio  ? Number(form.pesoMedio)  : undefined,
            mae:           form.mae.trim()        || undefined,
            pai:           form.pai.trim()        || undefined,
            observacao:    form.observacao.trim() || undefined,
            status:        form.status,
            sisbov:        form.sisbov.trim()     || undefined,
            gta:           form.gta.trim()        || undefined,
            marcaFogo:     form.marcaFogo.trim()  || undefined,
            corteOrelha:   form.corteOrelha.trim()|| undefined,
            updatedAt:     now,
          };
        }
        toast.success('Animal atualizado!');
      } else {
        const novo: Animal = {
          id:            uid(),
          tipo,
          brinco:        form.brinco.trim(),
          nomeGrupo:     form.nomeGrupo.trim() || undefined,
          qtdCabecas:    mode === 'grupo' ? Number(form.qtdCabecas) : undefined,
          categoria:     form.categoria as AnimalCategoria,
          sexo:          form.sexo as AnimalSexo || undefined,
          raca:          form.raca || undefined,
          dataNascimento: form.dataNascimento || undefined,
          pesoAtual:     form.pesoAtual  ? Number(form.pesoAtual)  : undefined,
          pesoMedio:     form.pesoMedio  ? Number(form.pesoMedio)  : undefined,
          mae:           form.mae.trim()        || undefined,
          pai:           form.pai.trim()        || undefined,
          observacao:    form.observacao.trim() || undefined,
          sisbov:        form.sisbov.trim()     || undefined,
          gta:           form.gta.trim()        || undefined,
          marcaFogo:     form.marcaFogo.trim()  || undefined,
          corteOrelha:   form.corteOrelha.trim()|| undefined,
          status:        'Vivo',
          createdAt:     now,
          updatedAt:     now,
        };
        d.animais.push(novo);
        toast.success('Animal cadastrado!');
      }
    });

    setSaving(false);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle>{animalId ? 'Editar Animal' : 'Novo Animal'}</SheetTitle>
        </SheetHeader>

        {/* Toggle modo */}
        {!animalId && (
          <div className="flex rounded-lg border p-1 mb-4 gap-1">
            <button
              onClick={() => setMode('individual')}
              className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors ${
                mode === 'individual' ? 'text-white' : 'text-muted-foreground'
              }`}
              style={mode === 'individual' ? { background: '#2D6A2F' } : {}}
            >
              Individual
            </button>
            <button
              onClick={() => setMode('grupo')}
              className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors ${
                mode === 'grupo' ? 'text-white' : 'text-muted-foreground'
              }`}
              style={mode === 'grupo' ? { background: '#2D6A2F' } : {}}
            >
              Grupo / Lote
            </button>
          </div>
        )}

        <div className="space-y-4 pb-6">
          {/* Identificação */}
          {mode === 'individual' ? (
            <Field label="Brinco / Identificação *">
              <Input placeholder="Ex: A001" value={form.brinco} onChange={e => set('brinco', e.target.value)} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do Grupo *" className="col-span-2">
                <Input placeholder="Ex: Lote Norte" value={form.nomeGrupo} onChange={e => set('nomeGrupo', e.target.value)} />
              </Field>
              <Field label="Nº de Cabeças *">
                <Input type="number" min={2} placeholder="10" value={form.qtdCabecas} onChange={e => set('qtdCabecas', e.target.value)} />
              </Field>
            </div>
          )}

          {/* Categoria + Sexo */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria *">
              <select
                value={form.categoria}
                onChange={e => set('categoria', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Selecione...</option>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Sexo">
              <select
                value={form.sexo}
                onChange={e => set('sexo', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Selecione...</option>
                <option>Macho</option>
                <option>Fêmea</option>
              </select>
            </Field>
          </div>

          {/* Raça + Data Nasc */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Raça">
              <select
                value={form.raca}
                onChange={e => set('raca', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Selecione...</option>
                {RACAS.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Data de Nascimento">
              <Input type="date" value={form.dataNascimento} onChange={e => set('dataNascimento', e.target.value)} />
            </Field>
          </div>

          {/* Peso */}
          <Field label={mode === 'grupo' ? 'Peso Médio (kg)' : 'Peso Atual (kg)'}>
            <Input
              type="number" step="0.1" min="0" placeholder="0.0"
              value={mode === 'grupo' ? form.pesoMedio : form.pesoAtual}
              onChange={e => set(mode === 'grupo' ? 'pesoMedio' : 'pesoAtual', e.target.value)}
            />
          </Field>

          {/* Filiação (apenas individual) */}
          {mode === 'individual' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mãe (brinco)">
                <Input placeholder="Brinco da mãe" value={form.mae} onChange={e => set('mae', e.target.value)} />
              </Field>
              <Field label="Pai / Touro">
                <Input placeholder="Nome ou brinco" value={form.pai} onChange={e => set('pai', e.target.value)} />
              </Field>
            </div>
          )}

          {/* Rastreabilidade (apenas individual) */}
          {mode === 'individual' && (
            <div className="space-y-3">
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest pt-1">
                Rastreabilidade (opcional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SISBOV (15 dígitos)">
                  <Input
                    placeholder="Ex: 076XXXXXXXXXX"
                    maxLength={15}
                    value={form.sisbov}
                    onChange={e => set('sisbov', e.target.value.replace(/\D/g, '').slice(0, 15))}
                  />
                </Field>
                <Field label="GTA (Guia de Trânsito)">
                  <Input placeholder="Nº GTA" value={form.gta} onChange={e => set('gta', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marca a Fogo">
                  <Input placeholder="Ex: FAZ-001" value={form.marcaFogo} onChange={e => set('marcaFogo', e.target.value)} />
                </Field>
                <Field label="Corte de Orelha">
                  <Input placeholder="Ex: T.D. simples" value={form.corteOrelha} onChange={e => set('corteOrelha', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {/* Observações */}
          <Field label="Observações">
            <textarea
              rows={2}
              placeholder="Anotações sobre o animal..."
              value={form.observacao}
              onChange={e => set('observacao', e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
            />
          </Field>

          {/* Status (só edição) */}
          {animalId && (
            <Field label="Status">
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as Animal['status'])}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option>Vivo</option>
                <option>Vendido</option>
                <option>Morto</option>
              </select>
            </Field>
          )}

          <Button
            className="w-full font-bold h-11"
            style={{ background: '#2D6A2F' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {animalId ? 'Salvar Alterações' : 'Cadastrar Animal'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label, children, className = '',
}: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}
