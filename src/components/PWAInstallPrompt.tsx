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
    const isDesktop = !isIos && !isAndroid && window.innerWidth > 768;

    if (isIos) setPlatform('ios');
    else if (isAndroid) setPlatform('android');

    // 3. Capturer le prompt natif Chrome/Android/Desktop
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // On affiche le prompt immédiatement sur Desktop, ou après un délai sur mobile
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
    <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-full md:max-w-sm z-[1000] animate-in slide-in-from-bottom-10 duration-500">
      <div className="relative overflow-hidden rounded-[24px] border border-white/20 bg-[#121936]/95 p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl ring-1 ring-white/10">
        <button 
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 hover:bg-white/20 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-lg shadow-[#D4AF37]/20">
             <Download size={22} className="text-[#121936]" />
          </div>
          
          <div className="flex-1 pr-6 text-left">
            <h3 className="text-[15px] font-black tracking-tight">Expérience CharisHub</h3>
            <p className="mt-1 text-[11px] font-medium text-white/70 leading-relaxed">
              {platform === 'ios' 
                ? "Ajoutez l'app sur votre écran d'accueil pour une fluidité totale."
                : "Installez l'application pour un accès rapide et une expérience immersive."
              }
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          {platform === 'ios' ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-xl bg-white/10 py-3 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/5">
              <span>Appuyez sur</span>
              <Share size={16} className="text-[#D4AF37]" />
              <span>puis</span>
              <PlusSquare size={16} className="text-[#D4AF37]" />
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] py-3.5 text-xs font-black text-[#121936] shadow-lg shadow-[#D4AF37]/10 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Download size={16} />
              Installer sur cet appareil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
