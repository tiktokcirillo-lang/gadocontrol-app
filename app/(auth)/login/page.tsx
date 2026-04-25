'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/shared/Logo';

type Mode = 'login' | 'register' | 'reset';

export default function LoginPage() {
  const router                    = useRouter();
  const { signIn, signUp, signInGoogle, resetPassword } = useAuth();
  const [mode,    setMode]        = useState<Mode>('login');
  const [email,   setEmail]       = useState('');
  const [password, setPassword]   = useState('');
  const [name,    setName]        = useState('');
  const [showPw,  setShowPw]      = useState(false);
  const [loading, setLoading]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        router.push('/app');
      } else if (mode === 'register') {
        await signUp(email, password, name);
        toast.success('Conta criada! Bem-vindo ao GadoControl.');
        router.push('/app');
      } else {
        await resetPassword(email);
        toast.success('Email de recuperação enviado!');
        setMode('login');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        toast.error('Email ou senha incorretos.');
      } else if (msg.includes('email-already-in-use')) {
        toast.error('Este email já está cadastrado.');
      } else if (msg.includes('weak-password')) {
        toast.error('Senha fraca — use ao menos 6 caracteres.');
      } else {
        toast.error('Erro ao entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      await signInGoogle();
      router.push('/app');
    } catch {
      toast.error('Erro ao entrar com Google.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #1a2e1a 0%, #2D6A2F 100%)' }}>

      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Logo size="lg" />
          </div>
          <p className="text-green-200 text-sm mt-1">Controle de Rebanho Bovino</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="pb-2 pt-6 px-6">
            <h2 className="text-xl font-bold text-center">
              {mode === 'login'    && 'Entrar na conta'}
              {mode === 'register' && 'Criar conta grátis'}
              {mode === 'reset'    && 'Recuperar senha'}
            </h2>
            {mode === 'register' && (
              <p className="text-center text-sm text-muted-foreground">
                60 dias grátis, sem cartão
              </p>
            )}
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-1">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              {mode !== 'reset' && (
                <div className="space-y-1">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Esqueci a senha
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full font-bold"
                style={{ background: '#2D6A2F' }}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'login'    && 'Entrar'}
                {mode === 'register' && 'Criar conta'}
                {mode === 'reset'    && 'Enviar email de recuperação'}
              </Button>
            </form>

            {mode !== 'reset' && (
              <>
                <div className="relative my-4">
                  <Separator />
                  <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    ou
                  </span>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogle}
                  disabled={loading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continuar com Google
                </Button>
              </>
            )}

            <div className="mt-4 text-center text-sm">
              {mode === 'login' && (
                <span>
                  Não tem conta?{' '}
                  <button onClick={() => setMode('register')} className="font-semibold underline" style={{ color: '#2D6A2F' }}>
                    Criar grátis
                  </button>
                </span>
              )}
              {mode === 'register' && (
                <span>
                  Já tem conta?{' '}
                  <button onClick={() => setMode('login')} className="font-semibold underline" style={{ color: '#2D6A2F' }}>
                    Entrar
                  </button>
                </span>
              )}
              {mode === 'reset' && (
                <button onClick={() => setMode('login')} className="font-semibold underline" style={{ color: '#2D6A2F' }}>
                  Voltar para o login
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-green-300 opacity-70">
          GadoControl © {new Date().getFullYear()} · Dados salvos localmente no seu dispositivo
        </p>
      </div>
    </div>
  );
}
