'use client';
import { useState, useRef } from 'react';
import { Save, Download, Upload, FileText, FileJson, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/hooks/useDB';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { exportarJSON, importarJSON, exportarCSVFinanceiro, abrirRelatorioPDF } from '@/lib/exportar';
import { fmtDate, saveDB } from '@/lib/db';
import { gerarDemoDB } from '@/lib/demoData';
import { TeamManager } from '@/components/config/TeamManager';

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function ConfigPage() {
  const { db, update } = useDB();
  const meta = db.meta ?? {};

  const [faz, setFaz] = useState({
    fazNome:         meta.fazNome         ?? '',
    fazProprietario: meta.fazProprietario ?? '',
    fazMunicipio:    meta.fazMunicipio    ?? '',
    fazEstado:       meta.fazEstado       ?? '',
    fazCAR:          meta.fazCAR          ?? '',
    fazAreaHa:       meta.fazAreaHa != null ? String(meta.fazAreaHa) : '',
    fazIE:           meta.fazIE           ?? '',
  });

  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: keyof typeof faz, v: string) {
    setFaz(f => ({ ...f, [k]: v }));
  }

  function salvarFazenda() {
    update(d => {
      d.meta.fazNome         = faz.fazNome.trim()         || undefined;
      d.meta.fazProprietario = faz.fazProprietario.trim() || undefined;
      d.meta.fazMunicipio    = faz.fazMunicipio.trim()    || undefined;
      d.meta.fazEstado       = faz.fazEstado               || undefined;
      d.meta.fazCAR          = faz.fazCAR.trim()          || undefined;
      d.meta.fazAreaHa       = faz.fazAreaHa ? Number(faz.fazAreaHa) : undefined;
      d.meta.fazIE           = faz.fazIE.trim()           || undefined;
    });
    toast.success('Dados da fazenda salvos!');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Isso vai substituir TODOS os dados atuais pelo arquivo de backup. Confirmar?')) return;
    setImporting(true);
    try {
      await importarJSON(file);
      toast.success('Backup restaurado com sucesso! Recarregando...');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const totalAnimais  = (db.animais ?? []).length;
  const totalEventos  = (db.eventos ?? []).length;
  const totalLanc     = (db.lancamentos ?? []).length;
  const lastBackup    = meta.lastBackup ? fmtDate(meta.lastBackup.slice(0, 10)) : '—';

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-xl mx-auto">
      <h1 className="text-xl font-black">Configurações</h1>

      {/* ── Dados da Fazenda ─────────────────────────────────────────────── */}
      <Section title="🏡 Dados da Fazenda">
        <div className="space-y-3 p-4">
          <Field label="Nome da Fazenda">
            <Input placeholder="Ex: Fazenda Santa Cruz" value={faz.fazNome} onChange={e => set('fazNome', e.target.value)} />
          </Field>
          <Field label="Proprietário / Razão Social">
            <Input placeholder="Nome completo" value={faz.fazProprietario} onChange={e => set('fazProprietario', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Município">
              <Input placeholder="Ex: Goiânia" value={faz.fazMunicipio} onChange={e => set('fazMunicipio', e.target.value)} />
            </Field>
            <Field label="Estado">
              <select value={faz.fazEstado} onChange={e => set('fazEstado', e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">UF</option>
                {ESTADOS_BR.map(uf => <option key={uf}>{uf}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Área Total (ha)">
              <Input type="number" min="0" step="0.1" placeholder="Ex: 500"
                value={faz.fazAreaHa} onChange={e => set('fazAreaHa', e.target.value)} />
            </Field>
            <Field label="Insc. Estadual">
              <Input placeholder="Nº IE" value={faz.fazIE} onChange={e => set('fazIE', e.target.value)} />
            </Field>
          </div>
          <Field label="CAR (Cód. Ambiental Rural)">
            <Input placeholder="Ex: GO-5208707-..." value={faz.fazCAR} onChange={e => set('fazCAR', e.target.value)} />
          </Field>
          <Button className="w-full font-bold h-10" style={{ background: '#2D6A2F' }} onClick={salvarFazenda}>
            <Save className="mr-2 h-4 w-4" /> Salvar Dados da Fazenda
          </Button>
        </div>
      </Section>

      {/* ── Resumo dos dados ──────────────────────────────────────────────── */}
      <Section title="📊 Resumo dos Dados">
        <div className="grid grid-cols-3 gap-px bg-border">
          {[
            { label: 'Animais',     value: totalAnimais  },
            { label: 'Eventos',     value: totalEventos  },
            { label: 'Lançamentos', value: totalLanc      },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card text-center py-4">
              <div className="text-lg font-black">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        {meta.lastBackup && (
          <p className="text-[11px] text-muted-foreground text-center py-2 border-t">
            Último backup: {lastBackup}
          </p>
        )}
      </Section>

      {/* ── Exportar ─────────────────────────────────────────────────────── */}
      <Section title="📤 Exportar">
        <div className="space-y-2 p-4">
          <ExportButton
            icon={<FileJson className="h-4 w-4" />}
            titulo="Backup JSON"
            desc="Salva todos os dados (animais, eventos, financeiro, estoque)"
            cor="#2D6A2F"
            onClick={() => { exportarJSON(); toast.success('Backup exportado!'); }}
          />
          <ExportButton
            icon={<FileText className="h-4 w-4" />}
            titulo="Relatório PDF"
            desc="Abre o relatório completo para imprimir ou salvar como PDF"
            cor="#2563eb"
            onClick={abrirRelatorioPDF}
          />
          <ExportButton
            icon={<Download className="h-4 w-4" />}
            titulo="Financeiro CSV"
            desc="Exporta todas as receitas e despesas em planilha"
            cor="#7c3aed"
            onClick={() => { exportarCSVFinanceiro(); toast.success('CSV exportado!'); }}
          />
        </div>
      </Section>

      {/* ── Dados de exemplo ─────────────────────────────────────────────── */}
      <Section title="🧪 Dados de Exemplo">
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Carrega um conjunto de dados fictícios para explorar todas as funcionalidades do app.
            <strong className="text-foreground"> Substitui todos os dados atuais.</strong>
          </p>
          <button
            onClick={() => {
              if (!confirm('Isso vai substituir TODOS os dados atuais pelos dados de exemplo. Confirmar?')) return;
              try {
                saveDB(gerarDemoDB());
                toast.success('Dados de exemplo carregados!');
                setTimeout(() => window.location.reload(), 800);
              } catch {
                toast.error('Erro ao carregar dados de exemplo.');
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted-foreground/30 text-sm font-bold text-muted-foreground hover:border-green-500 hover:text-green-700 transition-colors"
          >
            🧪 Carregar dados de exemplo
          </button>
        </div>
      </Section>

      {/* ── Importar (Restaurar backup) ────────────────────────────────── */}
      <Section title="📥 Restaurar Backup">
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Restaurar um backup <strong>substitui todos os dados atuais</strong>.
              Faça um backup antes se quiser preservar os dados existentes.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted-foreground/30 text-sm font-bold text-muted-foreground hover:border-amber-400 hover:text-amber-700 transition-colors">
            <Upload className="h-4 w-4" />
            {importing ? 'Importando...' : 'Selecionar arquivo .json de backup'}
          </button>
        </div>
      </Section>

      {/* ── Equipe / Membros ───────────────────────────────────────────── */}
      <Section title="👥 Equipe">
        <TeamManager />
      </Section>

    </div>
  );
}

// ─── Componentes internos ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest px-4 py-3 border-b bg-muted/30">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function ExportButton({ icon, titulo, desc, cor, onClick }: {
  icon: React.ReactNode; titulo: string; desc: string; cor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border text-left hover:bg-muted/50 active:scale-[0.98] transition-all">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
           style={{ background: cor }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{titulo}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
