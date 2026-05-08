'use client';
import { createContext, useContext } from 'react';
import { useDB } from '@/hooks/useDB';
import type { DB } from '@/lib/types';

type DBContextValue = {
  db: DB;
  update: (fn: (db: DB) => void) => void;
  refresh: () => void;
  version: number;
  publishToCloud: () => Promise<void>;
  pullFromCloud: () => Promise<void>;
  warning: string | null;
};

const DBContext = createContext<DBContextValue | null>(null);

export function DBProvider({ children }: { children: React.ReactNode }) {
  const value = useDB();
  return <DBContext.Provider value={value}>{children}</DBContext.Provider>;
}

export function useDBContext(): DBContextValue {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error('useDBContext deve ser usado dentro de DBProvider');
  return ctx;
}
