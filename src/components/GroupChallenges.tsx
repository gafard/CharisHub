'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Plus, 
  ChevronRight, 
  BookOpen, 
  Flame,
  Zap,
  Clock,
  ArrowRight
} from 'lucide-react';
import { 
  fetchChallenges, 
  createChallenge, 
  joinChallenge, 
  fetchChallengeParticipants,
  type CommunityChallenge,
  type CommunityChallengeParticipant,
  type CommunityChallengeType
} from './communityApi';
import logger from '@/lib/logger';

interface GroupChallengesProps {
  groupId: string;
  isAdmin: boolean;
  actor: { userId?: string | null; deviceId: string; displayName: string };
}

export default function GroupChallenges({ groupId, isAdmin, actor }: GroupChallengesProps) {
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<CommunityChallenge | null>(null);
  const [participants, setParticipants] = useState<CommunityChallengeParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Form state for creation
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<CommunityChallengeType>('bible_reading');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadChallenges();
  }, [groupId]);

  async function loadChallenges() {
    setLoading(true);
    try {
      const data = await fetchChallenges(groupId, actor);
      setChallenges(data);
    } catch (err) {
      logger.error('Failed to load challenges', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await createChallenge({
        group_id: groupId,
        title,
        description,
        target_type: targetType,
        target_config: {}, // Simplified for now
        end_date: endDate || undefined
      });
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      loadChallenges();
    } catch (err) {
      logger.error('Failed to create challenge', err);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(challengeId: string) {
    try {
      await joinChallenge(challengeId, actor);
      loadChallenges();
    } catch (err) {
      logger.error('Failed to join challenge', err);
    }
  }

  async function viewChallengeDetails(challenge: CommunityChallenge) {
    setSelectedChallenge(challenge);
    setLoadingParticipants(true);
    try {
      const parts = await fetchChallengeParticipants(challenge.id);
      setParticipants(parts);
    } catch (err) {
      logger.error('Failed to load participants', err);
    } finally {
      setLoadingParticipants(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-500" size={20} />
          <h3 className="text-lg font-black text-foreground">Défis du groupe</h3>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-accent/20 transition hover:scale-105 active:scale-95"
          >
            <Plus size={16} /> Créer un défi
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {challenges.length > 0 ? (
          challenges.map((challenge) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative overflow-hidden rounded-[28px] border border-border-soft bg-surface-strong/50 p-5 backdrop-blur-md transition hover:border-accent/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  {challenge.target_type === 'bible_reading' ? <BookOpen size={20} /> : <Flame size={20} />}
                </div>
                {challenge.my_progress ? (
                  <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-600">
                    <CheckCircle2 size={12} /> Inscrit
                  </div>
                ) : (
                  <button
                    onClick={() => handleJoin(challenge.id)}
                    className="rounded-full bg-accent px-3 py-1 text-[10px] font-black uppercase text-white"
                  >
                    Rejoindre
                  </button>
                )}
              </div>

              <div className="mt-4">
                <h4 className="text-base font-black text-foreground">{challenge.title}</h4>
                <p className="mt-1 line-clamp-2 text-xs text-muted leading-relaxed">
                  {challenge.description || "Aucune description fournie."}
                </p>
              </div>

              {challenge.my_progress && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase text-muted">
                    <span>Ma progression</span>
                    <span className="text-accent">{challenge.my_progress.progress_percent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${challenge.my_progress.progress_percent}%` }}
                      className="h-full bg-gradient-to-r from-accent to-emerald-500" 
                    />
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-border-soft pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted">
                    <Users size={12} /> {challenge.participants_count} participants
                  </div>
                  {challenge.end_date && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500">
                      <Clock size={12} /> {new Date(challenge.end_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => viewChallengeDetails(challenge)}
                  className="text-[10px] font-black uppercase tracking-widest text-accent hover:underline"
                >
                  Détails
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-strong text-2xl">
              🎯
            </div>
            <h4 className="font-black text-foreground">Aucun défi en cours</h4>
            <p className="mt-2 text-xs text-muted">
              {isAdmin ? "Créez le premier défi pour motiver le groupe !" : "L'administrateur n'a pas encore lancé de défi."}
            </p>
          </div>
        )}
      </div>

      {/* Modal Détails */}
      <AnimatePresence>
        {selectedChallenge && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => setSelectedChallenge(null)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-lg overflow-hidden rounded-[32px] bg-surface p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-black text-foreground">{selectedChallenge.title}</h3>
                <button onClick={() => setSelectedChallenge(null)} className="text-muted"><Plus className="rotate-45" /></button>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl bg-surface-strong p-4 text-sm leading-relaxed text-muted">
                  {selectedChallenge.description}
                </div>

                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Target size={16} className="text-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">Classement du groupe</span>
                  </div>
                  
                  <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
                    {loadingParticipants ? (
                      <div className="py-8 text-center text-xs">Chargement des participants...</div>
                    ) : participants.length > 0 ? (
                      participants.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-strong text-xs font-black">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-black text-foreground">Utilisateur {idx + 1}</div>
                            <div className="mt-1.5 h-1 w-full rounded-full bg-surface-strong overflow-hidden">
                              <div className="h-full bg-accent" style={{ width: `${p.progress_percent}%` }} />
                            </div>
                          </div>
                          <div className="text-[10px] font-black text-accent">{p.progress_percent}%</div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-muted">Aucun participant pour le moment.</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Création */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-[32px] bg-surface p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="mb-6 text-xl font-black text-foreground">Nouveau Défi</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Titre du défi</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="ex: Lire l'Évangile de Marc"
                    className="mt-1 w-full rounded-xl border border-border-soft bg-surface-strong px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Description</label>
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Expliquez l'objectif aux membres..."
                    className="mt-1 h-24 w-full rounded-xl border border-border-soft bg-surface-strong px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Type</label>
                    <select 
                      value={targetType}
                      onChange={e => setTargetType(e.target.value as CommunityChallengeType)}
                      className="mt-1 w-full rounded-xl border border-border-soft bg-surface-strong px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-accent"
                    >
                      <option value="bible_reading">Lecture</option>
                      <option value="prayer">Prière</option>
                      <option value="custom">Libre</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Fin (optionnel)</label>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border-soft bg-surface-strong px-4 py-3 text-sm font-bold text-foreground outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleCreate}
                  disabled={creating || !title.trim()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-accent/20 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {creating ? "Création..." : "Lancer le défi"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
