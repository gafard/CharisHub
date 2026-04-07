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
  Globe,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
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
        setSuccess('Compte cree avec succes ! Vous etes maintenant connecte.');
        setTimeout(() => onClose(), 1500);
      } else {
        await signInWithEmail(email, password);
        setSuccess('Connexion reussie !');
        setTimeout(() => onClose(), 1000);
      }
    } catch (err: any) {
      // Traduction des erreurs Supabase
      const msg = err.message || 'Une erreur est survenue.';
      if (msg.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect.');
      } else if (msg.includes('User already registered')) {
        setError('Un compte existe deja avec cet email.');
      } else if (msg.includes('Password should be at least')) {
        setError('Le mot de passe doit contenir au moins 6 caracteres.');
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
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              {/* Decorative Background */}
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-100/50 blur-3xl" />
              <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-100/50 blur-3xl" />

              <div className="relative p-8">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute right-6 top-6 rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Header */}
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8941F] shadow-lg shadow-amber-200">
                    <Globe className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-gray-900">
                    {mode === 'login' ? 'Bienvenue dans CharisHub' : 'Rejoindre la Communaute'}
                  </h2>
                  <p className="mt-2 text-sm text-gray-500">
                    {mode === 'login'
                      ? 'Connectez-vous pour retrouver vos groupes, plans de lecture et votre progression.'
                      : 'Creez un compte pour acceder a toutes les fonctionnalites.'}
                  </p>
                </div>

                {/* Google OAuth */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-gray-100 bg-white px-4 py-4 text-sm font-bold text-gray-700 shadow-sm transition-all hover:border-[#D4AF37] hover:bg-amber-50/50 hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
                    <Chrome className="h-4 w-4 text-blue-500" />
                  </div>
                  <span>Continuer avec Google</span>
                  {loading && <div className="absolute right-4 h-4 w-4 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />}
                </button>

                {/* Divider */}
                <div className="my-8 flex items-center gap-4">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400">Ou avec votre email</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>

                {/* Error / Success Messages */}
                {error && (
                  <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600 ring-1 ring-red-100">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-600 ring-1 ring-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                  </div>
                )}

                {/* Email/Password Form */}
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  {/* Display Name (registration only) */}
                  {mode === 'register' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative"
                    >
                      <UserIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Votre nom ou pseudo"
                        className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 py-3 pl-12 pr-4 text-sm outline-none focus:border-[#D4AF37] focus:bg-white transition-all"
                        required={mode === 'register'}
                      />
                    </motion.div>
                  )}

                  {/* Email */}
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Adresse email"
                      className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 py-3 pl-12 pr-4 text-sm outline-none focus:border-[#D4AF37] focus:bg-white transition-all"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mot de passe"
                      className="w-full rounded-2xl border border-gray-100 bg-gray-50/50 py-3 pl-12 pr-12 text-sm outline-none focus:border-[#D4AF37] focus:bg-white transition-all"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !email || !password || (mode === 'register' && !displayName)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] py-4 text-sm font-bold text-white shadow-lg shadow-amber-200/50 transition-all hover:bg-[#B8941F] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {mode === 'login' ? 'Connexion...' : 'Creation du compte...'}
                      </>
                    ) : (
                      <>
                        {mode === 'login' ? 'Se connecter' : "S'inscrire"}
                      </>
                    )}
                  </button>
                </form>

                {/* Mode Switch */}
                <div className="mt-8 space-y-4">
                  <p className="text-center text-xs text-gray-400">
                    {mode === 'login' ? "Vous n'avez pas de compte ?" : 'Vous avez deja un compte ?'}
                    <button
                      type="button"
                      onClick={switchMode}
                      className="ml-1 font-bold text-[#D4AF37] hover:underline"
                    >
                      {mode === 'login' ? "S'inscrire" : 'Se connecter'}
                    </button>
                  </p>
                </div>

                {/* Trust Footer */}
                <div className="mt-8 flex items-center justify-center gap-6 text-[10px] text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Securise par Supabase</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Heart className="h-3 w-3 text-red-300" />
                    <span>Sans publicite</span>
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
