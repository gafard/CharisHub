'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Loader2, Plus, Send, Star, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { pepitesStore, type Pepite } from '@/lib/pepitesStore';
import { useCommunityIdentity } from '@/lib/useCommunityIdentity';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupPepite {
  id: string;
  group_id: string;
  author_name: string;
  reference: string;
  verse_text: string;
  note?: string | null;
  pepite_type: 'grace' | 'identity' | 'promise';
  likes_count: number;
  created_at: string;
}

const TYPE_STYLES: Record<GroupPepite['pepite_type'], { label: string; color: string; bg: string }> = {
  grace:    { label: 'Grâce',    color: 'text-blue-500',   bg: 'bg-blue-500/10 border-blue-400/20' },
  identity: { label: 'Identité', color: 'text-amber-500',  bg: 'bg-amber-500/10 border-amber-400/20' },
  promise:  { label: 'Promesse', color: 'text-emerald-500',bg: 'bg-emerald-500/10 border-emerald-400/20' },
};

// ─── Share modal ──────────────────────────────────────────────────────────────

function SharePepiteModal({ groupId, authorName, deviceId, onClose, onShared }: {
  groupId: string;
  authorName: string;
  deviceId: string;
  onClose: () => void;
  onShared: () => void;
}) {
  const myPepites = pepitesStore.load();
  const [selected, setSelected] = useState<Pepite | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleShare = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/groups/pepites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groupId,
          reference: selected.reference,
          verseText: selected.text,
          note: note || selected.note,
          pepiteType: selected.type,
          authorName,
          deviceId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'Erreur'); return; }
      onShared();
      onClose();
    } catch {
      setError('Impossible de partager. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] bg-surface border border-border-soft p-5 pb-8 shadow-xl"
        style={{ maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-black text-foreground">Partager une Pépite</div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full bg-foreground/5 text-muted hover:text-foreground">
            <X size={14} />
          </button>
        </div>

        {myPepites.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted text-center">Tu n'as pas encore de pépites.<br />Marque des versets pendant ta lecture.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {myPepites.map(p => {
              const style = TYPE_STYLES[p.type];
              const isSelected = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(isSelected ? null : p)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${isSelected ? 'border-accent bg-accent/5' : 'border-border-soft bg-surface-strong/30 hover:bg-surface-strong/50'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.bg} ${style.color}`}>
                      {style.label}
                    </span>
                    <span className="text-[10px] font-bold text-muted">{p.reference}</span>
                  </div>
                  <p className="text-xs text-foreground/80 italic leading-relaxed line-clamp-2">« {p.text} »</p>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="mt-3">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ajouter un commentaire (optionnel)..."
              rows={2}
              className="w-full rounded-2xl bg-foreground/5 border border-border-soft px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none"
            />
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-bold mt-2">{error}</p>}

        <button
          onClick={handleShare}
          disabled={!selected || loading}
          className="mt-3 w-full rounded-2xl bg-accent hover:bg-accent/90 disabled:opacity-30 py-3 text-sm font-black text-white flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? 'Partage en cours...' : 'Partager au groupe'}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Feed card ────────────────────────────────────────────────────────────────

function PepiteCard({ pepite }: { pepite: GroupPepite }) {
  const style = TYPE_STYLES[pepite.pepite_type] ?? TYPE_STYLES.grace;
  const date = new Date(pepite.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-border-soft bg-surface-strong/40 p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-foreground/8 flex items-center justify-center">
            <Star size={13} className="text-accent" />
          </div>
          <span className="text-[10px] font-black text-foreground/70">{pepite.author_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.bg} ${style.color}`}>
            {style.label}
          </span>
          <span className="text-[9px] text-muted">{date}</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-muted mb-1">{pepite.reference}</p>
        <p className="text-sm italic text-foreground/85 leading-relaxed">« {pepite.verse_text} »</p>
        {pepite.note && <p className="mt-2 text-xs text-muted leading-relaxed">{pepite.note}</p>}
      </div>

      <div className="flex items-center gap-1 text-muted">
        <Heart size={12} />
        <span className="text-[10px] font-bold">{pepite.likes_count}</span>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  groupId: string;
}

export default function GroupPepitesFeed({ groupId }: Props) {
  const { identity } = useCommunityIdentity();
  const displayName = identity?.displayName;
  const deviceId = identity?.deviceId;
  const [pepites, setPepites] = useState<GroupPepite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableReady, setTableReady] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/pepites?groupId=${groupId}`);
      const data = await res.json();
      setPepites(data.pepites ?? []);
      setTableReady(data.tableReady !== false);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { void load(); }, [load]);

  if (!tableReady) {
    return (
      <div className="rounded-[24px] border border-border-soft bg-surface-strong/20 p-6 text-center">
        <p className="text-sm text-muted">La fonctionnalité pépites de groupe sera bientôt disponible.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-accent fill-accent/20" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">Pépites du Groupe</h3>
        </div>
        <button
          onClick={() => setShowShareModal(true)}
          className="flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-3 py-1.5 text-[10px] font-black text-accent hover:bg-accent/15 transition-colors"
        >
          <Plus size={12} /> Partager
        </button>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted" />
        </div>
      ) : pepites.length === 0 ? (
        <div className="rounded-[24px] border-2 border-dashed border-border-soft p-8 text-center">
          <Star size={24} className="mx-auto mb-3 text-muted/30" />
          <p className="text-sm font-bold text-muted">Aucune pépite partagée encore.</p>
          <p className="text-xs text-muted/60 mt-1">Sois le premier à partager un trésor avec ton groupe !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pepites.map(p => <PepiteCard key={p.id} pepite={p} />)}
        </div>
      )}

      {/* Share modal */}
      <AnimatePresence>
        {showShareModal && (
          <SharePepiteModal
            groupId={groupId}
            authorName={displayName || 'Anonyme'}
            deviceId={deviceId || ''}
            onClose={() => setShowShareModal(false)}
            onShared={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
