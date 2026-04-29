'use client';
import { useState, useCallback, useEffect } from 'react';
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

export function useDB() {
  const [db,      setDB]      = useState<DB>(() => {
    const data = getDB();
    // Executa migração na inicialização — corrige status de animais com efeitos perdidos
    if (repararStatusAnimais(data)) saveDB(data);
    return data;
  });
  const [version, setVersion] = useState(0);

  // Sincroniza quando localStorage muda em outra aba
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
    saveDB(current);
    setDB({ ...current });
    setVersion(v => v + 1);
  }, []);

  const refresh = useCallback(() => {
    setDB(getDB());
  }, []);

  return { db, update, refresh, version };
}
