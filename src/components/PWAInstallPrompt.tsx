'use client';

import { useEffect, useState } from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Ne rien afficher si l'app est déjà installée (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) return;

    // 2. Détecter la plateforme
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIos) setPlatform('ios');
    else if (isAndroid) setPlatform('android');

    // 3. Capturer le prompt natif Chrome/Android
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Pour iOS, on affiche une bannière manuelle après 5 secondes
    if (isIos) {
      const timer = setTimeout(() => {
        const dismissed = localStorage.getItem('pwa-prompt-dismissed');
        if (!dismissed) setShow(true);
      }, 5000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[1000] animate-in slide-in-from-bottom-10 duration-500">
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-[#121936]/90 p-5 text-white shadow-2xl backdrop-blur-2xl ring-1 ring-white/10">
        <button 
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full bg-white/10 p-1 hover:bg-white/20"
        >
          <X size={16} />
        </button>

        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-lg shadow-[#D4AF37]/20">
             <Download size={24} className="text-[#121936]" />
          </div>
          
          <div className="flex-1 pr-6">
            <h3 className="text-base font-black tracking-tight">Installer CharisHub</h3>
            <p className="mt-1 text-xs font-medium text-white/70 leading-relaxed">
              {platform === 'ios' 
                ? "Ajoutez CharisHub à votre écran d'accueil pour une expérience fluide."
                : "Installez l'application pour un accès rapide et des notifications en temps réel."
              }
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {platform === 'ios' ? (
            <div className="flex w-full items-center justify-center gap-4 rounded-2xl bg-white/10 py-3 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">
              <span>Appuyez sur</span>
              <Share size={18} className="text-[#D4AF37]" />
              <span>puis</span>
              <PlusSquare size={18} className="text-[#D4AF37]" />
              <span className="opacity-60 italic">Sur l'écran d'accueil</span>
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] py-3 text-sm font-black text-[#121936] transition-transform active:scale-95"
            >
              <Download size={18} />
              Installer maintenant
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
