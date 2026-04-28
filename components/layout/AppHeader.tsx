'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/shared/Logo';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, Crown, Download } from 'lucide-react';
import { exportarJSON } from '@/lib/exportar';
import { toast } from 'sonner';

export function AppHeader() {
  const { user, logOut, plan, inTrial, trialDaysLeft } = useAuth();

  const initial = (user?.displayName ?? user?.email ?? 'U')[0].toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-3 h-14">
        <Logo size="sm" />

        <div className="flex items-center gap-2">
          {plan === 'pro' ? (
            <Badge className="text-xs font-bold" style={{ background: '#2D6A2F' }}>
              <Crown size={10} className="mr-1" /> PRO
            </Badge>
          ) : inTrial ? (
            <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
              Beta · {trialDaysLeft}d
            </Badge>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="rounded-full h-8 w-8 font-bold text-sm flex items-center justify-center cursor-pointer"
                   style={{ background: '#2D6A2F', color: 'white' }}>
                {initial}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-xs font-semibold truncate">{user?.displayName ?? 'Produtor'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { window.location.href = '/app/config'; }}>
                <Settings size={14} className="mr-2" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { exportarJSON(); toast.success('Backup exportado!'); }}>
                <Download size={14} className="mr-2" /> Exportar Backup
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logOut} className="text-destructive">
                <LogOut size={14} className="mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
