'use client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ChevronRight } from 'lucide-react';
import type { Animal } from '@/lib/types';
import { CAT_ICON } from '@/lib/types';
import { fmtDate, getCabecas, idadeMeses } from '@/lib/db';

interface Props {
  animal:   Animal;
  onEdit:   (id: string) => void;
  onDelete?: (id: string) => void;
  onDetail: (id: string) => void;
}

export function AnimalCard({ animal, onEdit, onDelete, onDetail }: Props) {
  const icon   = CAT_ICON[animal.categoria] ?? '🐄';
  const cab    = getCabecas(animal);
  const meses  = idadeMeses(animal.dataNascimento);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onDetail(animal.id)}
    >
      {/* Ícone + brinco */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl"
           style={{ background: '#f0fdf4' }}>
        {icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-sm truncate">{animal.brinco || animal.nomeGrupo}</span>
          {cab > 1 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{cab} cab.</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">{animal.categoria}</span>
          {animal.raca && <span className="text-xs text-muted-foreground">· {animal.raca}</span>}
          {meses !== null && <span className="text-xs text-muted-foreground">· {meses}m</span>}
          {animal.pesoAtual && <span className="text-xs text-muted-foreground">· {animal.pesoAtual}kg</span>}
        </div>
      </div>

      {/* Status + ações */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <StatusBadge status={animal.status} />
        <button
          onClick={e => { e.stopPropagation(); onEdit(animal.id); }}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Pencil size={13} />
        </button>
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(animal.id); }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"
          >
            <Trash2 size={13} />
          </button>
        )}
        <ChevronRight size={14} className="text-muted-foreground" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Animal['status'] }) {
  if (status === 'Vivo')    return <Badge className="text-[10px] px-1.5 bg-green-100 text-green-700 border-0">Vivo</Badge>;
  if (status === 'Vendido') return <Badge className="text-[10px] px-1.5 bg-blue-100 text-blue-700 border-0">Vendido</Badge>;
  return <Badge className="text-[10px] px-1.5 bg-red-100 text-red-700 border-0">Morto</Badge>;
}
