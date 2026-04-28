'use client';
import { useState, useMemo } from 'react';
import { Plus, ShieldCheck, Activity, FlaskConical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/hooks/useDB';
import { diffDays, fmtDate, today, uid } from '@/lib/db';
import { EventoForm } from '@/components/animals/EventoForm';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CAT_ICON } from '@/lib/types';
import type { Animal, EventoTipo, AnimalCategoria, ProtocoloSanitario } from '@/lib/types';

// Intervalos de alerta (dias)
const BANHO_DIAS  = 30;
const VERMI_DIAS  = 90;
const TRAT_JANELA = 30;

const TIPOS_SAUDE: EventoTipo[] = [
  'Vacina Clostridioses', 'Vacina Febre Aftosa', 'Vacina Brucelose',
  'Vacina Raiva', 'Vacina – Outro', 'Vermífugo',
  'Tratamento', 'Banho Carrapaticida',
];

function getBrinco(a: Animal) {
  return a.brinco || a.nomeGrupo || '—';
}

type SaudeTab = 'alertas' | 'protocolos';

export default function SaudePage() {
  const { db } = useDB();
  const [saudeTab, setSaudeTab] = useState<SaudeTab>('alertas');

  const [eventoOpen,  setEventoOpen]  = useState(false);
  const [brincoFixed, setBrincoFixed] = useState<string | undefined>();
  const [tipoFixed,   setTipoFixed]   = useState<EventoTipo | undefined>();

  const [expandBanho, setExpandBanho] = useState(false);
  const [expandVermi, setExpandVermi] = useState(false);
  const [expandTrat,  setExpandTrat]  = useState(false);

  const hoje = today();

  const animaisVivos = useMemo(
    () => (db.animais ?? []).filter(a => a.status === 'Vivo'),
    [db],
  );

  // Mapa: brinco → tipo → última data
  const lastEvMap = useMemo(() => {
    const m: Record<string, Record<string, string>> = {};
    (db.eventos ?? []).forEach(e => {
      if (!m[e.brincoAnimal]) m[e.brincoAnimal] = {};
      const prev = m[e.brincoAnimal][e.tipo];
      if (!prev || e.data > prev) m[e.brincoAnimal][e.tipo] = e.data;
    });
    return m;
  }, [db]);

  function lastDe(a: Animal, tipo: string) {
    return lastEvMap[getBrinco(a)]?.[tipo];
  }

  // Alertas de banho (> 30 dias ou nunca)
  const alertasBanho = useMemo(() => animaisVivos.filter(a => {
    const ultimo = lastDe(a, 'Banho Carrapaticida') ?? a.ultimoBanho;
    if (!ultimo) return true;
    return diffDays(ultimo, hoje) > BANHO_DIAS;
  }), [animaisVivos, lastEvMap, hoje]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Alertas de vermífugo (> 90 dias ou nunca)
  const alertasVermi = useMemo(() => animaisVivos.filter(a => {
    const ultimo = lastDe(a, 'Vermífugo');
    if (!ultimo) return true;
    return diffDays(ultimo, hoje) > VERMI_DIAS;
  }), [animaisVivos, lastEvMap, hoje]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Em tratamento (últimos 30 dias)
  const emTratamento = useMemo(() => animaisVivos.filter(a => {
    const ultimo = lastDe(a, 'Tratamento');
    if (!ultimo) return false;
    return diffDays(ultimo, hoje) <= TRAT_JANELA;
  }), [animaisVivos, lastEvMap, hoje]);   // eslint-disable-line react-hooks/exhaustive-deps

  const totalAlertas = alertasBanho.length + alertasVermi.length;

  // Histórico de saúde (últimos 15)
  const historico = useMemo(() =>
    (db.eventos ?? [])
      .filter(e => (TIPOS_SAUDE as string[]).includes(e.tipo))
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 15),
    [db],
  );

  function abrirEvento(brinco?: string, tipo?: EventoTipo) {
    setBrincoFixed(brinco);
    setTipoFixed(tipo);
    setEventoOpen(true);
  }

  function fecharEvento() {
    setEventoOpen(false);
    setBrincoFixed(undefined);
    setTipoFixed(undefined);
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">Saúde</h1>
        <button
          onClick={() => abrirEvento()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ background: '#2D6A2F' }}>
          <Plus className="h-3.5 w-3.5" /> Evento de Saúde
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border p-1 gap-1">
        {([
          { key: 'alertas',    label: '🚨 Alertas'    },
          { key: 'protocolos', label: '🔬 Protocolos' },
        ] as { key: SaudeTab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setSaudeTab(t.key)}
            className={`flex-1 rounded-md py-2 text-xs font-bold transition-colors ${saudeTab === t.key ? 'text-white' : 'text-muted-foreground'}`}
            style={saudeTab === t.key ? { background: '#2D6A2F' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {saudeTab === 'protocolos' && <TabProtocolos db={db} onAbrirEvento={abrirEvento} />}
      {saudeTab === 'alertas' && <>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard emoji="🐄" label="Animais Vivos"     value={String(animaisVivos.length)} green />
        <KpiCard emoji="🚨" label="Alertas Pendentes" value={String(totalAlertas)}
          green={totalAlertas === 0} red={totalAlertas > 0} />
        <KpiCard emoji="💊" label="Em Tratamento"     value={String(emTratamento.length)}
          green={emTratamento.length === 0} amber={emTratamento.length > 0} />
        <KpiCard emoji="🛁" label={`Banho OK (${BANHO_DIAS}d)`}
          value={`${animaisVivos.length - alertasBanho.length} / ${animaisVivos.length}`} green />
      </div>

      {/* Tudo em dia */}
      {totalAlertas === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-bold text-green-800 text-sm">Tudo em dia!</p>
            <p className="text-xs text-green-700">Nenhum alerta de saúde pendente no momento.</p>
          </div>
        </div>
      )}

      {/* Alerta: Banho Carrapaticida */}
      {alertasBanho.length > 0 && (
        <AlertaCard
          emoji="🪣"
          titulo={`Banho Carrapaticida — ${alertasBanho.length} animal${alertasBanho.length !== 1 ? 'is' : ''}`}
          subtitulo={`Sem banho há mais de ${BANHO_DIAS} dias`}
          cor="amber"
          animais={alertasBanho}
          expandido={expandBanho}
          onToggle={() => setExpandBanho(v => !v)}
          onRegistrar={a => abrirEvento(getBrinco(a), 'Banho Carrapaticida')}
          getUltimo={a => lastDe(a, 'Banho Carrapaticida') ?? a.ultimoBanho}
        />
      )}

      {/* Alerta: Vermífugo */}
      {alertasVermi.length > 0 && (
        <AlertaCard
          emoji="💉"
          titulo={`Vermífugo — ${alertasVermi.length} animal${alertasVermi.length !== 1 ? 'is' : ''}`}
          subtitulo={`Sem vermífugo há mais de ${VERMI_DIAS} dias`}
          cor="red"
          animais={alertasVermi}
          expandido={expandVermi}
          onToggle={() => setExpandVermi(v => !v)}
          onRegistrar={a => abrirEvento(getBrinco(a), 'Vermífugo')}
          getUltimo={a => lastDe(a, 'Vermífugo')}
        />
      )}

      {/* Em Tratamento */}
      {emTratamento.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <button
            onClick={() => setExpandTrat(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 border-b border-blue-100 text-left">
            <Activity className="h-4 w-4 text-blue-600 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-sm text-blue-800">
                Em Tratamento — {emTratamento.length} animal{emTratamento.length !== 1 ? 'is' : ''}
              </p>
              <p className="text-xs text-blue-700">Tratamento registrado nos últimos {TRAT_JANELA} dias</p>
            </div>
            <span className="text-xs font-bold text-blue-700">{expandTrat ? '▲' : '▼'}</span>
          </button>
          {expandTrat && (
            <div className="divide-y">
              {emTratamento.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg">{CAT_ICON[a.categoria] ?? '🐄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{getBrinco(a)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.categoria} · Tratamento em {fmtDate(lastDe(a, 'Tratamento'))}
                    </p>
                  </div>
                  <button
                    onClick={() => abrirEvento(getBrinco(a), 'Tratamento')}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg border text-blue-700 border-blue-300 hover:bg-blue-50">
                    Atualizar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      <div className="space-y-2">
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">
          Histórico de Saúde
        </p>
        {historico.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum evento de saúde registrado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use o botão acima para registrar vacinas, vermífugo, tratamentos e banhos.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card divide-y overflow-hidden">
            {historico.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 px-3 py-2.5">
                <span className="text-base shrink-0">
                  {ev.tipo.startsWith('Vacina') ? '💉' :
                   ev.tipo === 'Vermífugo'       ? '🔵' :
                   ev.tipo === 'Tratamento'       ? '💊' : '🛁'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{ev.brincoAnimal}</p>
                  <p className="text-xs text-muted-foreground">{ev.tipo}</p>
                  {ev.detalhes && (
                    <p className="text-[11px] text-muted-foreground italic truncate">{ev.detalhes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-muted-foreground">{fmtDate(ev.data)}</p>
                  {ev.preco && (
                    <p className="text-xs font-semibold text-red-600">
                      R$ {ev.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </>}

      <EventoForm
        open={eventoOpen}
        brincoFixed={brincoFixed}
        tipoFixed={tipoFixed}
        onClose={fecharEvento}
      />
    </div>
  );
}

// ─── Aba Protocolos ──────────────────────────────────────────────────────────

const TIPOS_SAUDE_VACINA: EventoTipo[] = [
  'Vacina Febre Aftosa','Vacina Clostridioses','Vacina Brucelose','Vacina Raiva','Vacina – Outro',
  'Vermífugo','Banho Carrapaticida','Tratamento',
];

const CATS_ALL: AnimalCategoria[] = ['Bezerro','Bezerra','Desmamado','Novilho','Novilha','Matriz','Touro','Boi'];

const PROTOCOLOS_PADRAO: Omit<ProtocoloSanitario, 'id' | 'createdAt'>[] = [
  { nome: 'Vacina Febre Aftosa',    tipo: 'Vacina Febre Aftosa',    intervaloDias: 180, categorias: CATS_ALL, ativo: true },
  { nome: 'Vacina Clostridioses',   tipo: 'Vacina Clostridioses',   intervaloDias: 365, categorias: CATS_ALL, ativo: true },
  { nome: 'Vermífugo',              tipo: 'Vermífugo',              intervaloDias: 90,  categorias: CATS_ALL, ativo: true },
  { nome: 'Banho Carrapaticida',    tipo: 'Banho Carrapaticida',    intervaloDias: 30,  categorias: CATS_ALL, ativo: true },
];

function TabProtocolos({
  db, onAbrirEvento,
}: {
  db: ReturnType<typeof useDB>['db'];
  onAbrirEvento: (brinco?: string, tipo?: EventoTipo) => void;
}) {
  const { update } = useDB();
  const hoje       = today();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [nome,      setNome]      = useState('');
  const [tipo,      setTipo]      = useState<EventoTipo>('Vacina Febre Aftosa');
  const [intervalo, setIntervalo] = useState('180');
  const [cats,      setCats]      = useState<AnimalCategoria[]>(CATS_ALL);
  const [expandId,  setExpandId]  = useState<string | null>(null);

  const protocolos = db.protocolos ?? [];

  // Mapa: brinco → tipo → última data (igual à aba de Alertas)
  const lastEvMap = useMemo(() => {
    const m: Record<string, Record<string, string>> = {};
    (db.eventos ?? []).forEach(e => {
      if (!m[e.brincoAnimal]) m[e.brincoAnimal] = {};
      const prev = m[e.brincoAnimal][e.tipo];
      if (!prev || e.data > prev) m[e.brincoAnimal][e.tipo] = e.data;
    });
    return m;
  }, [db]);

  const animaisVivos = useMemo(
    () => (db.animais ?? []).filter(a => a.status === 'Vivo'),
    [db],
  );

  // Animais vencidos por protocolo
  function animaisVencidos(p: ProtocoloSanitario) {
    return animaisVivos.filter(a => {
      if (!p.categorias.includes(a.categoria)) return false;
      const b      = a.brinco || a.nomeGrupo || '';
      const ultimo = lastEvMap[b]?.[p.tipo];
      if (!ultimo) return true;
      return diffDays(ultimo, hoje) > p.intervaloDias;
    });
  }

  function abrirForm(p?: ProtocoloSanitario) {
    if (p) {
      setEditId(p.id); setNome(p.nome); setTipo(p.tipo);
      setIntervalo(String(p.intervaloDias)); setCats(p.categorias);
    } else {
      setEditId(null); setNome(''); setTipo('Vacina Febre Aftosa');
      setIntervalo('180'); setCats(CATS_ALL);
    }
    setSheetOpen(true);
  }

  function salvar() {
    if (!nome.trim())   { toast.error('Informe o nome.'); return; }
    if (!intervalo || Number(intervalo) <= 0) { toast.error('Intervalo inválido.'); return; }
    update(d => {
      if (!d.protocolos) d.protocolos = [];
      const item: ProtocoloSanitario = {
        id:           editId ?? uid(),
        nome:         nome.trim(),
        tipo,
        intervaloDias: Number(intervalo),
        categorias:   cats,
        ativo:        true,
        createdAt:    editId ? (d.protocolos.find(p => p.id === editId)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
      };
      if (editId) {
        const idx = d.protocolos.findIndex(p => p.id === editId);
        if (idx !== -1) d.protocolos[idx] = item;
        toast.success('Protocolo atualizado!');
      } else {
        d.protocolos.push(item);
        toast.success('Protocolo criado!');
      }
    });
    setSheetOpen(false);
  }

  function deletar(id: string) {
    if (!confirm('Remover este protocolo?')) return;
    update(d => { d.protocolos = (d.protocolos ?? []).filter(p => p.id !== id); });
    toast.success('Protocolo removido.');
  }

  function toggleCat(c: AnimalCategoria) {
    setCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function criarPadroes() {
    update(d => {
      if (!d.protocolos) d.protocolos = [];
      PROTOCOLOS_PADRAO.forEach(pp => {
        const exists = d.protocolos.some(p => p.tipo === pp.tipo);
        if (!exists) d.protocolos.push({ ...pp, id: uid(), createdAt: new Date().toISOString() });
      });
    });
    toast.success('Protocolos padrão adicionados!');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{protocolos.length} protocolo{protocolos.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          {protocolos.length === 0 && (
            <button onClick={criarPadroes}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border"
              style={{ borderColor: '#2D6A2F', color: '#2D6A2F' }}>
              + Padrões EMBRAPA
            </button>
          )}
          <button onClick={() => abrirForm()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: '#2D6A2F' }}>
            <Plus className="h-3.5 w-3.5" /> Novo
          </button>
        </div>
      </div>

      {protocolos.length === 0 && (
        <div className="rounded-xl border bg-card p-6 text-center space-y-2">
          <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-bold">Nenhum protocolo cadastrado</p>
          <p className="text-xs text-muted-foreground">
            Use "+ Padrões EMBRAPA" para criar automaticamente os protocolos de vacinas, vermífugo e banho.
          </p>
        </div>
      )}

      {protocolos.map(p => {
        const vencidos   = animaisVencidos(p);
        const emDia      = animaisVivos.filter(a => p.categorias.includes(a.categoria)).length - vencidos.length;
        const expandido  = expandId === p.id;
        return (
          <div key={p.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => setExpandId(expandido ? null : p.id)}
                className="flex-1 flex items-center gap-3 text-left min-w-0">
                <div className={`w-2 h-8 rounded-full shrink-0 ${vencidos.length > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{p.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    A cada {p.intervaloDias}d · {vencidos.length > 0
                      ? <span className="text-red-600 font-bold">{vencidos.length} vencido{vencidos.length !== 1 ? 's' : ''}</span>
                      : <span className="text-green-600 font-bold">todos em dia ({emDia})</span>}
                  </p>
                </div>
              </button>
              <button onClick={() => abrirForm(p)}
                className="text-[11px] font-bold px-2 py-1 rounded-lg border text-muted-foreground hover:bg-muted">
                Editar
              </button>
              <button onClick={() => deletar(p.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {expandido && vencidos.length > 0 && (
              <div className="border-t divide-y bg-red-50/30">
                {vencidos.slice(0, 8).map(a => {
                  const b      = a.brinco || a.nomeGrupo || '';
                  const ultimo = lastEvMap[b]?.[p.tipo];
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-base">{CAT_ICON[a.categoria] ?? '🐄'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{b}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {ultimo ? `Último: ${fmtDate(ultimo)} (${diffDays(ultimo, hoje)}d atrás)` : 'Nunca registrado'}
                        </p>
                      </div>
                      <button onClick={() => onAbrirEvento(b, p.tipo)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg border text-red-700 border-red-300 hover:bg-red-100">
                        Registrar
                      </button>
                    </div>
                  );
                })}
                {vencidos.length > 8 && (
                  <p className="text-xs text-muted-foreground px-4 py-2">+{vencidos.length - 8} mais animais</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Sheet formulário */}
      <Sheet open={sheetOpen} onOpenChange={v => !v && setSheetOpen(false)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>{editId ? 'Editar Protocolo' : 'Novo Protocolo Sanitário'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-8">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome do Protocolo</Label>
              <Input placeholder="Ex: Vacina Aftosa semestral" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Evento</Label>
                <select value={tipo} onChange={e => setTipo(e.target.value as EventoTipo)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  {TIPOS_SAUDE_VACINA.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Intervalo (dias)</Label>
                <Input type="number" min="1" placeholder="Ex: 180"
                  value={intervalo} onChange={e => setIntervalo(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categorias de Animais</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATS_ALL.map(c => (
                  <button key={c} onClick={() => toggleCat(c)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                      cats.includes(c) ? 'text-white border-transparent' : 'text-muted-foreground'
                    }`}
                    style={cats.includes(c) ? { background: '#2D6A2F' } : {}}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full font-bold h-11" style={{ background: '#2D6A2F' }} onClick={salvar}>
              {editId ? 'Salvar Alterações' : 'Criar Protocolo'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Componentes internos ────────────────────────────────────────────────────

function KpiCard({
  emoji, label, value, green, red, amber,
}: {
  emoji: string; label: string; value: string;
  green?: boolean; red?: boolean; amber?: boolean;
}) {
  const color = red ? 'text-red-600' : amber ? 'text-amber-600' : green ? 'text-green-700' : 'text-foreground';
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className={`text-base font-black ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{emoji} {label}</div>
    </div>
  );
}

function AlertaCard({
  emoji, titulo, subtitulo, cor, animais, expandido, onToggle, onRegistrar, getUltimo,
}: {
  emoji: string;
  titulo: string;
  subtitulo: string;
  cor: 'amber' | 'red';
  animais: Animal[];
  expandido: boolean;
  onToggle: () => void;
  onRegistrar: (a: Animal) => void;
  getUltimo: (a: Animal) => string | undefined;
}) {
  const bg      = cor === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const hdr     = cor === 'amber' ? 'text-amber-800' : 'text-red-800';
  const sub     = cor === 'amber' ? 'text-amber-700' : 'text-red-700';
  const btnCls  = cor === 'amber'
    ? 'text-amber-700 border-amber-300 hover:bg-amber-100'
    : 'text-red-700 border-red-300 hover:bg-red-100';

  return (
    <div className={`rounded-xl border overflow-hidden ${bg}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="text-xl">{emoji}</span>
        <div className="flex-1">
          <p className={`font-bold text-sm ${hdr}`}>{titulo}</p>
          <p className={`text-xs ${sub}`}>{subtitulo}</p>
        </div>
        <span className={`text-xs font-bold ${sub}`}>{expandido ? '▲' : '▼'}</span>
      </button>

      {expandido && (
        <div className="bg-white border-t divide-y">
          {animais.map(a => {
            const ultimo = getUltimo(a);
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-base">{CAT_ICON[a.categoria] ?? '🐄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{getBrinco(a)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ultimo ? `Último: ${fmtDate(ultimo)}` : 'Nunca registrado'}
                  </p>
                </div>
                <button
                  onClick={() => onRegistrar(a)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${btnCls}`}>
                  Registrar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
