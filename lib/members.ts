'use client';
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc,
  collection, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db as firestore } from './firebase';
import type { DB } from './types';

export type MemberRole = 'editor' | 'viewer';
export type MemberStatus = 'pending' | 'active';

export interface FarmMember {
  uid: string;
  email: string;
  name?: string;
  role: MemberRole;
  status: MemberStatus;
  invitedAt: string;
  acceptedAt?: string;
}

// Convida um usuário pelo e-mail para fazer parte da fazenda
export async function convidarMembro(
  ownerUid: string,
  email: string,
  role: MemberRole = 'editor'
): Promise<void> {
  const safeKey = email.replace(/\./g, '_').replace(/@/g, '__');
  const ref = doc(firestore, 'farms', ownerUid, 'members', safeKey);
  await setDoc(ref, {
    email,
    role,
    status: 'pending',
    invitedAt: new Date().toISOString(),
  });
}

// Aceita o convite — chamado quando o usuário convidado faz login
export async function aceitarConvite(
  memberUid: string,
  memberEmail: string,
  ownerUid: string
): Promise<void> {
  const safeKey = memberEmail.replace(/\./g, '_').replace(/@/g, '__');
  const memberRef = doc(firestore, 'farms', ownerUid, 'members', safeKey);
  await updateDoc(memberRef, {
    uid: memberUid,
    status: 'active',
    acceptedAt: new Date().toISOString(),
  });
  // Registra link na conta do membro
  const userRef = doc(firestore, 'users', memberUid);
  await updateDoc(userRef, { farmLink: ownerUid, farmLinkRole: 'editor' });
}

// Lista todos os membros de uma fazenda
export async function listarMembros(ownerUid: string): Promise<FarmMember[]> {
  const col = collection(firestore, 'farms', ownerUid, 'members');
  const snap = await getDocs(col);
  return snap.docs.map(d => ({ ...(d.data() as Omit<FarmMember, 'uid'>), uid: d.data().uid ?? '' }));
}

// Remove um membro da fazenda
export async function removerMembro(ownerUid: string, email: string): Promise<void> {
  const safeKey = email.replace(/\./g, '_').replace(/@/g, '__');
  await deleteDoc(doc(firestore, 'farms', ownerUid, 'members', safeKey));
  // Tenta remover o link do usuário se ele estiver ativo
  try {
    const q = query(collection(firestore, 'users'), where('farmLink', '==', ownerUid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.data().email === email) {
        await updateDoc(d.ref, { farmLink: null, farmLinkRole: null });
      }
    }
  } catch { /* silencia */ }
}

// Publica o DB do dono no Firestore para que membros possam sincronizar
export async function publicarDados(ownerUid: string, db: DB): Promise<void> {
  const ref = doc(firestore, 'farms', ownerUid, 'data', 'snapshot');
  await setDoc(ref, {
    payload: JSON.stringify(db),
    updatedAt: serverTimestamp(),
  });
}

// Puxa o DB do dono a partir do Firestore
export async function puxarDados(ownerUid: string): Promise<DB | null> {
  const ref  = doc(firestore, 'farms', ownerUid, 'data', 'snapshot');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const raw = snap.data().payload as string;
  return JSON.parse(raw) as DB;
}

// Verifica se o usuário está vinculado a outra fazenda como membro
export async function verificarVinculo(uid: string): Promise<string | null> {
  const ref  = doc(firestore, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return (snap.data().farmLink as string) ?? null;
}

// Verifica se há convite pendente pelo e-mail
export async function verificarConvite(email: string): Promise<{ ownerUid: string } | null> {
  const safeKey = email.replace(/\./g, '_').replace(/@/g, '__');
  // Busca em todas as fazendas (limitado — em produção usaria um índice inverso)
  // Para simplificar, usamos a coleção 'invites' como índice
  const ref  = doc(firestore, 'invites', safeKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ownerUid: snap.data().ownerUid as string };
}

// Cria índice de convite (chamado junto com convidarMembro)
export async function criarIndiceConvite(ownerUid: string, email: string): Promise<void> {
  const safeKey = email.replace(/\./g, '_').replace(/@/g, '__');
  await setDoc(doc(firestore, 'invites', safeKey), { ownerUid, email, createdAt: new Date().toISOString() });
}
