/**
 * ConnectionModeIndicator — Indicateur visuel du mode de connexion
 * 
 * Affiche :
 * - Badge "Connecté" avec icône cloud verte si Supabase configuré
 * - Badge "Mode Local" avec icône orange si Supabase non configuré
 * - Tooltip explicatif au survol
 * - Bouton pour synchroniser manuellement
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  Info,
} from 'lucide-react';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { supabase } from '../lib/supabase';

export default function ConnectionModeIndicator() {
  const { syncStatus, syncToCloud, syncFromCloud, exportData, isConnected } = useCloudSync();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  const isConnectedToSupabase = isConnected && !!supabase;

  // Ne rien afficher si l'utilisateur a fermé le tooltip
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 md:bottom-6">
      <div className="relative">
        {/* Bouton principal */}
        <button
          onClick={() => setShowSyncMenu(!showSyncMenu)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-sm
            transition-all duration-200 hover:scale-105
            ${isConnectedToSupabase
              ? 'bg-emerald-500/90 text-white hover:bg-emerald-600/90'
              : 'bg-amber-500/90 text-white hover:bg-amber-600/90'
            }
          `}
        >
          {isConnectedToSupabase ? (
            <Cloud className="w-4 h-4" />
          ) : (
            <CloudOff className="w-4 h-4" />
          )}
          
          <span className="text-xs font-semibold">
            {isConnectedToSupabase ? 'Connecté' : 'Mode Local'}
          </span>

          {syncStatus.syncing && (
            <RefreshCw className="w-3 h-3 animate-spin" />
          )}
        </button>

        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip && !showSyncMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl"
            >
              {isConnectedToSupabase ? (
                <>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">Sauvegarde cloud active</p>
                      <p className="text-gray-300">
                        Vos données sont synchronisées automatiquement toutes les 5 minutes.
                      </p>
                      {syncStatus.lastSyncAt && (
                        <p className="text-gray-400 mt-1">
                          Dernière sync : {syncStatus.lastSyncAt.toLocaleTimeString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">Mode local uniquement</p>
                      <p className="text-gray-300">
                        Vos données sont sauvegardées uniquement sur cet appareil. Configurez Supabase pour activer la synchronisation cloud.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Fermer */}
              <button
                onClick={() => setDismissed(true)}
                className="absolute top-1 right-1 p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Menu de synchronisation */}
        <AnimatePresence>
          {showSyncMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSyncMenu(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
              >
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-[#D4AF37] to-[#B8941F] text-white">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">Synchronisation</h3>
                    <button
                      onClick={() => setShowSyncMenu(false)}
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-white/80 mt-0.5">
                    {isConnectedToSupabase
                      ? 'Cloud activé • Sync auto toutes les 5 min'
                      : 'Mode local • Aucune synchronisation cloud'}
                  </p>
                </div>

                {/* Actions */}
                <div className="p-3 space-y-2">
                  {/* Sync from cloud */}
                  {isConnectedToSupabase && (
                    <button
                      onClick={async () => {
                        await syncFromCloud();
                        setShowSyncMenu(false);
                      }}
                      disabled={syncStatus.syncing}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <Download className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-gray-900">Récupérer depuis le cloud</p>
                        <p className="text-xs text-gray-500">Fusionne les données cloud avec vos données locales</p>
                      </div>
                    </button>
                  )}

                  {/* Sync to cloud */}
                  {isConnectedToSupabase && (
                    <button
                      onClick={async () => {
                        await syncToCloud();
                        setShowSyncMenu(false);
                      }}
                      disabled={syncStatus.syncing}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <Upload className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-gray-900">Sauvegarder vers le cloud</p>
                        <p className="text-xs text-gray-500">Envoyer toutes vos données vers Supabase</p>
                      </div>
                    </button>
                  )}

                  {/* Export */}
                  <button
                    onClick={() => {
                      exportData();
                      setShowSyncMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <Download className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-gray-900">Exporter mes données</p>
                      <p className="text-xs text-gray-500">Télécharger un fichier JSON de sauvegarde</p>
                    </div>
                  </button>

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-2" />

                  {/* Info */}
                  <div className="px-3 py-2 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">
                        {isConnectedToSupabase
                          ? 'Vos données sont automatiquement sauvegardées dans le cloud toutes les 5 minutes.'
                          : 'Configurez Supabase dans votre fichier .env.local pour activer la synchronisation cloud et protéger vos données.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {syncStatus.syncing && syncStatus.syncProgress && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>{syncStatus.syncProgress.current}</span>
                      <span>{Math.round((syncStatus.syncProgress.completed / syncStatus.syncProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8941F] transition-all duration-300"
                        style={{
                          width: `${(syncStatus.syncProgress.completed / syncStatus.syncProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Error */}
                {syncStatus.error && (
                  <div className="px-4 py-3 bg-red-50 border-t border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{syncStatus.error}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
