'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Chrome,
  Heart,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login', onSuccess }: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion Google');
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'register') {
        if (!displayName.trim()) {
          setError('Veuillez entrer votre nom ou pseudo.');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, displayName);
        setSuccess('Compte cree avec succes !');
        onSuccess?.();
        setTimeout(() => onClose(), 1500);
      } else {
        await signInWithEmail(email, password);
        setSuccess('Connexion reussie !');
        onSuccess?.();
        setTimeout(() => onClose(), 1000);
      }
    } catch (err: any) {
      const msg = err.message || 'Une erreur est survenue.';
      if (msg.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect.');
      } else if (msg.includes('User already registered')) {
        setError('Un compte existe déjà avec cet email.');
      } else if (msg.includes('Password should be at least')) {
        setError('Le mot de passe doit contenir au moins 6 caractères.');
      } else if (msg.includes('Invalid email')) {
        setError('Adresse email invalide.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setSuccess(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-xl"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 sm:p-6"
          >
            <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] bg-white shadow-[0_32px_80px_rgba(0,0,0,0.25)] md:flex-row lg:h-[720px]">
              
              {/* Left Side: Visual Experience */}
              <div className="relative hidden w-full overflow-hidden bg-[#121936] md:block md:w-[45%] lg:w-[50%]">
                <div 
                  className="absolute inset-0 bg-[url('/images/Auth_pic.png')] bg-cover bg-center transition-transform duration-[10s] hover:scale-110"
                  style={{ filter: 'brightness(0.7)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121936] via-[#121936]/40 to-transparent" />
                
                {/* Brand Overlay */}
                <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
                  <div className="flex items-center gap-3">
                    <img src="/images/Logo.png" alt="Logo" className="h-10 w-auto brightness-0 invert" />
                    <div className="flex flex-col leading-none">
                      <span className="text-2xl font-black tracking-tighter">CharisHub</span>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-amber-400/80">Connectés par la grâce</span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md"
                    >
                      <Sparkles size={14} className="text-amber-400" />
                      Vision Huyos
                    </motion.div>
                    
                    <motion.h3 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-4xl font-black leading-[1.1] tracking-tight lg:text-5xl"
                    >
                      Enseigner.<br />Réunir.<br />Grandir.
                    </motion.h3>
                    
                    <motion.p 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="max-w-md text-lg font-medium text-white/70"
                    >
                      Rejoignez des milliers de croyants qui transmettent et étudient la Parole ensemble.
                    </motion.p>
                  </div>

                  <div className="flex items-center gap-4 text-sm font-semibold text-white/40">
                    <span>© 2026 CharisHub</span>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span>Communauté Privée</span>
                  </div>
                </div>
              </div>

              {/* Mobile Header Image (Visible only on small screens) */}
              <div className="relative h-48 w-full md:hidden">
                <div className="absolute inset-0 bg-[url('/images/Auth_pic.png')] bg-cover bg-center" />
                <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <img src="/images/Logo.png" alt="Logo" className="h-12 w-auto drop-shadow-2xl" />
                </div>
              </div>

              {/* Right Side: Authentication Form */}
              <div className="relative flex w-full flex-col bg-white p-8 sm:p-12 md:w-[55%] lg:w-[50%] lg:p-16">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute right-8 top-8 rounded-full bg-gray-50 p-2.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-900"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <div className="mb-10">
                    <h2 className="text-3xl font-black tracking-tight text-[#121936]">
                      {mode === 'login' ? 'Bon retour parmi nous' : 'Créer votre espace'}
                    </h2>
                    <p className="mt-2 font-medium text-slate-500">
                      {mode === 'login' 
                        ? 'Accédez à vos groupes et formations en un clic.' 
                        : 'Commencez l’expérience CharisHub dès aujourd’hui.'}
                    </p>
                  </div>

                  {/* Google OAuth Button */}
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="group relative flex w-full items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-bold text-slate-700 transition-all hover:border-[#D4AF37] hover:bg-amber-50/30 hover:shadow-[0_12px_30px_rgba(212,175,55,0.1)] active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                      <Chrome className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    Continuer avec Google
                  </button>

                  <div className="my-8 flex items-center gap-4">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ou par email</span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  {/* Messages */}
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-600 ring-1 ring-rose-100"
                      >
                        {error}
                      </motion.div>
                    )}
                    {success && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-600 ring-1 ring-emerald-100"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {success}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Form */}
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    {mode === 'register' && (
                      <div className="group relative">
                        <UserIcon className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#D4AF37]" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Votre Nom ou Pseudo"
                          className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-4 pl-14 pr-5 text-sm font-semibold outline-none transition-all focus:border-[#D4AF37] focus:bg-white focus:ring-4 focus:ring-amber-500/5 placeholder:text-slate-400"
                          required={mode === 'register'}
                        />
                      </div>
                    )}

                    <div className="group relative">
                      <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#D4AF37]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Adresse Email"
                        className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-4 pl-14 pr-5 text-sm font-semibold outline-none transition-all focus:border-[#D4AF37] focus:bg-white focus:ring-4 focus:ring-amber-500/5 placeholder:text-slate-400"
                        required
                      />
                    </div>

                    <div className="group relative">
                      <Lock className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-[#D4AF37]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mot de Passe"
                        className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 py-4 pl-14 pr-14 text-sm font-semibold outline-none transition-all focus:border-[#D4AF37] focus:bg-white focus:ring-4 focus:ring-amber-500/5 placeholder:text-slate-400"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-900"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !email || !password || (mode === 'register' && !displayName)}
                      className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#121936] py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-[#1a234f] hover:shadow-2xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          {mode === 'login' ? 'Se Connecter' : 'Rejoindre CharisHub'}
                          <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Switcher */}
                  <div className="mt-8 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      {mode === 'login' ? "Nouveau sur CharisHub ?" : 'Déjà membre ?'}
                      <button
                        type="button"
                        onClick={switchMode}
                        className="ml-2 font-black text-[#D4AF37] transition-colors hover:text-[#B8941F]"
                      >
                        {mode === 'login' ? "S'inscrire gratuitement" : 'Se connecter'}
                      </button>
                    </p>
                  </div>

                  {/* Footer Stats/Social */}
                  <div className="mt-12 flex items-center justify-between border-t border-slate-50 pt-8 text-[10px] font-bold text-slate-400">
                    <div className="flex items-center gap-2">
                       <ShieldCheck size={14} className="text-emerald-500" />
                       CONFORME RGPD
                    </div>
                    <div className="flex items-center gap-2">
                       <Heart size={14} className="text-rose-400" />
                       SANS PUBLICITÉ
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
