'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useDB } from '@/hooks/useDB';
import { uid } from '@/lib/db';
import type { EstoqueCategoria, EstoqueUnidade } from '@/lib/types';

const CATEGORIAS: EstoqueCategoria[] = [
  'Vacina', 'Medicamento', 'Vermífugo', 'Carrapaticida',
  'Suplemento Mineral', 'Ração / Sal', 'Equipamento', 'Outro',
];

const UNIDADES: EstoqueUnidade[] = ['doses', 'kg', 'L', 'ml', 'un.', 'sacos'];

interface Props {
  open:       boolean;
  itemId?:    string | null;
  onClose:    () => void;
}

function emptyForm() {
  return {
    nome:             '',
    categoria:        '' as EstoqueCategoria | '',
    unidade:          'doses' as EstoqueUnidade,
    quantidade:       '',
    quantidadeMinima: '',
    dataValidade:     '',
    lote:             '',
    fornecedor:       '',
    precoUnitario:    '',
    obs:              '',
  };
}

export function EstoqueForm({ open, itemId, onClose }: Props) {
  const { db, update } = useDB();
  const [form,   setForm]   = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  useEffect(() => {
    if (!open) return;
    if (itemId) {
      const item = (db.estoque ?? []).find(i => i.id === itemId);
      if (item) {
        setForm({
          nome:             item.nome,
          categoria:        item.categoria,
          unidade:          item.unidade,
          quantidade:       String(item.quantidade),
          quantidadeMinima: item.quantidadeMinima != null ? String(item.quantidadeMinima) : '',
          dataValidade:     item.dataValidade ?? '',
          lote:             item.lote ?? '',
          fornecedor:       item.fornecedor ?? '',
          precoUnitario:    item.precoUnitario != null ? String(item.precoUnitario) : '',
          obs:              item.obs ?? '',
        });
        return;
      }
    }
    setForm(emptyForm());
  }, [open, itemId]);   // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!form.nome.trim())  { toast.error('Informe o nome do produto.'); return; }
    if (!form.categoria)    { toast.error('Selecione a categoria.'); return; }
    if (form.quantidade === '' || Number(form.quantidade) < 0) {
      toast.error('Informe a quantidade em estoque.'); return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    update(d => {
      if (!d.estoque) d.estoque = [];
      const idx = itemId ? d.estoque.findIndex(i => i.id === itemId) : -1;
      const item = {
        id:               itemId ?? uid(),
        nome:             form.nome.trim(),
        categoria:        form.categoria as EstoqueCategoria,
        unidade:          form.unidade,
        quantidade:       Number(form.quantidade),
        quantidadeMinima: form.quantidadeMinima !== '' ? Number(form.quantidadeMinima) : undefined,
        dataValidade:     form.dataValidade || undefined,
        lote:             form.lote.trim() || undefined,
        fornecedor:       form.fornecedor.trim() || undefined,
        precoUnitario:    form.precoUnitario !== '' ? Number(form.precoUnitario) : undefined,
        obs:              form.obs.trim() || undefined,
        createdAt:        idx !== -1 ? d.estoque[idx].createdAt : now,
        updatedAt:        now,
      };
      if (idx !== -1) {
        d.estoque[idx] = item;
        toast.success('Produto atualizado!');
      } else {
        d.estoque.push(item);
        toast.success('Produto adicionado ao estoque!');
      }
    });
    setSaving(false);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle>{itemId ? 'Editar Produto' : 'Novo Produto no Estoque'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-8">
          {/* Nome */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome do Produto *</Label>
            <Input placeholder="Ex: Ivermectina 1%" value={form.nome} onChange={e => set('nome', e.target.value)} />
          </div>

          {/* Categoria + Unidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria *</Label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Selecione...</option>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unidade *</Label>
              <select value={form.unidade} onChange={e => set('unidade', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                {UNIDADES.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Quantidade + Mínimo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qtd. em Estoque *</Label>
              <Input type="number" step="0.1" min="0" placeholder="0"
                value={form.quantidade} onChange={e => set('quantidade', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qtd. Mínima (alerta)</Label>
              <Input type="number" step="0.1" min="0" placeholder="Ex: 10"
                value={form.quantidadeMinima} onChange={e => set('quantidadeMinima', e.target.value)} />
            </div>
          </div>

          {/* Data Validade + Lote */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Validade</Label>
              <Input type="date" value={form.dataValidade} onChange={e => set('dataValidade', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lote</Label>
              <Input placeholder="Ex: LOT2024-001" value={form.lote} onChange={e => set('lote', e.target.value)} />
            </div>
          </div>

          {/* Fornecedor + Preço unitário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fornecedor</Label>
              <Input placeholder="Nome do fornecedor" value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preço Unitário (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00"
                value={form.precoUnitario} onChange={e => set('precoUnitario', e.target.value)} />
            </div>
          </div>

          {/* Obs */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</Label>
            <Input placeholder="Opcional" value={form.obs} onChange={e => set('obs', e.target.value)} />
          </div>

          <Button className="w-full font-bold h-11"
            style={{ background: '#2D6A2F' }}
            onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {itemId ? 'Salvar Alterações' : 'Adicionar ao Estoque'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
