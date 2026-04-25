'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Beef, Heart, BarChart2, DollarSign, Package } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/app',          label: 'Início',      icon: Home       },
  { href: '/app/animais',  label: 'Animais',     icon: Beef       },
  { href: '/app/saude',    label: 'Saúde',       icon: Heart      },
  { href: '/app/relatorios', label: 'Relatórios', icon: BarChart2 },
  { href: '/app/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/app/estoque',  label: 'Estoque',     icon: Package    },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-2xl mx-auto flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/app' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
                active
                  ? 'text-[#2D6A2F]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
