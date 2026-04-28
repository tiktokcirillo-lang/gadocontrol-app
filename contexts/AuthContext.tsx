'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserPlan } from '@/lib/types';
import { BETA_TRIAL_DAYS } from '@/lib/types';
import { verificarConvite, aceitarConvite } from '@/lib/members';

interface AuthContextType {
  user:           User | null;
  loading:        boolean;
  plan:           UserPlan;
  inTrial:        boolean;
  trialDaysLeft:  number;
  signIn:         (email: string, password: string) => Promise<void>;
  signUp:         (email: string, password: string, name?: string) => Promise<void>;
  signInGoogle:   () => Promise<void>;
  logOut:         () => Promise<void>;
  resetPassword:  (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,          setUser]          = useState<User | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [plan,          setPlan]          = useState<UserPlan>('free');
  const [inTrial,       setInTrial]       = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await loadUserData(u.uid);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loadUserData(uid: string) {
    try {
      const ref  = doc(db, 'users', uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        // Novo usuário — cria perfil com trial
        const createdAt = new Date().toISOString();
        await setDoc(ref, { plan: 'free', createdAt });
        setPlan('free');
        setInTrial(true);
        setTrialDaysLeft(BETA_TRIAL_DAYS);
        return;
      }

      const data = snap.data();
      const savedPlan = (data.plan ?? 'free') as UserPlan;
      setPlan(savedPlan);

      if (savedPlan === 'pro') {
        setInTrial(false);
        setTrialDaysLeft(0);
        return;
      }

      // Calcula trial
      const createdAt  = data.createdAt ?? new Date().toISOString();
      const diasUsando = Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / 86400000
      );
      const daysLeft   = Math.max(0, BETA_TRIAL_DAYS - diasUsando);
      setInTrial(daysLeft > 0);
      setTrialDaysLeft(daysLeft);

      // Verifica plano no Asaas em background (savedPlan é 'free' aqui após early return acima)
      void checkPlanAsaas(uid, ref);

      // Verifica se há convite pendente para o e-mail deste usuário
      const email = auth.currentUser?.email;
      if (email) void checkInvite(uid, email);
    } catch (e) {
      console.warn('[Auth] Erro ao carregar dados do usuário:', e);
    }
  }

  async function checkInvite(uid: string, email: string) {
    try {
      const invite = await verificarConvite(email);
      if (!invite) return;
      // Aceita automaticamente o convite
      await aceitarConvite(uid, email, invite.ownerUid);
    } catch { /* silencia */ }
  }

  async function checkPlanAsaas(
    uid: string,
    userRef: ReturnType<typeof doc>
  ) {
    try {
      const r = await fetch(`/api/asaas-check-plan?uid=${encodeURIComponent(uid)}`);
      const data = await r.json() as { plan?: string };
      if (data?.plan === 'pro') {
        setPlan('pro');
        setInTrial(false);
        await updateDoc(userRef, { plan: 'pro' });
      }
    } catch {
      // Mantém plano atual em caso de erro
    }
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(email: string, password: string, name?: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const ref  = doc(db, 'users', cred.user.uid);
    await setDoc(ref, {
      email,
      name:      name ?? '',
      plan:      'free',
      createdAt: new Date().toISOString(),
    });
  }

  async function signInGoogle() {
    const provider = new GoogleAuthProvider();
    const cred     = await signInWithPopup(auth, provider);
    const ref      = doc(db, 'users', cred.user.uid);
    const snap     = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email:     cred.user.email,
        name:      cred.user.displayName ?? '',
        plan:      'free',
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function logOut() {
    await signOut(auth);
    setPlan('free');
    setInTrial(false);
    setTrialDaysLeft(0);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, plan, inTrial, trialDaysLeft,
      signIn, signUp, signInGoogle, logOut, resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
