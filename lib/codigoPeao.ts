'use client';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db as firestore } from './firebase';
import { puxarDados } from './members';
import { saveDB } from './db';

const CODIGO_KEY = 'gadocontrol_peao_codigo';
const OWNER_KEY  = 'gadocontrol_peao_owner';

// Gera código alfanumérico de 6 caracteres (maiúsculas + dígitos)
export function gerarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem ambíguos (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Owner: publica o código da fazenda no Firestore
export async function publicarCodigo(ownerUid: string, codigo: string): Promise<void> {
  await setDoc(doc(firestore, 'fazendas', codigo), {
    ownerUid,
    createdAt: new Date().toISOString(),
  });
}

// Peão: entra com o código e carrega dados do owner
export async function entrarComCodigo(codigo: string): Promise<void> {
  const snap = await getDoc(doc(firestore, 'fazendas', codigo.trim().toUpperCase()));
  if (!snap.exists()) throw new Error('Código inválido ou fazenda não encontrada.');

  const ownerUid = snap.data().ownerUid as string;

  // Faz login anônimo no Firebase (para leitura autenticada)
  await signInAnonymously(auth);

  // Puxa os dados publicados pelo dono
  const db = await puxarDados(ownerUid);
  if (!db) throw new Error('O proprietário ainda não publicou os dados. Peça para ele compartilhar no app.');

  // Salva localmente
  saveDB(db);

  // Persiste referência para futuros reloads
  localStorage.setItem(CODIGO_KEY, codigo.trim().toUpperCase());
  localStorage.setItem(OWNER_KEY,  ownerUid);
}

// Retorna o ownerUid se o usuário atual é peão de outra fazenda
export function getPeaoOwner(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(OWNER_KEY);
}

// Retorna o código do peão atual
export function getPeaoCodigo(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CODIGO_KEY);
}

// Remove o vínculo de peão (ao fazer logout)
export function clearPeaoSession(): void {
  localStorage.removeItem(CODIGO_KEY);
  localStorage.removeItem(OWNER_KEY);
}
