'use client';
import { useState, useMemo } from 'react';
import { Plus, Search, SlidersHorizontal, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/hooks/useDB';
import { sumCabecas, today } from '@/lib/db';
import { PLAN_LIMIT_FREE } from '@/lib/types';
import type { AnimalCategoria } from '@/lib/types';
import { AnimalCard } from '@/components/animals/AnimalCard';
import { AnimalForm } from '@/components/animals/AnimalForm';
import { AnimalDetail } from '@/components/animals/AnimalDetail';
import { EventoForm } from '@/components/animals/EventoForm';
import { useAuth } from '@/contexts/AuthContext';
import { imprimirGTA } from '@/lib/exportar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type StatusFilter = 'Vivo' | 'Vendido' | 'Morto' | 'todos';

const CATEGORIAS: AnimalCategoria[] = [
  'Bezerro','Bezerra','Desmamado','Novilho','Novilha','Matriz','Touro','Boi',
];

export default function AnimaisPage() {
  const { db, update }        = useDB();
  const { plan }              = useAuth();
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState<StatusFilter>('Vivo');
  const [catFilt, setCatFilt] = useState<AnimalCategoria | 'todas'>('todas');
  const [showFilter, setShowFilter] = useState(false);

  const [formOpen,      setFormOpen]      = useState(false);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [detailId,      setDetailId]      = useState<string | null>(null);
  const [eventoOpen,    setEventoOpen]    = useState(false);
  const [eventoBrinco,  setEventoBrinco]  = useState<string | undefined>();
  const [gtaOpen,       setGtaOpen]       = useState(false);
  const [gtaSel,        setGtaSel]        = useState<string[]>([]);
  const [gtaDestino,    setGtaDestino]    = useState('');
  const [gtaData,       setGtaData]       = useState(today());
  const [gtaMotorista,  setGtaMotorista]  = useState('');
  const [gtaPlaca,      setGtaPlaca]      = useState('');

  const animais    = db.animais ?? [];
  const vivosCount = sumCabecas(animais.filter(a => a.status === 'Vivo'));

  const filtered = useMemo(() => animais.filter(a => {
    const q = search.toLowerCase();
    return (
      (!q || (a.brinco?.toLowerCase().includes(q)) || (a.nomeGrupo?.toLowerCase().includes(q)) || (a.raca?.toLowerCase().includes(q))) &&
      (status === 'todos' || a.status === status) &&
      (catFilt === 'todas' || a.categoria === catFilt)
    );
  }).sort((a, b) => (a.brinco || a.nomeGrupo || '').localeCompare(b.brinco || b.nomeGrupo || '')),
  [animais, search, status, catFilt]);

  function openNew() {
    if (plan !== 'pro' && vivosCount >= PLAN_LIMIT_FREE) {
      toast.error(`Limite de ${PLAN_LIMIT_FREE} animais no plano gratuito.`);
      return;
    }
    setEditId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) { setEditId(id); setFormOpen(true); }

  function openEvento(brinco: string) {
    setEventoBrinco(brinco);
    setDetailId(null);
    setEventoOpen(true);
  }

  function handleDelete(id: string) {
    const a = animais.find(x => x.id === id);
    if (!a || !confirm(`Excluir ${a.brinco || a.nomeGrupo}?`)) return;
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
        <div className="flex gap-2">
          <button onClick={() => openEvento('')}
            className="flex items-center gap-1 text-sm font-bold px-3 py-2 rounded-xl border"
            style={{ borderColor: '#2D6A2F', color: '#2D6A2F' }}>
            + Evento
          </button>
          <button onClick={() => setGtaOpen(true)}
            className="flex items-center gap-1 text-sm font-bold px-3 py-2 rounded-xl border"
            title="GTA Digital"
            style={{ borderColor: '#b45309', color: '#b45309' }}>
            <FileText size={14} /> GTA
          </button>
          <button onClick={openNew}
            className="flex items-center gap-1.5 text-white text-sm font-bold px-3 py-2 rounded-xl"
            style={{ background: '#2D6A2F' }}>
            <Plus size={16} /> Animal
          </button>
        </div>
      </div>

      {/* Barra progresso plano */}
      {plan !== 'pro' && (
        <div className="rounded-xl overflow-hidden bg-muted h-1.5">
          <div className="h-full rounded-xl transition-all"
            style={{
              width: `${Math.min(100, (vivosCount / PLAN_LIMIT_FREE) * 100)}%`,
              background: vivosCount >= PLAN_LIMIT_FREE ? '#ef4444' : '#2D6A2F',
            }} />
        </div>
      )}

      {/* Busca + Filtro */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar brinco, nome, raça..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-lg pl-8 pr-8 py-2 text-sm bg-background" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X size={13} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilter(v => !v)}
          className={`px-3 py-2 rounded-lg border text-sm transition-colors ${showFilter ? 'border-[#2D6A2F] text-[#2D6A2F] bg-green-50' : 'text-muted-foreground'}`}>
          <SlidersHorizontal size={14} />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(['Vivo','Vendido','Morto','todos'] as StatusFilter[]).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${status === s ? 'text-white border-transparent' : 'text-muted-foreground'}`}
            style={status === s ? { background: '#2D6A2F' } : {}}>
            {s === 'todos' ? 'Todos' : s}
          </button>
        ))}
      </div>

      {/* Filtro categoria */}
      {showFilter && (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCatFilt('todas')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${catFilt === 'todas' ? 'bg-muted' : ''}`}>Todas</button>
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setCatFilt(c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${catFilt === c ? 'bg-muted' : ''}`}>{c}</button>
          ))}
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <span className="text-5xl">🐄</span>
          <p className="font-bold">{animais.length === 0 ? 'Nenhum animal cadastrado' : 'Nenhum resultado'}</p>
          <p className="text-sm text-muted-foreground">
            {animais.length === 0 ? 'Toque em "+ Animal" para cadastrar.' : 'Tente outros filtros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} resultado(s)</p>
          {filtered.map(a => (
            <AnimalCard key={a.id} animal={a}
              onEdit={openEdit} onDelete={handleDelete} onDetail={setDetailId} />
          ))}
        </div>
      )}

      {/* Modais */}
      <AnimalForm open={formOpen} animalId={editId}
        onClose={() => { setFormOpen(false); setEditId(null); }} />

      <AnimalDetail animal={detailAnimal} eventos={db.eventos ?? []} lancamentos={db.lancamentos ?? []}
        onClose={() => setDetailId(null)}
        onEdit={id => { setDetailId(null); openEdit(id); }}
        onNewEvento={openEvento} />

      <EventoForm open={eventoOpen} brincoFixed={eventoBrinco}
        onClose={() => { setEventoOpen(false); setEventoBrinco(undefined); }} />

      {/* GTA Sheet */}
      <Sheet open={gtaOpen} onOpenChange={v => !v && setGtaOpen(false)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-3">
            <SheetTitle>📋 GTA Digital</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-8">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <strong>Documento informativo.</strong> Não substitui a GTA oficial emitida pelo órgão estadual de defesa agropecuária.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Destino *</label>
                <Input placeholder="Nome da fazenda/frigorífico" value={gtaDestino} onChange={e => setGtaDestino(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Data Trânsito *</label>
                <Input type="date" value={gtaData} onChange={e => setGtaData(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Motorista</label>
                <Input placeholder="Nome" value={gtaMotorista} onChange={e => setGtaMotorista(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Placa do Veículo</label>
                <Input placeholder="ABC-1234" value={gtaPlaca} onChange={e => setGtaPlaca(e.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase">Selecionar Animais *</label>
                <button
                  className="text-xs font-bold underline"
                  style={{ color: '#2D6A2F' }}
                  onClick={() => {
                    const vivos = animais.filter(a => a.status === 'Vivo');
                    setGtaSel(gtaSel.length === vivos.length ? [] : vivos.map(a => a.id));
                  }}
                >
                  {gtaSel.length === animais.filter(a => a.status === 'Vivo').length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
              <div className="rounded-xl border bg-card divide-y max-h-48 overflow-y-auto">
                {animais.filter(a => a.status === 'Vivo').map(a => (
                  <label key={a.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={gtaSel.includes(a.id)}
                      onChange={e => {
                        if (e.target.checked) setGtaSel(s => [...s, a.id]);
                        else setGtaSel(s => s.filter(x => x !== a.id));
                      }}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{a.brinco || a.nomeGrupo}</p>
                      <p className="text-[11px] text-muted-foreground">{a.categoria}{a.pesoAtual ? ` · ${a.pesoAtual}kg` : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{gtaSel.length} animal(is) selecionado(s)</p>
            </div>

            <Button
              className="w-full font-bold h-11"
              style={{ background: '#b45309' }}
              onClick={() => {
                if (!gtaDestino.trim()) { toast.error('Informe o destino.'); return; }
                if (gtaSel.length === 0) { toast.error('Selecione ao menos 1 animal.'); return; }
                imprimirGTA({ animalIds: gtaSel, origem: db.meta?.fazNome || '', destino: gtaDestino, data: gtaData, motorista: gtaMotorista || undefined, placa: gtaPlaca || undefined });
                setGtaOpen(false);
              }}
            >
              📋 Gerar e Imprimir GTA
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
