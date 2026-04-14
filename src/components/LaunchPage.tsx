'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Settings, Users, Video, Loader2 } from 'lucide-react';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useAuth } from '../contexts/AuthContext';
import { fetchGroups } from './communityApi';
import AuthModal from './AuthModal';

const SESSION_RESTORE_GUARD_MS = 1200;

export default function LaunchPage() {
  const [mounted, setMounted] = useState(false);
  const [securityTimeout, setSecurityTimeout] = useState(false);
  const [myGroupId, setMyGroupId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const router = useRouter();
  const { identity } = useCommunityIdentity();
  const { user, loading: authLoading } = useAuth();

  const loading = authLoading && !securityTimeout;
  const isRegistered = !!(user || identity?.displayName);

  useEffect(() => {
    setMounted(true);
    // Garde-fou: ne jamais bloquer durablement l'ouverture sur la restauration de session.
    const timer = setTimeout(() => {
      setSecurityTimeout(true);
    }, SESSION_RESTORE_GUARD_MS);
    return () => clearTimeout(timer);
  }, []);

  // Redirection automatique pour les utilisateurs connectés ou déjà inscrits
  useEffect(() => {
    if (mounted && !loading) {
      const hasSeenLaunch = sessionStorage.getItem('charishub_launch_seen') === 'true';
      
      // Si l'utilisateur a une session Supabase ACTIVE, on redirige systématiquement
      if (user || (hasSeenLaunch && isRegistered)) {
        if (myGroupId) {
          router.replace(`/groups?group=${myGroupId}`);
        } else {
          router.replace('/groups');
        }
      }
    }
  }, [mounted, loading, user, isRegistered, myGroupId, router]);

  useEffect(() => {
    if (mounted && identity?.deviceId) {
      fetchGroups(100, identity.deviceId)
        .then((groups) => {
          const joinedGroup = groups.find((g) => g.joined);
          if (joinedGroup) setMyGroupId(joinedGroup.id);
        })
        .catch(() => {});
    }
  }, [mounted, identity?.deviceId]);

  // Écran de Splash pendant la restauration de la session
  if (!mounted || loading) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#fffdf9]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <img src="/images/Logo.webp" alt="CharisHub" className="h-20 w-auto animate-pulse" />
          <div className="flex items-center gap-3 text-sm font-bold text-[#c89f2d]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Restauration de votre session...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  const navigateTo = (href: string) => {
    sessionStorage.setItem('charishub_launch_seen', 'true');
    router.push(href);
  };

  const handleMainAction = () => {
    if (isRegistered) {
      sessionStorage.setItem('charishub_launch_seen', 'true');
      if (myGroupId) {
        router.push(`/groups?group=${myGroupId}`);
      } else {
        router.push('/groups');
      }
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const navItems = [
    { label: 'Bible', href: '/bible', icon: BookOpen },
    { label: 'Groupes', href: '/groups', icon: Users },
    { label: 'Profil', href: '/settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-[#f5f7fb] p-3 sm:p-5 lg:p-7">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex min-h-[calc(100vh-24px)] max-w-[1420px] flex-col overflow-hidden rounded-[28px] border border-[#e8ebf1] bg-[#fffdf9] shadow-[0_26px_70px_rgba(15,23,42,0.12)] sm:min-h-[calc(100vh-40px)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.09),transparent_62%)]" />
        <div className="pointer-events-none absolute inset-x-[14%] bottom-0 h-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,182,72,0.14),rgba(255,255,255,0))] blur-3xl" />

        <header className="relative z-20 flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
          <button
            type="button"
            onClick={handleMainAction}
            className="inline-flex items-center gap-3 rounded-full text-left text-[#141b37]"
          >
            <img src="/images/Logo.webp" alt="CharisHub Logo" className="h-[46px] w-auto object-contain drop-shadow-sm" />
            <span className="flex flex-col items-start leading-[1.05]">
              <span className="block text-[26px] font-black tracking-tight font-display">CharisHub</span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-[#c89f2d] max-w-full truncate">
                Connectés par la grâce
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => navigateTo(item.href)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a2142]/72 transition hover:text-[#10162f]"
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleMainAction}
              className="inline-flex items-center gap-2 rounded-full bg-[#121936] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_36px_rgba(18,25,54,0.22)] transition hover:translate-y-[-1px] hover:shadow-[0_20px_42px_rgba(18,25,54,0.28)]"
            >
              {isRegistered ? 'Accéder à la plateforme' : "S'inscrire"}
              <ArrowRight size={15} />
            </button>
          </nav>

          <button
            type="button"
            onClick={handleMainAction}
            className="inline-flex items-center gap-2 rounded-full bg-[#121936] px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(18,25,54,0.2)] transition lg:hidden"
          >
            {isRegistered ? 'Accéder' : "S'inscrire"}
            <ArrowRight size={15} />
          </button>
        </header>

        <div className="relative z-10 flex flex-1 flex-col pb-8">
          <div className="mx-auto flex w-full max-w-[820px] flex-col items-center px-5 pt-8 text-center sm:px-8 sm:pt-14 lg:pt-16">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.55 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#eee7da] bg-white/88 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b78616] shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
            >
              <Video size={14} />
              Réunir. Enseigner. Grandir.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.62 }}
              className="mt-6 max-w-[760px] text-[1.9rem] font-black leading-[1.05] tracking-[-0.05em] text-[#161c35] xs:text-4xl sm:mt-10 sm:text-6xl lg:text-[4.5rem]"
            >
              Crée des groupes,
              <br />
              lance des appels,
              <br />
              transmets la Parole.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.62 }}
              className="mt-5 max-w-[680px] text-base font-medium leading-7 text-[#4b556f] sm:text-[1.15rem]"
            >
              CharisHub est une plateforme chrétienne pensée pour réunir des croyants autour
              d’appels, de groupes d’étude, de temps de prière et de formations gratuites ou payantes,
              dans un environnement dédié à la foi et à la transmission.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.62 }}
              className="relative z-20 mt-8 flex flex-col items-center gap-3 sm:flex-row"
            >
              <button
                type="button"
                onClick={handleMainAction}
                className="inline-flex items-center gap-2 rounded-full bg-[#121936] px-6 py-3.5 text-sm font-bold text-white shadow-[0_16px_36px_rgba(18,25,54,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_20px_42px_rgba(18,25,54,0.3)]"
              >
                {isRegistered ? 'Accéder à la plateforme' : "Créer mon compte"}
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/bible')}
                className="inline-flex items-center gap-3 rounded-full border border-[#ebe6db] bg-surface px-6 py-3.5 text-sm font-semibold text-[#141b37] shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition hover:border-[#d9d1c0] hover:bg-[#fffdf8]"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f4efe3] text-[#b78616]">
                  <BookOpen size={15} />
                </span>
                Explorer la Bible
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.62 }}
              className="mt-8 grid w-full max-w-[760px] grid-cols-1 gap-3 sm:grid-cols-3"
            >
              <div className="rounded-2xl border border-[#ece7db] bg-white/90 px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">Groupes</div>
                <p className="mt-2 text-sm font-medium text-[#4b556f]">
                  Crée des espaces de prière, d’étude ou de suivi.
                </p>
              </div>

              <div className="rounded-2xl border border-[#ece7db] bg-white/90 px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">Appels</div>
                <p className="mt-2 text-sm font-medium text-[#4b556f]">
                  Lance des rencontres en ligne pour enseigner et partager en direct.
                </p>
              </div>

              <div className="rounded-2xl border border-[#ece7db] bg-white/90 px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">Formations</div>
                <p className="mt-2 text-sm font-medium text-[#4b556f]">
                  Propose des parcours gratuits ou payants dans un cadre chrétien.
                </p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.75 }}
            className="pointer-events-none relative -mt-12 w-[120%] max-w-none overflow-hidden lg:-mt-16 lg:w-[115%] max-lg:-ml-[10%]"
          >
            <img
              src="/images/People_Background.webp"
              alt="Communauté CharisHub"
              className="relative z-0 w-full object-cover object-top"
              loading="lazy"
            />
          </motion.div>
        </div>
      </motion.div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode="register"
      />
    </div>
  );
}
