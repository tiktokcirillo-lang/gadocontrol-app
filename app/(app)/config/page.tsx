'use client';
import { useState, useRef, useEffect } from 'react';
import { Save, Download, Upload, FileText, FileJson, AlertTriangle, Copy, RefreshCw, CloudUpload, CloudDownload, Wifi, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDB } from '@/hooks/useDB';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { exportarJSON, importarJSON, exportarCSVFinanceiro, abrirRelatorioPDF, exportarXLSX, importarXLSX } from '@/lib/exportar';
import { emptyDB, fmtDate, getDB, saveDB } from '@/lib/db';
import { gerarDemoDB } from '@/lib/demoData';
import { TeamManager } from '@/components/config/TeamManager';
import { gerarCodigo, publicarCodigo } from '@/lib/codigoPeao';
import { solicitarPermissao, permissaoAtual } from '@/lib/pushNotifications';

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function ConfigPage() {
  const { db, update, publishToCloud, pullFromCloud } = useDB();
  const [syncing,   setSyncing]   = useState<'idle' | 'uploading' | 'downloading'>('idle');
  const [resetting, setResetting] = useState(false);
  const { user } = useAuth();
  const meta = db.meta ?? {};
  const [codigoFaz, setCodigoFaz] = useState<string>('');
  const [gerandoCod, setGerandoCod] = useState(false);
  const [notifPerm,  setNotifPerm]  = useState<NotificationPermission>('default');

  // Carrega código salvo localmente + permissão de notificações
  useEffect(() => {
    const saved = localStorage.getItem('gadocontrol_fazenda_codigo');
    if (saved) setCodigoFaz(saved);
    setNotifPerm(permissaoAtual());
  }, []);

  async function handleGerarCodigo() {
    if (!user) { toast.error('Faça login para gerar um código.'); return; }
    setGerandoCod(true);
    try {
      const code = gerarCodigo();
      await publicarCodigo(user.uid, code);
      localStorage.setItem('gadocontrol_fazenda_codigo', code);
      setCodigoFaz(code);
      toast.success('Código da fazenda gerado! Compartilhe com seus peões.');
    } catch {
      toast.error('Erro ao gerar código. Verifique sua conexão.');
    } finally {
      setGerandoCod(false);
    }
  }

  const [faz, setFaz] = useState({
    fazNome:         meta.fazNome         ?? '',
    fazProprietario: meta.fazProprietario ?? '',
    fazMunicipio:    meta.fazMunicipio    ?? '',
    fazEstado:       meta.fazEstado       ?? '',
    fazCAR:          meta.fazCAR          ?? '',
    fazAreaHa:       meta.fazAreaHa != null ? String(meta.fazAreaHa) : '',
    fazIE:           meta.fazIE           ?? '',
  });

  const [importing,      setImporting]      = useState(false);
  const [xlsxImporting,  setXlsxImporting]  = useState(false);
  const fileRef     = useRef<HTMLInputElement>(null);
  const xlsxFileRef = useRef<HTMLInputElement>(null);

  function set(k: keyof typeof faz, v: string) {
    setFaz(f => ({ ...f, [k]: v }));
  }

  async function resetarTodosDados() {
    if (!confirm(
      '⚠️ ATENÇÃO\n\nIsso vai apagar TODOS os dados da fazenda:\n• Animais\n• Eventos\n• Financeiro\n• Estoque\n• Lotes e Pastos\n\nTanto neste aparelho quanto na nuvem.\nEsta ação NÃO pode ser desfeita.'
    )) return;
    if (!confirm('Tem certeza absoluta? Os dados serão perdidos permanentemente.')) return;

    setResetting(true);
    try {
      // 1. Salva DB vazio no localStorage imediatamente
      saveDB(emptyDB());

      // 2. Sobe o DB vazio para o Firestore (sobrescreve qualquer dado existente).
      //    Usamos publishToCloud() que já lê do localStorage (agora vazio) e faz o push.
      //    Isso é mais confiável que deleteDoc pois usa permissão de escrita (não delete).
      try {
        await publishToCloud();
      } catch {
        // Se falhar (ex: regras não publicadas ainda), o localStorage já está vazio.
        // O sync futuro não vai restaurar dados porque o local estará mais recente (updatedAt novo).
      }

      toast.success('Todos os dados foram apagados. Recarregando...');
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error('Erro ao apagar dados. Tente novamente.');
      setResetting(false);
    }
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

  // Após qualquer operação que escreve diretamente no localStorage (import, demo),
  // precisamos: (1) carimbar updatedAt para vencer o Firestore no próximo sync,
  // e (2) fazer push imediato para o Firestore, evitando que o sync do reload
  // sobrescreva o localStorage com dados antigos da nuvem.
  async function syncAposEscritaLocal() {
    const local = getDB();
    local.meta  = { ...local.meta, updatedAt: new Date().toISOString() };
    saveDB(local);
    try { await publishToCloud(); } catch { /* sem regras ou offline — updatedAt já protege */ }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Isso vai substituir TODOS os dados atuais pelo arquivo de backup. Confirmar?')) return;
    setImporting(true);
    try {
      await importarJSON(file);
      await syncAposEscritaLocal();
      toast.success('Backup restaurado com sucesso! Recarregando...');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleImportXLSX(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setXlsxImporting(true);
    try {
      const res = await importarXLSX(file);
      await syncAposEscritaLocal();
      toast.success(
        `Importação concluída: ${res.adicionados} adicionados, ${res.atualizados} atualizados.`
      );
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar planilha.');
    } finally {
      setXlsxImporting(false);
      if (xlsxFileRef.current) xlsxFileRef.current.value = '';
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
          <ExportButton
            icon={<Download className="h-4 w-4" />}
            titulo="Planilha Excel (.xlsx)"
            desc="Exporta animais, eventos, financeiro e estoque em abas separadas"
            cor="#15803d"
            onClick={() => { exportarXLSX(); toast.success('Planilha Excel exportada!'); }}
          />
        </div>
      </Section>

      {/* ── Sincronização com a Nuvem ─────────────────────────────────── */}
      <Section title="☁️ Sincronização com a Nuvem">
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Use estes botões para forçar a sincronização entre este aparelho e a nuvem.
            Útil ao trocar de dispositivo ou após corrigir dados.
          </p>

          {/* Status do último sync */}
          {db.meta?.syncedAt && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2">
              <Wifi className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <p className="text-xs text-green-800">
                Última sincronização: {new Date(db.meta.syncedAt).toLocaleString('pt-BR')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {/* Enviar para a nuvem */}
            <button
              disabled={syncing !== 'idle'}
              onClick={async () => {
                if (!confirm(`Enviar os dados deste aparelho (${(db.animais ?? []).length} animais) para a nuvem, sobrescrevendo o que está salvo lá?`)) return;
                setSyncing('uploading');
                try {
                  await publishToCloud();
                  toast.success('Dados enviados para a nuvem!');
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Erro ao enviar.');
                } finally {
                  setSyncing('idle');
                }
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-green-300 text-green-800 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              {syncing === 'uploading'
                ? <RefreshCw className="h-5 w-5 animate-spin" />
                : <CloudUpload className="h-5 w-5" />}
              <div className="text-center">
                <p className="text-xs font-bold">Enviar para nuvem</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {(db.animais ?? []).length} animais · {(db.eventos ?? []).length} eventos
                </p>
              </div>
            </button>

            {/* Baixar da nuvem */}
            <button
              disabled={syncing !== 'idle'}
              onClick={async () => {
                if (!confirm('Baixar dados da nuvem? Os dados locais deste aparelho serão substituídos.')) return;
                setSyncing('downloading');
                try {
                  await pullFromCloud();
                  toast.success('Dados baixados da nuvem!');
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Erro ao baixar.');
                } finally {
                  setSyncing('idle');
                }
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-blue-300 text-blue-800 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {syncing === 'downloading'
                ? <RefreshCw className="h-5 w-5 animate-spin" />
                : <CloudDownload className="h-5 w-5" />}
              <div className="text-center">
                <p className="text-xs font-bold">Baixar da nuvem</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sobrescreve dados locais</p>
              </div>
            </button>
          </div>
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
            onClick={async () => {
              if (!confirm('Isso vai substituir TODOS os dados atuais pelos dados de exemplo. Confirmar?')) return;
              try {
                saveDB(gerarDemoDB());
                await syncAposEscritaLocal();
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

      {/* ── Importar Planilha XLSX ────────────────────────────────────── */}
      <Section title="📊 Importar Planilha Excel">
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Importe animais a partir de uma planilha Excel (<strong>.xlsx</strong>) exportada pelo GadoControl.
            Animais com o mesmo brinco serão <strong>atualizados</strong>; novos brincos serão <strong>adicionados</strong>.
          </p>
          <input
            ref={xlsxFileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportXLSX}
            className="hidden"
          />
          <button
            onClick={() => xlsxFileRef.current?.click()}
            disabled={xlsxImporting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted-foreground/30 text-sm font-bold text-muted-foreground hover:border-green-400 hover:text-green-700 transition-colors">
            <Upload className="h-4 w-4" />
            {xlsxImporting ? 'Importando...' : 'Selecionar planilha .xlsx'}
          </button>
        </div>
      </Section>

      {/* ── Notificações ──────────────────────────────────────────────── */}
      <Section title="🔔 Notificações">
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Receba alertas de saúde do rebanho, partos previstos e vacinas a vencer diretamente no celular.
          </p>
          {notifPerm === 'granted' ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <p className="text-sm font-bold text-green-800">Notificações ativas</p>
                <p className="text-xs text-green-700">Você receberá alertas de saúde e partos.</p>
              </div>
            </div>
          ) : notifPerm === 'denied' ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <p className="font-bold">Notificações bloqueadas</p>
              <p className="text-xs mt-1">Ative nas configurações do seu navegador/dispositivo.</p>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-green-300 text-green-800 hover:bg-green-50"
              onClick={async () => {
                const perm = await solicitarPermissao();
                setNotifPerm(perm);
                if (perm === 'granted') toast.success('Notificações ativadas!');
              }}
            >
              🔔 Ativar notificações
            </Button>
          )}
        </div>
      </Section>

      {/* ── Código da Fazenda (Peão) ──────────────────────────────────── */}
      <Section title="🔑 Código da Fazenda">
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Gere um código de 6 caracteres para que peões e funcionários acessem os dados da fazenda
            sem precisar de e-mail ou conta Google.
          </p>

          {codigoFaz ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border-2 border-green-200 bg-green-50 p-4">
                <span className="text-3xl font-black font-mono tracking-[0.3em] text-green-900 select-all">
                  {codigoFaz}
                </span>
                <button
                  onClick={() => { navigator.clipboard.writeText(codigoFaz); toast.success('Código copiado!'); }}
                  className="ml-auto p-2 rounded-lg border border-green-300 text-green-700 hover:bg-green-100 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Compartilhe este código com seus peões. Eles acessam pela tela de login → &quot;Acessar com código&quot;.
              </p>
              <button
                onClick={handleGerarCodigo}
                disabled={gerandoCod}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground underline"
              >
                <RefreshCw className="w-3 h-3" />
                {gerandoCod ? 'Gerando...' : 'Gerar novo código'}
              </button>
            </div>
          ) : (
            <Button
              className="w-full font-bold"
              style={{ background: '#b45309' }}
              onClick={handleGerarCodigo}
              disabled={gerandoCod}
            >
              {gerandoCod ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : '🔑 '}
              Gerar Código da Fazenda
            </Button>
          )}
        </div>
      </Section>

      {/* ── Equipe / Membros ───────────────────────────────────────────── */}
      <Section title="👥 Equipe">
        <TeamManager />
      </Section>

      {/* ── Zona de Perigo ────────────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-950/20 overflow-hidden">
        <p className="text-[11px] font-black text-red-700 uppercase tracking-widest px-4 py-3 border-b border-red-200 bg-red-100/60 dark:bg-red-900/30 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" /> Zona de Perigo
        </p>
        <div className="p-4 space-y-3">
          <p className="text-xs text-red-800 dark:text-red-300">
            Apaga <strong>todos os dados da fazenda</strong> permanentemente — animais, eventos, financeiro, estoque, lotes e pastos.
            Esta ação não pode ser desfeita.
          </p>
          <button
            disabled={resetting}
            onClick={resetarTodosDados}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-400 text-sm font-black text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            {resetting
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Trash2 className="h-4 w-4" />}
            {resetting ? 'Apagando...' : 'Apagar todos os dados'}
          </button>
        </div>
      </div>

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
