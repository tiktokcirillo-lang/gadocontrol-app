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
import type { Lancamento } from '@/lib/types';

const CATS_RECEITA = [
  'Venda de Animal', 'Venda de Leite', 'Arrendamento',
  'Subsídio / PAA', 'Serviços', 'Outro',
];
const CATS_DESPESA = [
  'Ração / Mineral', 'Medicamento / Vacina', 'Mão de Obra',
  'Combustível', 'Manutenção', 'Impostos / Taxas',
  'Equipamentos', 'Sanidade (vacinas)', 'Sanidade (vermífugo)',
  'Sanidade (carrapaticida)', 'Sanidade (tratamento)',
  'Nutrição (suplemento)', 'Reprodução (IATF)', 'Outro',
];

interface Props {
  open:          boolean;
  lancamentoId?: string | null;
  tipoInicial?:  'receita' | 'despesa';
  onClose:       () => void;
}

export function LancamentoForm({ open, lancamentoId, tipoInicial = 'receita', onClose }: Props) {
  const { db, update } = useDB();
  const [tipo,      setTipo]      = useState<'receita' | 'despesa'>(tipoInicial);
  const [cat,       setCat]       = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor,     setValor]     = useState('');
  const [data,      setData]      = useState(today());
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (!open) return;
    if (lancamentoId) {
      const l = (db.lancamentos ?? []).find(x => x.id === lancamentoId);
      if (l) {
        setTipo(l.tipo);
        setCat(l.cat);
        setDescricao(l.descricao);
        setValor(String(l.valor));
        setData(l.data);
        return;
      }
    }
    setTipo(tipoInicial);
    setCat('');
    setDescricao('');
    setValor('');
    setData(today());
  }, [open, lancamentoId, tipoInicial]);

  async function handleSave() {
    if (!cat)       { toast.error('Selecione a categoria.'); return; }
    if (!descricao) { toast.error('Informe a descrição.'); return; }
    if (!valor || Number(valor) <= 0) { toast.error('Informe um valor válido.'); return; }
    if (!data)      { toast.error('Informe a data.'); return; }

    setSaving(true);
    update(d => {
      if (!d.lancamentos) d.lancamentos = [];
      const item: Lancamento = {
        id:        lancamentoId ?? uid(),
        tipo,
        cat,
        descricao: descricao.trim(),
        valor:     Number(valor),
        data,
        createdAt: lancamentoId
          ? (d.lancamentos.find(l => l.id === lancamentoId)?.createdAt ?? new Date().toISOString())
          : new Date().toISOString(),
      };
      if (lancamentoId) {
        const idx = d.lancamentos.findIndex(l => l.id === lancamentoId);
        if (idx !== -1) d.lancamentos[idx] = item;
        toast.success('Lançamento atualizado!');
      } else {
        d.lancamentos.push(item);
        toast.success(tipo === 'receita' ? '💚 Receita registrada!' : '🔴 Despesa registrada!');
      }
    });
    setSaving(false);
    onClose();
  }

  const cats = tipo === 'receita' ? CATS_RECEITA : CATS_DESPESA;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle>{lancamentoId ? 'Editar Lançamento' : 'Novo Lançamento'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-8">
          {/* Tipo toggle */}
          {!lancamentoId && (
            <div className="flex rounded-lg border p-1 gap-1">
              {(['receita', 'despesa'] as const).map(t => (
                <button key={t} onClick={() => { setTipo(t); setCat(''); }}
                  className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${tipo === t ? 'text-white' : 'text-muted-foreground'}`}
                  style={tipo === t ? { background: tipo === 'receita' ? '#15803d' : '#ef4444' } : {}}>
                  {t === 'receita' ? '💚 Receita' : '🔴 Despesa'}
                </button>
              ))}
            </div>
          )}

          {/* Categoria */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria *</Label>
            <select value={cat} onChange={e => setCat(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background">
              <option value="">Selecione...</option>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição *</Label>
            <Input placeholder="Ex: Venda de 5 novilhos" value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00"
                value={valor} onChange={e => setValor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data *</Label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} />
            </div>
          </div>

          <Button className="w-full font-bold h-11"
            style={{ background: tipo === 'receita' ? '#15803d' : '#ef4444' }}
            onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {lancamentoId ? 'Salvar Alterações' : tipo === 'receita' ? 'Registrar Receita' : 'Registrar Despesa'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
