'use client';
import { useState, useCallback, useEffect } from 'react';
import { getDB, saveDB } from '@/lib/db';
import type { DB } from '@/lib/types';

export function useDB() {
  const [db,      setDB]      = useState<DB>(() => getDB());
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
