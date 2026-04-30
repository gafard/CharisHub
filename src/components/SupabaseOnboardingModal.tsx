/**
 * SupabaseOnboardingModal — Modal d'onboarding pour configurer Supabase
 * 
 * S'affiche lorsque Supabase n'est pas configuré et explique :
 * - Pourquoi configurer Supabase (backup cloud, sync multi-appareils, communautés)
 * - Comment obtenir les clés Supabase
 * - Où les mettre dans .env.local
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  CloudOff,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Database,
  Users,
  X,
  ArrowRight,
} from 'lucide-react';

interface SupabaseOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupabaseOnboardingModal({ isOpen, onClose }: SupabaseOnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(text === 'url' ? 'url' : 'key');
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const steps = [
    {
      title: 'Pourquoi configurer Supabase ?',
      icon: Cloud,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Actuellement, <strong>toutes vos données sont stockées uniquement sur cet appareil</strong>. 
            Si vous nettoyez votre navigateur ou changez d'appareil, vous perdez tout.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
              <CloudOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 text-sm">Sans Supabase (actuel)</p>
                <ul className="text-xs text-red-700 mt-1 space-y-1">
                  <li>❌ Données 100% locales (risque de perte)</li>
                  <li>❌ Pas de synchronisation multi-appareils</li>
                  <li>❌ Pas de communautés ni d'appels de groupe</li>
                  <li>❌ Pas de notifications push</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl">
              <Cloud className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900 text-sm">Avec Supabase</p>
                <ul className="text-xs text-emerald-700 mt-1 space-y-1">
                  <li>✅ Backup cloud automatique toutes les 5 min</li>
                  <li>✅ Sync sur tous vos appareils</li>
                  <li>✅ Communautés & appels de groupe WebRTC</li>
                  <li>✅ Notifications push pour les invitations</li>
                  <li>✅ Export/Import manuel de données</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Étape 1 : Créer un compte Supabase',
      icon: ExternalLink,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Supabase est une base de données cloud <strong>gratuite</strong> jusqu'à 500 MB 
            (largement suffisant pour CharisHub).
          </p>

          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#D4AF37] text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <p className="font-semibold text-sm">Rendez-vous sur</p>
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm mt-1"
                >
                  supabase.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#D4AF37] text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <p className="font-semibold text-sm">Créez un compte gratuit</p>
                <p className="text-xs text-muted mt-1">
                  Utilisez GitHub, Google ou votre email
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#D4AF37] text-white flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <p className="font-semibold text-sm">Créez un nouveau projet</p>
                <p className="text-xs text-muted mt-1">
                  Nommez-le "charishub" et choisissez la région la plus proche
                </p>
              </div>
            </li>
          </ol>
        </div>
      ),
    },
    {
      title: 'Étape 2 : Récupérer les clés API',
      icon: Shield,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Une fois le projet créé, allez dans <strong>Settings → API</strong> pour récupérer vos clés.
          </p>

          <div className="bg-gray-900 text-gray-100 rounded-xl p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-mono text-gray-400">Project URL</p>
                <button
                  onClick={() => copyToClipboard('https://xxxxx.supabase.co')}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                >
                  {copiedVar === 'url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-sm font-mono">https://xxxxx.supabase.co</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-mono text-gray-400">anon public key</p>
                <button
                  onClick={() => copyToClipboard('eyJhbGci...')}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                >
                  {copiedVar === 'key' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-sm font-mono truncate">eyJhbGci...</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
            <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              <strong>Important :</strong> Gardez vos clés secrètes. Ne les partagez jamais publiquement.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Étape 3 : Configurer .env.local',
      icon: Database,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Dans le dossier de votre projet CharisHub, créez ou modifiez le fichier <code className="px-2 py-0.5 bg-gray-100 rounded text-sm">.env.local</code> :
          </p>

          <div className="bg-gray-900 text-gray-100 rounded-xl p-4">
            <pre className="text-xs font-mono space-y-1">
              <code>{`# --- SUPABASE ---
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."

# (Optionnel) Clés serveur
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_ANON_KEY="eyJhbGci..."`}</code>
            </pre>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
            <Database className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <strong>Ensuite :</strong> Exécutez le schéma SQL dans l'éditeur SQL du dashboard Supabase 
              (fichier <code className="font-mono">supabase-schema.sql</code> et <code className="font-mono">supabase-backup-sync.sql</code>).
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Étape 4 : Redémarrer l\'application',
      icon: ArrowRight,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            Après avoir configuré les variables d'environnement, redémarrez l'application :
          </p>

          <div className="bg-gray-900 text-gray-100 rounded-xl p-4">
            <pre className="text-xs font-mono">
              <code>{`# Arrêter le serveur (Ctrl+C)
# Puis redémarrer
npm run dev`}</code>
            </pre>
          </div>

          <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-[#D4AF37]/10 rounded-xl border border-emerald-400/30">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <p className="font-bold text-emerald-900">Terminé !</p>
            </div>
            <p className="text-sm text-emerald-800">
              Vous verrez le badge <strong>"Connecté"</strong> en bas à droite. Vos données seront 
              automatiquement sauvegardées dans le cloud toutes les 5 minutes.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const IconComponent = currentStepData.icon;

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-10 lg:inset-20 max-w-2xl mx-auto bg-surface rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-[#D4AF37] to-[#B8941F] text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Configuration Supabase</h2>
                    <p className="text-xs text-white/80">
                      Étape {currentStep + 1} sur {steps.length}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress bar */}
              <div className="mt-4 w-full h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-surface transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-foreground">{currentStepData.title}</h3>
                {currentStepData.content}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-surface-strong border-t border-border-soft flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Précédent
              </button>

              <div className="flex items-center gap-2">
                {/* Step indicators */}
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentStep ? 'bg-[#D4AF37]' : 'bg-gray-300'
                    }`}
                  />
                ))}

                <button
                  onClick={() => {
                    if (currentStep < steps.length - 1) {
                      setCurrentStep(currentStep + 1);
                    } else {
                      onClose();
                    }
                  }}
                  className="ml-4 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#D4AF37] text-white hover:bg-[#B8941F] transition-colors"
                >
                  {currentStep < steps.length - 1 ? 'Suivant →' : 'Terminé'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
