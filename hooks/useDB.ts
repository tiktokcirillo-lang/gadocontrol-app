'use client';
import { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { puxarDados, publicarDados } from '@/lib/members';
import { getDB, saveDB } from '@/lib/db';
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

// ── Cloud sync singleton ─────────────────────────────────────────────────────
// Garante que a leitura do Firestore ocorre apenas uma vez por carregamento
// de página, mesmo que useDB seja montado em múltiplos componentes.
let _syncPromise: Promise<void> | null = null;
let _syncUid: string | null = null;

function initCloudSync(): Promise<void> {
  if (_syncPromise) return _syncPromise;

  _syncPromise = new Promise<void>(resolve => {
    // onAuthStateChanged dispara imediatamente com o estado atual;
    // usamos `unsub()` para ouvir apenas uma vez.
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();

      if (!user) {
        resolve();
        return;
      }

      _syncUid = user.uid;

      try {
        const remote = await puxarDados(user.uid);

        if (remote) {
          // Firestore tem dados → usa como fonte de verdade
          saveDB(remote);
        } else {
          // Ainda não há dados na nuvem → sobe o localStorage atual
          await publicarDados(user.uid, getDB());
        }
      } catch (e) {
        // Falha silenciosa — localStorage continua funcionando offline
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
    // Executa migração na inicialização — corrige status de animais com efeitos perdidos
    if (repararStatusAnimais(data)) saveDB(data);
    return data;
  });
  const [version, setVersion] = useState(0);

  // Na primeira montagem: aguarda a sincronização com o Firestore e atualiza
  // o estado local com os dados vindos da nuvem (se houver).
  useEffect(() => {
    initCloudSync().then(() => {
      setDB({ ...getDB() });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza quando localStorage muda em outra aba do mesmo browser
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'gadocontrol_db') {
        setDB(getDB());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const update = useCallback((fn: (db: DB) => void) => {
    const current = getDB();
    fn(current);
    saveDB(current);          // 1. Salva local imediatamente
    setDB({ ...current });
    setVersion(v => v + 1);

    // 2. Push para o Firestore em background (não bloqueia a UI)
    const uid = _syncUid ?? auth.currentUser?.uid;
    if (uid) void publicarDados(uid, current);
  }, []);

  const refresh = useCallback(() => {
    setDB(getDB());
  }, []);

  return { db, update, refresh, version };
}
