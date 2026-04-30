'use client';
import { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db as firestore } from '@/lib/firebase';
import { puxarDados, publicarDados } from '@/lib/members';
import { getDB, saveDB } from '@/lib/db';
import { repararMorteLancamentos } from '@/lib/eventos';
import type { DB } from '@/lib/types';

/**
 * Migração: re-aplica efeitos de Venda e Morte para animais cujo status
 * não foi atualizado (bug antigo onde nomeGrupo não era encontrado).
 * Roda uma única vez ao montar o app — idempotente.
 */
function repararStatusAnimais(db: DB): boolean {
  let alterou = false;
  (db.eventos ?? []).forEach(ev => {
    if (ev.tipo !== 'Venda' && ev.tipo !== 'Morte') return;
    const id  = (ev.brincoAnimal ?? '').toUpperCase();
    const idx = (db.animais ?? []).findIndex(
      a => a.brinco?.toUpperCase() === id || a.nomeGrupo?.toUpperCase() === id,
    );
    if (idx === -1) return;
    const a = db.animais[idx];
    if (ev.tipo === 'Venda' && a.status !== 'Vendido') {
      db.animais[idx] = {
        ...a,
        status:     'Vendido',
        dataVenda:  a.dataVenda  ?? ev.data,
        precoVenda: a.precoVenda ?? ev.preco,
        updatedAt:  new Date().toISOString(),
      };
      alterou = true;
    } else if (ev.tipo === 'Morte' && a.status !== 'Morto') {
      db.animais[idx] = { ...a, status: 'Morto', updatedAt: new Date().toISOString() };
      alterou = true;
    }
  });
  return alterou;
}

/**
 * Verifica caminhos legados do app HTML anterior (users/{uid}/data/*).
 * O app antigo pode ter gravado o DB em vários documentos diferentes.
 */
async function lerCaminhoLegado(uid: string): Promise<DB | null> {
  const candidatos = ['gadocontrol_db', 'fazenda', 'db', 'dados', 'snapshot', 'main'];
  for (const docId of candidatos) {
    try {
      const ref  = doc(firestore, 'users', uid, 'data', docId);
      const snap = await getDoc(ref);
      if (!snap.exists()) continue;
      const data = snap.data();
      // App antigo pode ter guardado como JSON string no campo "payload"
      if (typeof data.payload === 'string') {
        const parsed = JSON.parse(data.payload) as Partial<DB>;
        if (Array.isArray(parsed.animais)) return parsed as DB;
      }
      // Ou como objeto direto com campo "animais"
      if (Array.isArray(data.animais)) return data as unknown as DB;
    } catch { /* continua para o próximo candidato */ }
  }
  return null;
}

// ── Cloud sync singleton ─────────────────────────────────────────────────────
// Uma única Promise por carregamento de página, compartilhada por todas as
// instâncias de useDB montadas simultaneamente.
let _syncPromise: Promise<void> | null = null;
let _syncUid: string | null = null;

function initCloudSync(): Promise<void> {
  if (_syncPromise) return _syncPromise;

  _syncPromise = new Promise<void>(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub(); // ouve apenas uma vez

      if (!user) { resolve(); return; }
      _syncUid = user.uid;

      try {
        // 1. Busca no caminho principal (farms/{uid}/data/snapshot)
        let remote = await puxarDados(user.uid);

        // 2. Se não encontrou, tenta caminho legado do app HTML antigo
        if (!remote) {
          const legado = await lerCaminhoLegado(user.uid);
          if (legado) {
            // Migra para o novo caminho e usa como remoto
            await publicarDados(user.uid, legado);
            remote = legado;
          }
        }

        if (remote) {
          const local      = getDB();
          const localTime  = local.meta?.updatedAt  ?? '';
          const remoteTime = remote.meta?.updatedAt ?? '';

          if (!localTime || remoteTime >= localTime) {
            // Remoto é mais recente (ou local nunca foi marcado) → usa remoto
            saveDB(remote);
          } else {
            // Local é mais recente → sobe para a nuvem
            await publicarDados(user.uid, local);
          }
        }
        // Se remote === null: não faz auto-push.
        // Isso evita que dados de demo ou vazios sobrescrevam dados reais na nuvem.
        // O usuário deve usar o botão "Enviar para a nuvem" na tela de Configurações.

      } catch (e) {
        console.warn('[useDB] Falha na sincronização com a nuvem:', e);
      }

      resolve();
    });
  });

  return _syncPromise;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useDB() {
  const [db,      setDB]      = useState<DB>(() => {
    const data = getDB();
    let dirty = repararStatusAnimais(data);
    if (repararMorteLancamentos(data)) dirty = true;
    if (dirty) saveDB(data);
    return data;
  });
  const [version, setVersion] = useState(0);

  // Na primeira montagem: aguarda sync do Firestore e atualiza estado local
  useEffect(() => {
    initCloudSync().then(() => {
      const synced = getDB();
      let dirty = repararStatusAnimais(synced);
      if (repararMorteLancamentos(synced)) dirty = true;
      if (dirty) saveDB(synced);
      setDB({ ...synced });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza quando localStorage muda em outra aba do mesmo browser
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'gadocontrol_db') setDB(getDB());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const update = useCallback((fn: (db: DB) => void) => {
    const current = getDB();
    fn(current);
    // Marca timestamp de atualização — resolve conflitos de sincronização
    current.meta = { ...current.meta, updatedAt: new Date().toISOString() };
    saveDB(current);          // 1. Salva local imediatamente
    setDB({ ...current });
    setVersion(v => v + 1);
    // 2. Push para Firestore em background (não bloqueia a UI)
    const uid = _syncUid ?? auth.currentUser?.uid;
    if (uid) void publicarDados(uid, current);
  }, []);

  const refresh = useCallback(() => {
    setDB(getDB());
  }, []);

  /**
   * Força o envio dos dados locais para o Firestore.
   * Use na tela de Config para garantir que este dispositivo "vence" o sync.
   */
  const publishToCloud = useCallback(async (): Promise<void> => {
    const uid = _syncUid ?? auth.currentUser?.uid;
    if (!uid) throw new Error('Usuário não autenticado.');
    const current = getDB();
    current.meta = { ...current.meta, updatedAt: new Date().toISOString(), syncedAt: new Date().toISOString() };
    saveDB(current);
    setDB({ ...current });
    await publicarDados(uid, current);
  }, []);

  /**
   * Força o download dos dados do Firestore, sobrescrevendo o localStorage.
   * Use na tela de Config para puxar dados de outro dispositivo.
   */
  const pullFromCloud = useCallback(async (): Promise<void> => {
    const uid = _syncUid ?? auth.currentUser?.uid;
    if (!uid) throw new Error('Usuário não autenticado.');
    const remote = await puxarDados(uid);
    if (!remote) throw new Error('Nenhum dado encontrado na nuvem para esta conta.');
    remote.meta = { ...remote.meta, syncedAt: new Date().toISOString() };
    saveDB(remote);
    setDB({ ...remote });
  }, []);

  return { db, update, refresh, version, publishToCloud, pullFromCloud };
}
