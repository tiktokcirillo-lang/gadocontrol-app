'use client';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Printer, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { CAT_ICON } from '@/lib/types';
import { fmtDate, fmtMoney, getCabecas, idadeMeses } from '@/lib/db';
import { imprimirAnimal } from '@/lib/exportar';
import type { Animal, Evento } from '@/lib/types';

// ─── Ícones por tipo de evento ────────────────────────────────────────────────
const EV_ICON: Record<string, string> = {
  'Nascimento':                   '🐣',
  'Desmame':                      '🍼',
  'Pesagem':                      '⚖️',
  'Venda':                        '💰',
  'Morte':                        '💀',
  'Tratamento':                   '💊',
  'Vacina Clostridioses':         '💉',
  'Vacina Febre Aftosa':          '💉',
  'Vacina Brucelose':             '💉',
  'Vacina Raiva':                 '💉',
  'Vacina – Outro':               '💉',
  'Vermífugo':                    '🐛',
  'Inseminação Artificial':       '🔬',
  'Cobertura Natural':            '🐂',
  'IATF — D0 (Início Protocolo)': '🔬',
  'IATF — D8 (Prostaglandina)':   '💉',
  'IATF — D17 (Retirada + EB)':  '💉',
  'IATF — Inseminação':           '🔬',
  'Diagnóstico de Gestação':      '🔍',
  'ECC — Avaliação':              '📊',
  'Banho Carrapaticida':          '🛁',
  'Suplementação Mineral':        '🌿',
  'Custo / Despesa':              '💸',
};

function evIcon(tipo: string) { return EV_ICON[tipo] ?? '📋'; }

function evColorClass(tipo: string): string {
  if (tipo === 'Nascimento')               return 'border-l-green-500 bg-green-50 dark:bg-green-950/30';
  if (tipo === 'Desmame')                  return 'border-l-green-400 bg-green-50 dark:bg-green-950/20';
  if (tipo === 'Pesagem')                  return 'border-l-blue-400 bg-blue-50 dark:bg-blue-950/20';
  if (tipo === 'Venda')                    return 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20';
  if (tipo === 'Morte')                    return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
  if (tipo === 'Tratamento')               return 'border-l-red-400 bg-red-50 dark:bg-red-950/20';
  if (tipo === 'Diagnóstico de Gestação')  return 'border-l-purple-400 bg-purple-50 dark:bg-purple-950/20';
  if (tipo === 'ECC — Avaliação')          return 'border-l-blue-400 bg-blue-50 dark:bg-blue-950/20';
  if (tipo === 'Banho Carrapaticida')      return 'border-l-teal-400 bg-teal-50 dark:bg-teal-950/20';
  if (tipo === 'Suplementação Mineral')    return 'border-l-lime-400 bg-lime-50 dark:bg-lime-950/20';
  if (tipo === 'Custo / Despesa')          return 'border-l-amber-400 bg-amber-50 dark:bg-amber-950/20';
  if (tipo === 'Vermífugo')                return 'border-l-indigo-400 bg-indigo-50 dark:bg-indigo-950/20';
  if (tipo.startsWith('Vacina') || tipo.startsWith('IATF'))
                                           return 'border-l-violet-400 bg-violet-50 dark:bg-violet-950/20';
  if (tipo.includes('Inseminação') || tipo.includes('Cobertura'))
                                           return 'border-l-pink-400 bg-pink-50 dark:bg-pink-950/20';
  return 'border-l-muted bg-muted/20';
}

function evDetalhes(ev: Evento): string[] {
  const p: string[] = [];
  if (ev.peso)        p.push(`${ev.peso} kg`);
  if (ev.preco)       p.push(fmtMoney(ev.preco));
  if (ev.ecc)         p.push(`ECC: ${ev.ecc}`);
  if (ev.diagResult)  p.push(ev.diagResult);
  if (ev.diagDias)    p.push(`${ev.diagDias}d gestação`);
  if (ev.touroDoador) p.push(`Touro: ${ev.touroDoador}`);
  if (ev.carrapProd)  p.push(ev.carrapProd);
  if (ev.suplProd)    p.push(ev.suplProd);
  if (ev.custoCat)    p.push(ev.custoCat);
  if (ev.detalhes)    p.push(ev.detalhes);
  return p;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  animal:      Animal | null;
  eventos:     Evento[];
  onClose:     () => void;
  onEdit:      (id: string) => void;
  onNewEvento: (brinco: string) => void;
}

export function AnimalDetail({ animal, eventos, onClose, onEdit, onNewEvento }: Props) {
  const [showAllEvs, setShowAllEvs] = useState(false);

  if (!animal) return null;

  const cab   = getCabecas(animal);
  const meses = idadeMeses(animal.dataNascimento);

  // Busca eventos por brinco OU nomeGrupo (corrige grupos)
  const ident = (animal.brinco || animal.nomeGrupo || '').toUpperCase();
  const evs = eventos
    .filter(e => (e.brincoAnimal ?? '').toUpperCase() === ident)
    .sort((a, b) => b.data.localeCompare(a.data));

  const evsShown = showAllEvs ? evs : evs.slice(0, 8);

  // Lucratividade individual
  const precoCompra  = animal.precoCompra ?? 0;
  const precoVenda   = animal.precoVenda  ?? 0;
  const custoEventos = evs
    .filter(e => (e.preco ?? 0) > 0 && e.tipo !== 'Venda')
    .reduce((s, e) => s + (e.preco ?? 0), 0);
  const temLucro    = (precoCompra > 0 || custoEventos > 0) && precoVenda > 0;
  const lucroTotal  = precoVenda - precoCompra - custoEventos;

  return (
    <Sheet open={!!animal} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">{CAT_ICON[animal.categoria] ?? '🐄'}</span>
            <div>
              <div className="font-black">{animal.brinco || animal.nomeGrupo}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {animal.categoria}{animal.raca ? ` · ${animal.raca}` : ''} · {animal.status}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pb-8">

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-2">
            <MiniCard label="Peso"    value={animal.pesoAtual ? `${animal.pesoAtual}kg` : animal.pesoMedio ? `${animal.pesoMedio}kg` : '—'} />
            <MiniCard label="Idade"   value={meses !== null ? `${meses}m` : '—'} />
            <MiniCard label="Cab."    value={cab > 1 ? String(cab) : '—'} />
            <MiniCard label="Eventos" value={String(evs.length)} />
          </div>

          {/* Dados do animal */}
          <Section title="Dados do Animal">
            <Row label="Sexo"           value={animal.sexo} />
            <Row label="Nascimento"     value={fmtDate(animal.dataNascimento)} />
            <Row label="Mãe"            value={animal.mae} />
            <Row label="Pai / Touro"    value={animal.pai} />
            {animal.statusReprodutivo && <Row label="Status Reprod."  value={animal.statusReprodutivo} />}
            {animal.dataPrevistoParto  && <Row label="Parto Previsto"  value={fmtDate(animal.dataPrevistoParto)} />}
            {animal.dataUltimoParto    && <Row label="Último Parto"    value={fmtDate(animal.dataUltimoParto)} />}
            {animal.numeroParto != null && <Row label="Nº de Partos"   value={String(animal.numeroParto)} />}
            {animal.dataDesmame        && <Row label="Data Desmame"    value={fmtDate(animal.dataDesmame)} />}
            {animal.eccAtual           && <Row label="ECC Atual"       value={String(animal.eccAtual)} />}
            {animal.ultimoBanho        && <Row label="Último Banho"    value={fmtDate(animal.ultimoBanho)} />}
            {animal.sisbov             && <Row label="SISBOV"          value={animal.sisbov} />}
            {animal.gta                && <Row label="GTA"             value={animal.gta} />}
            {animal.observacao         && <Row label="Obs."            value={animal.observacao} />}
          </Section>

          {/* Compra */}
          {animal.comprado && (
            <Section title="Compra">
              {animal.dataCompra    && <Row label="Data Compra"  value={fmtDate(animal.dataCompra)} />}
              {animal.precoCompra   && <Row label="Valor Compra" value={fmtMoney(animal.precoCompra)} />}
              {animal.origemCompra  && <Row label="Origem"       value={animal.origemCompra} />}
            </Section>
          )}

          {/* Venda */}
          {animal.status === 'Vendido' && (animal.dataVenda || animal.precoVenda) && (
            <Section title="Venda">
              {animal.dataVenda  && <Row label="Data Venda"  value={fmtDate(animal.dataVenda)} />}
              {animal.precoVenda && <Row label="Preço Venda" value={fmtMoney(animal.precoVenda)} />}
            </Section>
          )}

          {/* Lucratividade */}
          {temLucro && (
            <div className={`rounded-xl border p-4 space-y-2 ${
              lucroTotal >= 0 ? 'border-green-200 bg-green-50 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:bg-red-950/30'
            }`}>
              <div className="flex items-center gap-2">
                {lucroTotal >= 0
                  ? <TrendingUp  className="h-4 w-4 text-green-700" />
                  : <TrendingDown className="h-4 w-4 text-red-700" />}
                <p className={`text-[11px] font-black uppercase tracking-widest ${lucroTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  Resultado financeiro
                </p>
              </div>
              <div className="space-y-1 text-xs">
                {precoCompra > 0 && (
                  <div className="flex justify-between text-red-700">
                    <span>(-) Compra</span><span>{fmtMoney(precoCompra)}</span>
                  </div>
                )}
                {custoEventos > 0 && (
                  <div className="flex justify-between text-red-700">
                    <span>(-) Custos registrados</span><span>{fmtMoney(custoEventos)}</span>
                  </div>
                )}
                <div className="flex justify-between text-green-700">
                  <span>(+) Venda</span><span>{fmtMoney(precoVenda)}</span>
                </div>
                <div className={`flex justify-between font-black text-sm pt-1.5 border-t ${
                  lucroTotal >= 0 ? 'border-green-300 text-green-800' : 'border-red-300 text-red-800'
                }`}>
                  <span>{lucroTotal >= 0 ? 'Lucro estimado' : 'Prejuízo estimado'}</span>
                  <span>{fmtMoney(Math.abs(lucroTotal))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline de eventos */}
          {evs.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Histórico — {evs.length} evento{evs.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {evsShown.map(ev => (
                  <div key={ev.id} className="flex gap-2.5">
                    <div className="w-[4.5rem] shrink-0 pt-2.5">
                      <p className="text-[10px] text-muted-foreground leading-tight">{fmtDate(ev.data)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`rounded-lg border-l-4 px-3 py-2 ${evColorClass(ev.tipo)}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm leading-none">{evIcon(ev.tipo)}</span>
                          <span className="text-xs font-bold">{ev.tipo}</span>
                        </div>
                        {evDetalhes(ev).length > 0 && (
                          <p className="text-[10px] mt-0.5 text-muted-foreground">
                            {evDetalhes(ev).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {evs.length > 8 && (
                <button
                  onClick={() => setShowAllEvs(v => !v)}
                  className="flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAllEvs
                    ? <><ChevronDown className="h-3 w-3" /> Mostrar menos</>
                    : <><ChevronRight className="h-3 w-3" /> Ver todos os {evs.length} eventos</>}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/20 p-4 text-center">
              <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Registre pesagens, vacinas, partos e mais.</p>
            </div>
          )}

          {/* Foto */}
          {animal.foto && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Foto</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={animal.foto} alt={animal.brinco || animal.nomeGrupo || 'animal'}
                className="w-full max-w-[200px] rounded-xl border object-cover aspect-square" />
            </div>
          )}

          {/* Ações */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onNewEvento(animal.brinco || animal.nomeGrupo || '')}
              className="py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: '#2D6A2F' }}>
              + Registrar Evento
            </button>
            <button
              onClick={() => { onClose(); onEdit(animal.id); }}
              className="py-2.5 rounded-xl border-2 font-bold text-sm hover:bg-muted"
              style={{ borderColor: '#2D6A2F', color: '#2D6A2F' }}>
              Editar Animal
            </button>
          </div>

          <button
            onClick={() => imprimirAnimal(animal.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-sm text-muted-foreground hover:bg-muted">
            <Printer className="w-4 h-4" />
            Imprimir Ficha do Animal
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted">
      <div className="font-black text-sm">{value}</div>
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
