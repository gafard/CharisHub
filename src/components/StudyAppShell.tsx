'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode, useEffect } from 'react';
import { BookOpen, Home, Settings, Users, LogIn, User as UserIcon, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from './AuthModal';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Accueil',
    icon: Home,
    match: (pathname: string) => pathname === '/',
  },
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
  const { user, profile, loading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // Nettoyage ponctuel du stockage local des groupes (migration vers Supabase ou suppression de tests)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const purgeKey = 'charishub_purge_local_groups_v1';
      if (!window.localStorage.getItem(purgeKey)) {
        window.localStorage.removeItem('formation_biblique_local_groups_v1');
        window.localStorage.setItem(purgeKey, 'done');
        console.log('[CharisHub] Purge du stockage local effectuée.');
      }
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="grace-particles" />

      <header className="sticky top-0 z-40 border-b border-border-soft bg-surface/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <Link href="/" className="group inline-flex items-center gap-3 rounded-full text-left transition-transform active:scale-95">
              <img src="/images/Logo.webp" alt="CharisHub Logo" className="h-[46px] w-auto object-contain drop-shadow-sm transition-transform group-hover:scale-105" />
              <span className="flex flex-col items-start leading-[1.05]">
                <span className="block text-[26px] font-black tracking-tight font-display text-foreground">CharisHub</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-accent">
                  Connectés par la grâce
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
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
                        ? 'border-accent/30 bg-accent/5 text-accent shadow-sm'
                        : 'border-transparent bg-transparent text-muted hover:text-foreground hover:bg-foreground/5',
                    ].join(' ')}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {!loading && (
              <div className="flex items-center">
                {user ? (
                  <Link href="/settings" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-amber-200/50 bg-amber-50">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon size={20} className="text-amber-600" />
                    )}
                  </Link>
                ) : (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8941F] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-200/50 transition-all hover:scale-105 active:scale-95"
                  >
                    <LogIn size={16} />
                    <span>Se connecter</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`relative mx-auto max-w-7xl ${pathname.startsWith('/bible') ? 'px-0 py-0 sm:px-8 sm:py-12' : 'px-5 py-8 sm:px-8 sm:py-12'}`}>{children}</main>

      {/* Mobile Bottom Nav — Modern Premium Edge-to-Edge */}
      <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        {/* Glassy Background Layer */}
        <div className="absolute inset-0 bg-surface/85 backdrop-blur-3xl border-t border-border-soft shadow-[0_-8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_20px_rgba(0,0,0,0.3)]" />
        
        <div className="relative flex items-center justify-around px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex w-[76px] flex-col items-center justify-center gap-1.5 py-1.5 transition-all duration-300 active:scale-90"
                aria-label={item.label}
              >
                {/* Subtle Active Pill Background */}
                {active && (
                  <motion.div 
                    layoutId="nav-active-pill"
                    className="absolute inset-0 z-0 rounded-2xl bg-gradient-to-b from-accent/10 to-transparent dark:from-accent/15"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}

                {/* Top Glowing Indicator */}
                {active && (
                  <motion.div 
                    layoutId="nav-active-indicator"
                    className="absolute -top-2 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_10px_rgba(200,159,45,0.6)]"
                    transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                  />
                )}

                <div className="relative z-10 flex items-center justify-center">
                  <Icon 
                    size={22} 
                    strokeWidth={active ? 2.5 : 2} 
                    className={`transition-all duration-300 ${active ? 'text-accent scale-110 drop-shadow-[0_2px_8px_rgba(200,159,45,0.4)]' : 'text-muted hover:text-foreground/70'}`}
                  />
                </div>
                
                <span className={`relative z-10 text-[10px] tracking-wide transition-all duration-300 ${active ? 'font-black text-accent' : 'font-medium text-muted'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
