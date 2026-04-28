'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CAT_ICON } from '@/lib/types';
import { fmtDate, fmtMoney, getCabecas, idadeMeses } from '@/lib/db';
import type { Animal, Evento } from '@/lib/types';

interface Props {
  animal:      Animal | null;
  eventos:     Evento[];
  onClose:     () => void;
  onEdit:      (id: string) => void;
  onNewEvento: (brinco: string) => void;
}

export function AnimalDetail({ animal, eventos, onClose, onEdit, onNewEvento }: Props) {
  if (!animal) return null;
  const cab   = getCabecas(animal);
  const meses = idadeMeses(animal.dataNascimento);
  const evs   = eventos.filter(e => e.brincoAnimal === animal.brinco).sort((a,b) => b.data.localeCompare(a.data));

  return (
    <Sheet open={!!animal} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">{CAT_ICON[animal.categoria] ?? '🐄'}</span>
            <div>
              <div className="font-black">{animal.brinco || animal.nomeGrupo}</div>
              <div className="text-xs font-normal text-muted-foreground">{animal.categoria} · {animal.status}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pb-8">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            <MiniCard label="Peso" value={animal.pesoAtual ? `${animal.pesoAtual}kg` : animal.pesoMedio ? `${animal.pesoMedio}kg` : '—'} />
            <MiniCard label="Idade" value={meses !== null ? `${meses}m` : '—'} />
            <MiniCard label="Cabeças" value={cab > 1 ? String(cab) : '—'} />
          </div>

          {/* Dados */}
          <Section title="Dados do Animal">
            <Row label="Raça"            value={animal.raca} />
            <Row label="Sexo"            value={animal.sexo} />
            <Row label="Nascimento"      value={fmtDate(animal.dataNascimento)} />
            <Row label="Mãe"             value={animal.mae} />
            <Row label="Pai / Touro"     value={animal.pai} />
            {animal.statusReprodutivo && <Row label="Status Reprod." value={animal.statusReprodutivo} />}
            {animal.dataPrevistoParto && <Row label="Parto Previsto" value={fmtDate(animal.dataPrevistoParto)} />}
            {animal.precoVenda && <Row label="Preço Venda" value={fmtMoney(animal.precoVenda)} />}
            {animal.dataVenda  && <Row label="Data Venda"  value={fmtDate(animal.dataVenda)} />}
            {animal.observacao && <Row label="Obs." value={animal.observacao} />}
          </Section>

          {/* Histórico de eventos */}
          {evs.length > 0 && (
            <Section title={`Histórico (${evs.length})`}>
              <div className="space-y-2">
                {evs.slice(0, 10).map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground text-xs mt-0.5 w-20 shrink-0">{fmtDate(ev.data)}</span>
                    <div>
                      <span className="font-medium">{ev.tipo}</span>
                      {ev.peso  && <span className="text-muted-foreground"> · {ev.peso}kg</span>}
                      {ev.preco && <span className="text-muted-foreground"> · {fmtMoney(ev.preco)}</span>}
                      {ev.detalhes && <p className="text-xs text-muted-foreground">{ev.detalhes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onNewEvento(animal.brinco || animal.nomeGrupo || '')}
              className="py-2.5 rounded-xl font-bold text-sm text-white transition-colors"
              style={{ background: '#2D6A2F' }}
            >
              + Registrar Evento
            </button>
            <button
              onClick={() => { onClose(); onEdit(animal.id); }}
              className="py-2.5 rounded-xl border-2 font-bold text-sm transition-colors hover:bg-muted"
              style={{ borderColor: '#2D6A2F', color: '#2D6A2F' }}
            >
              Editar Animal
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted">
      <div className="font-black text-base">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <div className="rounded-xl border divide-y bg-card">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
