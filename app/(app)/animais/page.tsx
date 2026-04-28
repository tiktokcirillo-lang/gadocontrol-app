'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/hooks/useDB';
import { sumCabecas } from '@/lib/db';
import { PLAN_LIMIT_FREE } from '@/lib/types';
import type { Animal, AnimalCategoria } from '@/lib/types';
import { AnimalCard } from '@/components/animals/AnimalCard';
import { AnimalForm } from '@/components/animals/AnimalForm';
import { AnimalDetail } from '@/components/animals/AnimalDetail';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

type StatusFilter = 'Vivo' | 'Vendido' | 'Morto' | 'todos';

const CATEGORIAS: AnimalCategoria[] = [
  'Bezerro','Bezerra','Desmamado','Novilho','Novilha','Matriz','Touro','Boi',
];

export default function AnimaisPage() {
  const { db, update }      = useDB();
  const { plan }            = useAuth();
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState<StatusFilter>('Vivo');
  const [catFilt, setCatFilt] = useState<AnimalCategoria | 'todas'>('todas');
  const [showFilter, setShowFilter] = useState(false);

  // Form / detalhe
  const [formOpen,   setFormOpen]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [detailId,   setDetailId]   = useState<string | null>(null);

  const animais = db.animais ?? [];
  const vivosCount = sumCabecas(animais.filter(a => a.status === 'Vivo'));

  const filtered = useMemo(() => {
    return animais.filter(a => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (a.brinco?.toLowerCase().includes(q)) ||
        (a.nomeGrupo?.toLowerCase().includes(q)) ||
        (a.raca?.toLowerCase().includes(q));
      const matchStatus = status === 'todos' || a.status === status;
      const matchCat    = catFilt === 'todas' || a.categoria === catFilt;
      return matchSearch && matchStatus && matchCat;
    }).sort((a, b) => (a.brinco || a.nomeGrupo || '').localeCompare(b.brinco || b.nomeGrupo || ''));
  }, [animais, search, status, catFilt]);

  function openNew() {
    if (plan !== 'pro' && vivosCount >= PLAN_LIMIT_FREE) {
      toast.error(`Limite de ${PLAN_LIMIT_FREE} animais no plano gratuito.`);
      return;
    }
    setEditId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditId(id);
    setFormOpen(true);
  }

  function handleDelete(id: string) {
    const a = animais.find(x => x.id === id);
    if (!a) return;
    if (!confirm(`Excluir ${a.brinco || a.nomeGrupo}?`)) return;
    update(d => { d.animais = d.animais.filter(x => x.id !== id); });
    toast.success('Animal excluído.');
    if (detailId === id) setDetailId(null);
  }

  const detailAnimal = detailId ? (animais.find(a => a.id === detailId) ?? null) : null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black">Animais</h1>
          <p className="text-xs text-muted-foreground">
            {vivosCount} cabeças vivas
            {plan !== 'pro' && ` · ${vivosCount}/${PLAN_LIMIT_FREE} no plano grátis`}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 text-white text-sm font-bold px-3 py-2 rounded-xl"
          style={{ background: '#2D6A2F' }}
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      {/* Plano limite */}
      {plan !== 'pro' && (
        <div className="rounded-xl overflow-hidden bg-muted h-1.5">
          <div
            className="h-full rounded-xl transition-all"
            style={{
              width: `${Math.min(100, (vivosCount / PLAN_LIMIT_FREE) * 100)}%`,
              background: vivosCount >= PLAN_LIMIT_FREE ? '#ef4444' : '#2D6A2F',
            }}
          />
        </div>
      )}

      {/* Busca + Filtro */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por brinco, nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm bg-background"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X size={13} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilter(v => !v)}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilter ? 'border-[#2D6A2F] text-[#2D6A2F] bg-green-50' : 'text-muted-foreground'}`}
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(['Vivo','Vendido','Morto','todos'] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              status === s ? 'text-white border-transparent' : 'text-muted-foreground'
            }`}
            style={status === s ? { background: '#2D6A2F' } : {}}
          >
            {s === 'todos' ? 'Todos' : s}
          </button>
        ))}
      </div>

      {/* Filtro de categoria */}
      {showFilter && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setCatFilt('todas')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${catFilt === 'todas' ? 'bg-muted' : ''}`}
          >
            Todas
          </button>
          {CATEGORIAS.map(c => (
            <button
              key={c}
              onClick={() => setCatFilt(c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${catFilt === c ? 'bg-muted' : ''}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <span className="text-5xl">🐄</span>
          <p className="font-bold">
            {animais.length === 0 ? 'Nenhum animal cadastrado' : 'Nenhum resultado'}
          </p>
          <p className="text-sm text-muted-foreground">
            {animais.length === 0
              ? 'Toque em "Novo" para cadastrar o primeiro animal.'
              : 'Tente outros filtros ou termos de busca.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} resultado(s)</p>
          {filtered.map(a => (
            <AnimalCard
              key={a.id}
              animal={a}
              onEdit={openEdit}
              onDelete={handleDelete}
              onDetail={setDetailId}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      <AnimalForm
        open={formOpen}
        animalId={editId}
        onClose={() => { setFormOpen(false); setEditId(null); }}
      />
      <AnimalDetail
        animal={detailAnimal}
        eventos={db.eventos ?? []}
        onClose={() => setDetailId(null)}
        onEdit={id => { setDetailId(null); openEdit(id); }}
      />
    </div>
  );
}
