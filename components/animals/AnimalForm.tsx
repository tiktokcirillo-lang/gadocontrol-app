'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { VoiceButton } from '@/components/shared/VoiceButton';
import { PhotoCapture } from '@/components/shared/PhotoCapture';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useDB } from '@/hooks/useDB';
import { useAuth } from '@/contexts/AuthContext';
import { uid, today, sumCabecas } from '@/lib/db';
import { PLAN_LIMIT_FREE } from '@/lib/types';
import type { Animal, AnimalCategoria, AnimalSexo, AnimalTipo, Lancamento } from '@/lib/types';
import {
  vNorm, extrairBrinco, detectarCategoria, detectarRaca, parseWeightFromSpeech, parseSpeechDate,
} from '@/lib/vozHelpers';

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
    sisbov: '', gta: '', marcaFogo: '', corteOrelha: '', foto: '',
    // Compra
    comprado: false, precoCompra: '', dataCompra: '', origemCompra: '',
  };
}

export function AnimalForm({ open, animalId, onClose }: Props) {
  const { db, update } = useDB();
  const { plan, user } = useAuth();
  const [mode,       setMode]       = useState<Mode>('individual');
  const [form,       setForm]       = useState(emptyForm());
  const [saving,     setSaving]     = useState(false);
  const [vozFeedback, setVozFeedback] = useState('');

  // ── Voz inteligente para cadastro de animal ────────────────────────────────
  function aplicarVozAnimal(text: string) {
    const tln      = vNorm(text);
    const partes: string[] = [];
    const categoria = detectarCategoria(tln);
    const raca      = detectarRaca(tln);
    const peso      = parseWeightFromSpeech(text);
    const dataNasc  = parseSpeechDate(text);

    // Sexo: inferido da categoria ou palavras diretas
    let sexo: AnimalSexo | '' = '';
    if (tln.includes('misto') || tln.includes('mistos') || tln.includes('mista')) sexo = 'Misto';
    else if (tln.includes('macho'))  sexo = 'Macho';
    else if (tln.includes('femea') || tln.includes('fêmea')) sexo = 'Fêmea';
    else if (['Bezerra','Novilha','Matriz'].includes(categoria)) sexo = 'Fêmea';
    else if (['Bezerro','Novilho','Touro','Boi'].includes(categoria)) sexo = 'Macho';

    if (mode === 'grupo') {
      // ── Modo Grupo: extrai nome do lote/grupo e nº de cabeças ──
      // "lote Norte", "grupo dos Nelores", "nome Fazenda X"
      const nomeLoteM = text.match(
        /(?:lote|grupo|nome[:\s]+)\s*([A-Za-zÀ-ú0-9][A-Za-zÀ-ú0-9 ]{0,40}?)(?:\s+(?:\d|$|nelore|angus|brahman|gir|boi|vaca|touro))/i
      ) ?? text.match(/(?:lote|grupo)\s+([A-Za-zÀ-ú0-9 ]+)/i);
      const nomeGrupo = nomeLoteM ? nomeLoteM[1].trim() : '';

      // "50 cabeças" / "vinte animais"
      const cabM       = text.match(/(\d+)\s*(?:cabe[çc]as?|animais?|bovinos?|cab\.?)/i);
      const qtdCabecas = cabM ? cabM[1] : '';

      setForm(f => ({
        ...f,
        ...(nomeGrupo  ? { nomeGrupo }                   : {}),
        ...(qtdCabecas ? { qtdCabecas }                  : {}),
        ...(categoria  ? { categoria }                   : {}),
        ...(raca       ? { raca }                        : {}),
        ...(peso       ? { pesoMedio: String(peso) }     : {}),
      }));

      if (nomeGrupo)   partes.push('🗂 ' + nomeGrupo);
      else             partes.push('⚠️ Nome do grupo não identificado');
      partes.push('📂 ' + categoria);
      if (qtdCabecas)  partes.push('🔢 ' + qtdCabecas + ' cab.');
      if (raca)        partes.push('🌾 ' + raca);
      if (peso)        partes.push('⚖️ ' + peso + ' kg');

      setVozFeedback(partes.join(' · ') + `\n"${text}"`);
      if (!nomeGrupo) toast.warning('Nome do grupo não reconhecido — preencha manualmente.');
      else            toast.success('Voz reconhecida! Confira e ajuste se necessário.');

    } else {
      // ── Modo Individual: extrai brinco, data de nascimento e mãe ──
      const brinco = extrairBrinco(text);
      const maeM   = text.match(/(?:m[aã]e|filha de|da vaca)\s+([A-Za-z0-9]+)/i);
      const mae    = maeM ? maeM[1].toUpperCase() : '';

      setForm(f => ({
        ...f,
        ...(brinco   ? { brinco }                     : {}),
        ...(categoria? { categoria }                  : {}),
        ...(sexo     ? { sexo }                       : {}),
        ...(raca     ? { raca }                       : {}),
        ...(peso     ? { pesoAtual: String(peso) }    : {}),
        ...(dataNasc ? { dataNascimento: dataNasc }   : {}),
        ...(mae      ? { mae }                        : {}),
      }));

      if (brinco)   partes.push('🏷️ ' + brinco);
      else          partes.push('⚠️ Brinco não identificado');
      partes.push('📂 ' + categoria);
      if (raca)     partes.push('🌾 ' + raca);
      if (peso)     partes.push('⚖️ ' + peso + ' kg');
      if (dataNasc) partes.push('📅 ' + dataNasc.split('-').reverse().join('/'));
      if (mae)      partes.push('🐄 Mãe: ' + mae);

      setVozFeedback(partes.join(' · ') + `\n"${text}"`);
      if (!brinco) toast.warning('Brinco não reconhecido — preencha manualmente.');
      else         toast.success('Voz reconhecida! Confira e ajuste se necessário.');
    }
  }

  const { listening: vozListening, supported: vozSupported, toggle: toggleVoz } = useVoiceInput({
    onResult: aplicarVozAnimal,
    continuous: false,
  });

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
          foto:          a.foto         ?? '',
          comprado:      a.comprado     ?? false,
          precoCompra:   String(a.precoCompra ?? ''),
          dataCompra:    a.dataCompra   ?? '',
          origemCompra:  a.origemCompra ?? '',
        });
      }
    } else {
      setMode('individual');
      setForm(emptyForm());
    }
  }, [open, animalId]);

  const set  = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setForm(f => ({ ...f, [k]: v }));
  const setB = (k: keyof ReturnType<typeof emptyForm>, v: boolean) =>
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
    const now         = new Date().toISOString();
    const precoCompra = form.comprado && form.precoCompra ? Number(form.precoCompra) : 0;
    const qtdCab      = mode === 'grupo' ? (Number(form.qtdCabecas) || 1) : 1;
    // Para grupo: valor total = preço × cabeças (se por cabeça) — usamos valor como informado
    const valorCompra = precoCompra > 0 ? precoCompra : 0;

    update(d => {
      if (!d.animais) d.animais = [];
      const tipo: AnimalTipo = mode;

      // ── Campos comuns ──
      const compraFields = {
        comprado:     form.comprado || undefined,
        precoCompra:  precoCompra || undefined,
        dataCompra:   form.dataCompra || undefined,
        origemCompra: form.origemCompra.trim() || undefined,
      };

      if (animalId) {
        const idx = d.animais.findIndex(a => a.id === animalId);
        if (idx !== -1) {
          d.animais[idx] = {
            ...d.animais[idx],
            tipo,
            brinco:         form.brinco.trim(),
            nomeGrupo:      form.nomeGrupo.trim() || undefined,
            qtdCabecas:     mode === 'grupo' ? Number(form.qtdCabecas) : undefined,
            categoria:      form.categoria as AnimalCategoria,
            sexo:           form.sexo as AnimalSexo || undefined,
            raca:           form.raca || undefined,
            dataNascimento: form.dataNascimento || undefined,
            pesoAtual:      form.pesoAtual  ? Number(form.pesoAtual)  : undefined,
            pesoMedio:      form.pesoMedio  ? Number(form.pesoMedio)  : undefined,
            mae:            form.mae.trim()         || undefined,
            pai:            form.pai.trim()         || undefined,
            observacao:     form.observacao.trim()  || undefined,
            status:         form.status,
            sisbov:         form.sisbov.trim()      || undefined,
            gta:            form.gta.trim()         || undefined,
            marcaFogo:      form.marcaFogo.trim()   || undefined,
            corteOrelha:    form.corteOrelha.trim() || undefined,
            foto:           form.foto || undefined,
            ...compraFields,
            updatedAt:      now,
          };
        }
        toast.success('Animal atualizado!');
      } else {
        const ident  = (mode === 'grupo' ? form.nomeGrupo : form.brinco).trim();
        const novo: Animal = {
          id:             uid(),
          tipo,
          brinco:         form.brinco.trim(),
          nomeGrupo:      form.nomeGrupo.trim() || undefined,
          qtdCabecas:     mode === 'grupo' ? Number(form.qtdCabecas) : undefined,
          categoria:      form.categoria as AnimalCategoria,
          sexo:           form.sexo as AnimalSexo || undefined,
          raca:           form.raca || undefined,
          dataNascimento: form.dataNascimento || undefined,
          pesoAtual:      form.pesoAtual  ? Number(form.pesoAtual)  : undefined,
          pesoMedio:      form.pesoMedio  ? Number(form.pesoMedio)  : undefined,
          mae:            form.mae.trim()         || undefined,
          pai:            form.pai.trim()         || undefined,
          observacao:     form.observacao.trim()  || undefined,
          sisbov:         form.sisbov.trim()      || undefined,
          gta:            form.gta.trim()         || undefined,
          marcaFogo:      form.marcaFogo.trim()   || undefined,
          corteOrelha:    form.corteOrelha.trim() || undefined,
          foto:           form.foto || undefined,
          ...compraFields,
          status:         'Vivo',
          createdAt:      now,
          updatedAt:      now,
        };
        d.animais.push(novo);

        // ── Lançamento automático de compra ──────────────────────────────
        if (valorCompra > 0) {
          if (!d.lancamentos) d.lancamentos = [];
          const descQtd = mode === 'grupo' ? ` (${qtdCab} cab.)` : '';
          const lancamento: Lancamento = {
            id:        uid(),
            tipo:      'despesa',
            cat:       'Compra de Animal',
            descricao: `Compra: ${ident}${descQtd} — ${form.categoria}${form.origemCompra.trim() ? ' · ' + form.origemCompra.trim() : ''}`,
            valor:     valorCompra,
            data:      form.dataCompra || today(),
            createdAt: now,
          };
          d.lancamentos.push(lancamento);
        }

        toast.success(valorCompra > 0 ? 'Animal cadastrado e despesa lançada!' : 'Animal cadastrado!');
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
              onClick={() => { setMode('individual'); setVozFeedback(''); }}
              className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors ${
                mode === 'individual' ? 'text-white' : 'text-muted-foreground'
              }`}
              style={mode === 'individual' ? { background: '#2D6A2F' } : {}}
            >
              Individual
            </button>
            <button
              onClick={() => { setMode('grupo'); setVozFeedback(''); }}
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
          {/* Voz inteligente */}
          {vozSupported && (
            <div className="space-y-2 pb-1">
              <button
                type="button"
                onClick={toggleVoz}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  vozListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-muted/60 text-foreground hover:bg-muted'
                }`}
              >
                {vozListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {vozListening ? '⏹ Ouvindo...' : '🎤 Cadastrar por Voz'}
              </button>
              {vozFeedback && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/40 dark:border-green-800 px-3 py-2 text-xs text-green-800 dark:text-green-200 whitespace-pre-line">
                  🎙️ {vozFeedback}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center">
                {mode === 'grupo'
                  ? 'Diga: "lote Norte Nelore 50 cabeças 420 kg"'
                  : 'Diga: "bezerra Nelore brinco B002 peso 120kg nascida ontem filha de A001"'}
              </p>
            </div>
          )}

          {/* Identificação */}
          {mode === 'individual' ? (
            <Field label="Brinco / Identificação *">
              <div className="flex gap-2 items-center">
                <Input placeholder="Ex: A001" value={form.brinco} onChange={e => set('brinco', e.target.value)} />
                <VoiceButton onResult={t => set('brinco', t)} />
              </div>
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
                {mode === 'grupo' && <option>Misto</option>}
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
            <div className="flex gap-2 items-center">
              <Input
                type="number" step="0.1" min="0" placeholder="0.0"
                value={mode === 'grupo' ? form.pesoMedio : form.pesoAtual}
                onChange={e => set(mode === 'grupo' ? 'pesoMedio' : 'pesoAtual', e.target.value)}
              />
              <VoiceButton onResult={t => {
                const num = t.replace(/[^\d,.]/g, '').replace(',', '.');
                if (num) set(mode === 'grupo' ? 'pesoMedio' : 'pesoAtual', num);
              }} />
            </div>
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

          {/* Foto */}
          <PhotoCapture
            label="Foto do Animal"
            value={form.foto || undefined}
            onChange={v => set('foto', v ?? '')}
            ownerUid={user?.uid}
          />

          {/* Observações */}
          <Field label="Observações">
            <div className="flex gap-2 items-start">
              <textarea
                rows={2}
                placeholder="Anotações sobre o animal..."
                value={form.observacao}
                onChange={e => set('observacao', e.target.value)}
                className="flex-1 border rounded-md px-3 py-2 text-sm bg-background resize-none"
              />
              <VoiceButton onResult={t => set('observacao', t)} />
            </div>
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

          {/* ── Compra ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Animal Comprado?</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Lança automaticamente no financeiro
                </p>
              </div>
              <button
                type="button"
                onClick={() => setB('comprado', !form.comprado)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  form.comprado ? 'bg-green-600' : 'bg-muted'
                }`}
                role="switch"
                aria-checked={form.comprado}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                    form.comprado ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {form.comprado && (
              <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 space-y-3">
                <p className="text-[11px] font-black text-green-700 dark:text-green-300 uppercase tracking-widest">
                  Dados da Compra
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={mode === 'grupo' ? 'Valor Total (R$)' : 'Valor da Compra (R$)'}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={form.precoCompra}
                      onChange={e => set('precoCompra', e.target.value)}
                    />
                  </Field>
                  <Field label="Data da Compra">
                    <Input
                      type="date"
                      value={form.dataCompra}
                      onChange={e => set('dataCompra', e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Origem / Vendedor (opcional)">
                  <Input
                    placeholder="Ex: Fazenda São João"
                    value={form.origemCompra}
                    onChange={e => set('origemCompra', e.target.value)}
                  />
                </Field>

                {form.precoCompra && Number(form.precoCompra) > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-100 dark:bg-green-900/40 px-3 py-2 text-xs text-green-800 dark:text-green-200">
                    <span>💰</span>
                    <span>
                      {Number(form.precoCompra).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      {mode === 'grupo' && form.qtdCabecas && Number(form.qtdCabecas) > 0
                        ? ` total · ${(Number(form.precoCompra) / Number(form.qtdCabecas)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} /cabeça`
                        : ''
                      }
                      {' '}será lançado em <strong>Financeiro → Despesas</strong>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

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
