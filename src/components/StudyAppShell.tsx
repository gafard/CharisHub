'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BookOpen, CalendarDays, Home, Settings, Users } from 'lucide-react';

const NAV_ITEMS = [
  {
    href: '/bible',
    label: 'Parole',
    icon: BookOpen,
    match: (pathname: string) => pathname.startsWith('/bible'),
  },
  {
    href: '/groups',
    label: 'Communauté',
    icon: Users,
    match: (pathname: string) => pathname.startsWith('/groups'),
  },
  {
    href: '/settings',
    label: 'Profil',
    icon: Settings,
    match: (pathname: string) => pathname.startsWith('/settings'),
  },
];

export default function StudyAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen bg-[#FCF9F3] text-[#1a2142]">
      <div className="grace-particles" />

      <header className="sticky top-0 z-40 border-b border-[#e8ebf1] bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <Link href="/" className="group inline-flex items-center gap-3 rounded-full text-left transition-transform active:scale-95">
              <img src="/images/Logo.png" alt="CharisHub Logo" className="h-[46px] w-auto object-contain drop-shadow-sm transition-transform group-hover:scale-105" />
              <span className="flex flex-col items-start leading-[1.05]">
                <span className="block text-[26px] font-black tracking-tight font-display text-[#141b37]">CharisHub</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-[#c89f2d]">
                  Connectés par la grâce
                </span>
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold transition-all',
                    active
                      ? 'border-[#c89f2d]/30 bg-[#fdfaf3] text-[#b78616] shadow-sm'
                      : 'border-transparent bg-transparent text-[#1a2142]/60 hover:text-[#1a2142] hover:bg-[#1a2142]/5',
                  ].join(' ')}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8ebf1] bg-white/90 px-3 py-3 pb-safe backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition-all',
                  active
                    ? 'text-[#b78616]'
                    : 'text-[color:var(--foreground)]/40 hover:text-[color:var(--foreground)] hover:bg-[#fffdf9]',
                ].join(' ')}
              >
                <Icon size={16} />
                <span className="mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
