'use client';
import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, RefreshCw, Share2, Users, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  convidarMembro, criarIndiceConvite, listarMembros, removerMembro,
  publicarDados, puxarDados, verificarVinculo,
  type FarmMember,
} from '@/lib/members';
import { getDB, saveDB } from '@/lib/db';

export function TeamManager() {
  const { user } = useAuth();
  const [email, setEmail]           = useState('');
  const [members, setMembers]       = useState<FarmMember[]>([]);
  const [farmLink, setFarmLink]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [inviting, setInviting]     = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ms, link] = await Promise.all([
        listarMembros(user.uid),
        verificarVinculo(user.uid),
      ]);
      setMembers(ms);
      setFarmLink(link === user.uid ? null : link);
    } catch { /* silencia — Firestore pode não estar configurado */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleConvidar() {
    if (!user || !email.trim()) return;
    setInviting(true);
    try {
      await Promise.all([
        convidarMembro(user.uid, email.trim()),
        criarIndiceConvite(user.uid, email.trim()),
      ]);
      toast.success(`Convite enviado para ${email.trim()}`);
      setEmail('');
      await load();
    } catch {
      toast.error('Erro ao enviar convite. Verifique as permissões do Firestore.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemover(m: FarmMember) {
    if (!user) return;
    if (!confirm(`Remover ${m.email} da equipe?`)) return;
    try {
      await removerMembro(user.uid, m.email);
      toast.success('Membro removido.');
      await load();
    } catch {
      toast.error('Erro ao remover membro.');
    }
  }

  async function handlePublicar() {
    if (!user) return;
    setPublishing(true);
    try {
      await publicarDados(user.uid, getDB());
      toast.success('Dados publicados para a equipe!');
    } catch {
      toast.error('Erro ao publicar dados.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleSincronizar() {
    if (!farmLink) return;
    setSyncing(true);
    try {
      const data = await puxarDados(farmLink);
      if (!data) { toast.error('Nenhum dado publicado ainda pelo responsável.'); return; }
      saveDB(data);
      toast.success('Dados sincronizados!');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error('Erro ao sincronizar dados.');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Carregando equipe...</div>;
  }

  // ── Membro de outra fazenda ───────────────────────────────────────────────
  if (farmLink) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
          <Users size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-900">Membro de fazenda</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Você está vinculado à fazenda de outro produtor. Sincronize para atualizar os dados.
            </p>
          </div>
        </div>
        <Button
          className="w-full h-11 font-bold"
          style={{ background: '#2563eb' }}
          onClick={handleSincronizar}
          disabled={syncing}
        >
          <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar dados da fazenda'}
        </Button>
      </div>
    );
  }

  // ── Dono da fazenda ───────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Publicar para membros */}
      <Button
        variant="outline"
        className="w-full h-10 font-bold text-sm"
        onClick={handlePublicar}
        disabled={publishing}
      >
        <Share2 size={14} className="mr-2" />
        {publishing ? 'Publicando...' : 'Publicar dados para a equipe'}
      </Button>

      {/* Convidar */}
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="E-mail do colaborador"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConvidar()}
          className="flex-1 h-10"
        />
        <Button
          className="h-10 px-4 font-bold text-white"
          style={{ background: '#2D6A2F' }}
          onClick={handleConvidar}
          disabled={inviting || !email.trim()}
        >
          <UserPlus size={14} className={inviting ? 'animate-pulse' : ''} />
        </Button>
      </div>

      {/* Lista de membros */}
      {members.length === 0 ? (
        <p className="text-xs text-center text-muted-foreground py-4">
          Nenhum colaborador adicionado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                {m.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{m.email}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{m.role}</p>
              </div>
              {m.status === 'active' ? (
                <CheckCircle size={14} className="text-green-500 shrink-0" />
              ) : (
                <Clock size={14} className="text-amber-500 shrink-0" />
              )}
              <button onClick={() => handleRemover(m)} className="text-destructive hover:opacity-70 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground text-center">
            ✓ = ativo &nbsp;·&nbsp; ⏱ = convite pendente
          </p>
        </div>
      )}
    </div>
  );
}
