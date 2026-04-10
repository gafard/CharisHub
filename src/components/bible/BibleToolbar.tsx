'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clipboard,
  FileText,
  Highlighter,
  MessageSquareText,
  Pause,
  Play,
  Search,
  Volume2,
} from 'lucide-react';

type ToolMode = 'read' | 'highlight' | 'note';
type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple';

type AudioVerseSegment = {
  verse: number;
  start: number;
  end: number;
};

const HIGHLIGHT_OPTIONS: Array<{ id: HighlightColor; label: string }> = [
  { id: 'yellow', label: 'Jaune' },
  { id: 'green', label: 'Vert' },
  { id: 'pink', label: 'Rose' },
  { id: 'blue', label: 'Bleu' },
  { id: 'orange', label: 'Orange' },
  { id: 'purple', label: 'Violet' },
];

type ToolbarBtnProps = {
  active?: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

function ToolbarPill({ active = false, label, icon, onClick }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 text-[12px] font-extrabold transition-all',
        active
          ? 'border-[color:var(--accent-border)]/60 bg-[color:var(--accent-soft)]/45 text-[color:var(--foreground)] shadow-[0_6px_20px_rgba(0,0,0,0.08)]'
          : 'border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/88 hover:bg-[color:var(--surface-strong)] dark:border-white/15 dark:bg-white/10 dark:text-white/85 dark:hover:bg-white/15',
      ].join(' ')}
    >
      <span className="opacity-90">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function AudioVerseTimeline({
  segments,
  activeVerseNumber,
  playerProgress,
  onSeekToVerse,
}: {
  segments: AudioVerseSegment[];
  activeVerseNumber: number | null;
  playerProgress: number;
  onSeekToVerse: (verse: number) => void;
}) {
  if (!segments.length) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const totalSpan = Math.max(0.12, (last?.end ?? 0) - (first?.start ?? 0));
  const currentTime = (first?.start ?? 0) + totalSpan * Math.max(0, Math.min(1, playerProgress));

  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/72 px-2 py-2 dark:border-white/12 dark:bg-white/8">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--foreground)]/55">
          Progression audio
        </div>
        <div className="text-[10px] font-bold text-[color:var(--foreground)]/55">
          {activeVerseNumber ? `Verset ${activeVerseNumber}` : 'Lecture'}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="flex min-w-full items-center gap-[4px]">
          {segments.map((segment) => {
            const duration = Math.max(0.08, segment.end - segment.start);
            const ratio = duration / totalSpan;
            const isDone = currentTime >= segment.end - 0.02;
            const isActive = activeVerseNumber === segment.verse;

            return (
              <button
                key={`audio-segment-${segment.verse}`}
                type="button"
                onClick={() => onSeekToVerse(segment.verse)}
                className={[
                  'h-2.5 rounded-full border transition-all',
                  isActive
                    ? 'border-orange-300/80 bg-orange-300 shadow-[0_0_0_3px_rgba(251,146,60,0.18)]'
                    : isDone
                      ? 'border-[color:var(--accent-border)]/65 bg-[color:var(--accent)]/85'
                      : 'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] hover:bg-[color:var(--surface)] dark:border-white/20 dark:bg-white/18 dark:hover:bg-white/30',
                ].join(' ')}
                style={{
                  flexGrow: Math.max(0.4, ratio * 100),
                  flexBasis: 0,
                  minWidth: '6px',
                  maxWidth: '22px',
                }}
                title={`Aller au verset ${segment.verse}`}
                aria-label={`Aller au verset ${segment.verse}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function BibleToolbar({
  tool,
  setTool,
  onCopy,
  onOpenCompare,
  highlightColor,
  setHighlightColor,
  onOpenAdvancedStudyTools,
  playerProgress,
  playerPlaying,
  onTogglePlayer,
  audioAvailable,
  isClient,
  audioVerseSegments,
  activeAudioVerseNumber,
  onSeekToAudioVerse,
}: {
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
  onCopy: () => void;
  onOpenCompare: () => void;
  highlightColor: HighlightColor;
  setHighlightColor: (color: HighlightColor) => void;
  onOpenAdvancedStudyTools: () => void;
  playerProgress: number;
  playerPlaying: boolean;
  onTogglePlayer: () => void;
  audioAvailable: boolean;
  isClient: boolean;
  audioVerseSegments: AudioVerseSegment[];
  activeAudioVerseNumber: number | null;
  onSeekToAudioVerse: (verse: number) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const COLOR_DOT: Record<HighlightColor, string> = {
    yellow: 'bg-yellow-300',
    green: 'bg-green-300',
    pink: 'bg-pink-300',
    blue: 'bg-blue-300',
    orange: 'bg-orange-300',
    purple: 'bg-violet-300',
  };

  const toolIcons: Record<ToolMode, ReactNode> = {
    read: <BookOpen size={16} />,
    highlight: <Highlighter size={16} />,
    note: <FileText size={16} />,
  };

  return (
    <div className="w-full">
      <div className="relative rounded-[26px] border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.82)] p-3 shadow-[0_18px_50px_rgba(22,28,53,0.10)] backdrop-blur-2xl ring-1 ring-black/5 dark:border-white/12 dark:bg-[rgba(15,23,42,0.72)] dark:ring-white/5">
        
        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -top-3 left-1/2 -translate-x-1/2 flex h-6 w-12 items-center justify-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/60 shadow-md transition hover:scale-105 hover:bg-[color:var(--surface-strong)] dark:border-white/12 dark:bg-slate-800 dark:text-white/60 pointer-events-auto z-10"
          aria-label={isCollapsed ? "Déplier" : "Réduire"}
        >
          {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <AnimatePresence initial={false} mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3">
                {/* Ligne 1 */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--foreground)]/48">
                    Mode
                  </div>

                  <ToolbarPill
                    active={tool === 'read'}
                    label="Lecture"
                    icon={<BookOpen size={15} />}
                    onClick={() => setTool('read')}
                  />
                  <ToolbarPill
                    active={tool === 'highlight'}
                    label="Surligner"
                    icon={<Highlighter size={15} />}
                    onClick={() => setTool(tool === 'highlight' ? 'read' : 'highlight')}
                  />
                  <ToolbarPill
                    active={tool === 'note'}
                    label="Note"
                    icon={<FileText size={15} />}
                    onClick={() => setTool('note')}
                  />
                </div>

                {/* Palette highlight */}
                {tool === 'highlight' ? (
                  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]/70 p-2.5 dark:border-white/12 dark:bg-white/6">
                    <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--foreground)]/55">
                      Couleur du surlignage
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {HIGHLIGHT_OPTIONS.map((option) => {
                        const active = highlightColor === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setHighlightColor(option.id)}
                            className={[
                              'inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-[11px] font-bold transition-all',
                              active
                                ? 'border-[color:var(--accent-border)]/60 bg-[color:var(--accent-soft)]/45 text-[color:var(--foreground)] shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
                                : 'border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/88 hover:bg-[color:var(--surface-strong)] dark:border-white/15 dark:bg-white/10 dark:text-white/82 dark:hover:bg-white/15',
                            ].join(' ')}
                          >
                            <span className={`h-3 w-3 rounded-full ${COLOR_DOT[option.id]}`} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Ligne 2 */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--foreground)]/48">
                    Outils
                  </div>

                  <ToolbarPill
                    label="Comparer"
                    icon={<Search size={15} />}
                    onClick={onOpenCompare}
                  />
                  <ToolbarPill
                    label="Étudier"
                    icon={<MessageSquareText size={15} />}
                    onClick={onOpenAdvancedStudyTools}
                  />
                  <ToolbarPill
                    label="Copier"
                    icon={<Clipboard size={15} />}
                    onClick={onCopy}
                  />

                  <div className="ml-auto flex items-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-2 py-1.5 dark:border-white/15 dark:bg-white/8">
                    <div className="relative">
                      <svg className="pointer-events-none absolute -inset-1 h-11 w-11" viewBox="0 0 48 48">
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          stroke="var(--border-soft)"
                          strokeWidth="3"
                          fill="none"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="18"
                          stroke="var(--accent)"
                          strokeWidth="3"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 18}
                          strokeDashoffset={2 * Math.PI * 18 * (1 - playerProgress)}
                          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                        />
                      </svg>

                      <button
                        type="button"
                        onClick={onTogglePlayer}
                        className={`grid h-9 w-9 place-items-center rounded-full bg-white/85 text-[color:var(--foreground)] shadow-sm transition hover:scale-[1.03] dark:bg-white/12 dark:text-white ${
                          isClient && audioAvailable ? '' : 'cursor-not-allowed opacity-50'
                        }`}
                        aria-label={playerPlaying ? 'Pause' : 'Play'}
                        title={playerPlaying ? 'Pause' : 'Play'}
                        disabled={!isClient || !audioAvailable}
                      >
                        {playerPlaying ? <Pause size={15} /> : <Play size={15} className="translate-x-[1px]" />}
                      </button>
                    </div>

                    <div className="pr-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--foreground)]/55">
                        <Volume2 size={12} />
                        Audio
                      </div>
                      <div className="text-[11px] font-semibold text-[color:var(--foreground)]/72 text-right">
                        {playerPlaying ? 'Lecture...' : 'Écouter'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline audio */}
                {playerPlaying ? (
                  <AudioVerseTimeline
                    segments={audioVerseSegments}
                    activeVerseNumber={activeAudioVerseNumber}
                    playerProgress={playerProgress}
                    onSeekToVerse={onSeekToAudioVerse}
                  />
                ) : null}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex items-center justify-between px-2 py-1"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-400/10 text-amber-500 dark:text-amber-300">
                  {toolIcons[tool]}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mode actif</span>
                  <span className="text-[12px] font-bold capitalize text-slate-700 dark:text-slate-200">{tool === 'read' ? 'Lecture' : tool === 'highlight' ? 'Surlignage' : 'Note'}</span>
                </div>
              </div>

              {audioAvailable && (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Audio</span>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{playerPlaying ? 'En lecture' : 'En pause'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onTogglePlayer}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300 transition hover:scale-105 active:scale-95"
                  >
                    {playerPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-[1px]" />}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
