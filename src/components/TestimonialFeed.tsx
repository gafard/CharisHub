'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Mic,
  MicOff,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Star,
  Video,
  VideoOff,
  X,
  MessageCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { uploadCommunityMedia } from './communityApi';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';

export type TestimonialCategory =
  | 'guerison'
  | 'provision'
  | 'delivrance'
  | 'transformation'
  | 'grace'
  | 'famille'
  | 'priere';

type MediaType = 'audio' | 'video';
type ReactionType = 'amens' | 'gloires' | 'prayers';
type RecordMode = 'text' | MediaType;
type RecordState = 'idle' | 'recording' | 'preview';

export interface Testimonial {
  id: string;
  created_at: string;
  group_id: string;
  author_name: string;
  author_device_id: string;
  category: TestimonialCategory;
  content?: string | null;
  media_url?: string | null;
  media_type?: MediaType | null;
  duration_sec?: number | null;
  amens_count: number;
  gloires_count: number;
  prayers_count: number;
}

const MAX_TEXT_LENGTH = 1200;
const MAX_AUDIO_SECONDS = 180;
const MAX_VIDEO_SECONDS = 90;
const MAX_MEDIA_BYTES = 80 * 1024 * 1024;

const CATEGORIES: { value: TestimonialCategory; label: string; emoji: string; color: string }[] = [
  { value: 'guerison', label: 'Guérison', emoji: '🌿', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20' },
  { value: 'provision', label: 'Provision', emoji: '🌾', color: 'text-amber-300 bg-amber-500/10 border-amber-400/20' },
  { value: 'delivrance', label: 'Délivrance', emoji: '🕊️', color: 'text-sky-300 bg-sky-500/10 border-sky-400/20' },
  { value: 'transformation', label: 'Transformation', emoji: '✨', color: 'text-violet-300 bg-violet-500/10 border-violet-400/20' },
  { value: 'grace', label: 'Grâce', emoji: '💛', color: 'text-rose-300 bg-rose-500/10 border-rose-400/20' },
  { value: 'famille', label: 'Famille', emoji: '🏠', color: 'text-orange-300 bg-orange-500/10 border-orange-400/20' },
  { value: 'priere', label: 'Prière', emoji: '🙏', color: 'text-indigo-300 bg-indigo-500/10 border-indigo-400/20' },
];

const REACTIONS: { key: ReactionType; emoji: string; label: string; countKey: keyof Pick<Testimonial, 'amens_count' | 'gloires_count' | 'prayers_count'> }[] = [
  { key: 'amens', emoji: '🙏', label: 'Amen', countKey: 'amens_count' },
  { key: 'gloires', emoji: '✨', label: 'Gloire', countKey: 'gloires_count' },
  { key: 'prayers', emoji: '❤️', label: 'Je prie', countKey: 'prayers_count' },
];

const WAVE_BARS = Array.from({ length: 20 }, (_, index) => ({
  height: 8 + ((index * 7) % 24),
  duration: 0.4 + (index % 5) * 0.08,
}));

function formatDuration(sec: number | null | undefined): string {
  const safe = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} Mo`;
}

function getCategoryMeta(cat: TestimonialCategory) {
  return CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[4];
}

function chooseRecorderMimeType(mode: MediaType): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = mode === 'video'
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

function mediaExtension(type: string, mode: MediaType) {
  const lower = type.toLowerCase();
  if (lower.includes('mp4')) return 'mp4';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mpeg')) return 'mp3';
  if (lower.includes('wav')) return 'wav';
  return mode === 'video' ? 'webm' : 'webm';
}

function mediaErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Accès au micro/caméra refusé. Vérifie les permissions.';
    if (error.name === 'NotFoundError') return 'Aucun micro ou caméra compatible trouvé.';
  }
  return "Impossible de démarrer l'enregistrement sur cet appareil.";
}

function AudioWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 items-center gap-[3px]" aria-hidden="true">
      {WAVE_BARS.map((bar, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-rose-300"
          animate={active ? { height: ['4px', `${bar.height}px`, '4px'] } : { height: '4px' }}
          transition={{ duration: bar.duration, repeat: Infinity, delay: i * 0.04, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function TestimonialCard({
  testimonial,
  onReact,
}: {
  testimonial: Testimonial;
  onReact: (id: string, reaction: ReactionType) => Promise<boolean>;
}) {
  const [playing, setPlaying] = useState(false);
  const [reacted, setReacted] = useState<Set<ReactionType>>(new Set());
  const [pending, setPending] = useState<Set<ReactionType>>(new Set());
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const meta = getCategoryMeta(testimonial.category);

  const togglePlay = async () => {
    const el = audioRef.current ?? videoRef.current;
    if (!el) return;

    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }

    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const handleReact = async (reaction: ReactionType) => {
    if (reacted.has(reaction) || pending.has(reaction)) return;

    setPending((prev) => new Set(prev).add(reaction));
    try {
      await onReact(testimonial.id, reaction);
      setReacted((prev) => new Set(prev).add(reaction));
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(reaction);
        return next;
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-black text-white/70">
            {testimonial.author_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-white">{testimonial.author_name}</div>
            <div className="text-[10px] text-white/45">
              {new Date(testimonial.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black ${meta.color}`}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      {testimonial.content ? (
        <p className="text-sm leading-relaxed text-white/80">« {testimonial.content} »</p>
      ) : null}

      {testimonial.media_url && testimonial.media_type === 'audio' ? (
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
            aria-label={playing ? 'Mettre en pause' : 'Lire le témoignage audio'}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <AudioWaveform active={playing} />
          <span className="shrink-0 text-[11px] font-bold text-white/45">
            {formatDuration(testimonial.duration_sec)}
          </span>
          <audio ref={audioRef} src={testimonial.media_url} onEnded={() => setPlaying(false)} className="hidden" />
        </div>
      ) : null}

      {testimonial.media_url && testimonial.media_type === 'video' ? (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            src={testimonial.media_url}
            className="max-h-72 w-full object-cover"
            onEnded={() => setPlaying(false)}
            playsInline
          />
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/20"
            aria-label={playing ? 'Mettre en pause' : 'Lire le témoignage vidéo'}
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/20 text-white backdrop-blur">
              {playing ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </span>
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {REACTIONS.map(({ key, emoji, label, countKey }) => {
          const isReacted = reacted.has(key);
          const isPending = pending.has(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => void handleReact(key)}
              disabled={isPending || isReacted}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                isReacted
                  ? 'border-white/20 bg-white/15 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/10 hover:text-white/85'
              } ${isPending ? 'opacity-60' : ''}`}
            >
              <span>{emoji}</span>
              <span>{label}</span>
              {testimonial[countKey] > 0 ? <span className="text-white/45">{testimonial[countKey]}</span> : null}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function RecorderModal({
  authorDeviceId,
  onClose,
  onSubmit,
}: {
  authorDeviceId: string;
  onClose: () => void;
  onSubmit: (data: {
    category: TestimonialCategory;
    content?: string;
    mediaUrl?: string;
    mediaType?: MediaType;
    durationSec?: number;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<RecordMode>('text');
  const [category, setCategory] = useState<TestimonialCategory>('grace');
  const [text, setText] = useState('');
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxDuration = mode === 'video' ? MAX_VIDEO_SECONDS : MAX_AUDIO_SECONDS;

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
    stopStream();
  }

  function reset() {
    stopRecording();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setBlob(null);
    setElapsedSec(0);
    setRecordState('idle');
    setError(null);
  }

  async function startRecording() {
    setError(null);
    chunksRef.current = [];

    if (mode === 'text') return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError("L'enregistrement audio/vidéo n'est pas disponible sur ce navigateur.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        mode === 'video'
          ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
          : { audio: true }
      );
      streamRef.current = stream;

      if (mode === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        void videoPreviewRef.current.play().catch(() => {});
      }

      const mimeType = chooseRecorderMimeType(mode);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || (mode === 'video' ? 'video/webm' : 'audio/webm');
        const nextBlob = new Blob(chunksRef.current, { type });
        mediaRecorderRef.current = null;

        if (nextBlob.size < 512) {
          setError('Enregistrement vide. Réessaie une nouvelle prise.');
          setRecordState('idle');
          return;
        }

        if (nextBlob.size > MAX_MEDIA_BYTES) {
          setError(`Le fichier est trop lourd (${formatBytes(nextBlob.size)}). Limite: ${formatBytes(MAX_MEDIA_BYTES)}.`);
          setRecordState('idle');
          return;
        }

        setBlob(nextBlob);
        setBlobUrl(URL.createObjectURL(nextBlob));
        setRecordState('preview');
      };

      recorder.start(500);
      setRecordState('recording');
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec((current) => {
          const next = current + 1;
          if (next >= maxDuration) window.setTimeout(stopRecording, 0);
          return next;
        });
      }, 1000);
    } catch (err) {
      stopStream();
      setError(mediaErrorMessage(err));
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    setError(null);

    const cleanText = text.trim();
    if (mode === 'text' && !cleanText) {
      setError("Écris ton témoignage avant d'envoyer.");
      return;
    }
    if ((mode === 'audio' || mode === 'video') && !blob) {
      setError("Enregistre d'abord ton témoignage.");
      return;
    }

    setSubmitting(true);
    try {
      let mediaUrl: string | undefined;
      const mediaType = mode === 'audio' || mode === 'video' ? mode : undefined;

      if (blob && mediaType) {
        const ext = mediaExtension(blob.type, mediaType);
        const file = new File([blob], `testimonial_${Date.now()}.${ext}`, { type: blob.type || `${mediaType}/${ext}` });
        mediaUrl = await uploadCommunityMedia(file, authorDeviceId || 'testimonial');
      }

      await onSubmit({
        category,
        content: cleanText || undefined,
        mediaUrl,
        mediaType,
        durationSec: mediaType ? elapsedSec : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const modeTabs: { key: RecordMode; label: string; icon: ReactNode }[] = [
    { key: 'text', label: 'Texte', icon: <MessageCircle size={14} /> },
    { key: 'audio', label: 'Audio', icon: <Mic size={14} /> },
    { key: 'video', label: 'Vidéo', icon: <Video size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full max-w-lg rounded-[32px] bg-gradient-to-b from-slate-800 to-slate-950 p-6 pb-8 shadow-2xl"
        style={{ maxHeight: '92dvh', overflowY: 'auto' }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-black text-white">Partager un témoignage</div>
            <div className="text-[11px] text-white/45">Texte, audio court ou vidéo courte</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/60 hover:text-white"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/45">Catégorie</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => setCategory(item.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                  category === item.value ? item.color : 'border-white/10 bg-white/[0.04] text-white/45 hover:text-white/75'
                }`}
              >
                {item.emoji} {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex gap-2">
          {modeTabs.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => {
                setMode(item.key);
                reset();
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-2.5 text-xs font-black transition ${
                mode === item.key
                  ? 'border-white/20 bg-white/15 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/45 hover:text-white/75'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {mode === 'text' ? (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
            placeholder="Raconte ce que Dieu a fait dans ta vie..."
            maxLength={MAX_TEXT_LENGTH}
            rows={5}
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
          />
        ) : null}

        {mode === 'audio' ? (
          <div className="flex flex-col items-center gap-4 py-4">
            {recordState === 'idle' ? (
              <>
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="grid h-20 w-20 place-items-center rounded-full border-2 border-rose-400/40 bg-rose-500/20 transition hover:bg-rose-500/30 active:scale-95"
                  aria-label="Démarrer l'enregistrement audio"
                >
                  <Mic size={32} className="text-rose-300" />
                </button>
                <div className="text-center text-[11px] font-bold text-white/45">Maximum {formatDuration(MAX_AUDIO_SECONDS)}</div>
              </>
            ) : null}

            {recordState === 'recording' ? (
              <>
                <AudioWaveform active />
                <div className="text-2xl font-black tabular-nums text-white">{formatDuration(elapsedSec)}</div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 shadow-lg shadow-rose-500/30 active:scale-95"
                  aria-label="Arrêter l'enregistrement audio"
                >
                  <MicOff size={22} className="text-white" />
                </button>
              </>
            ) : null}

            {recordState === 'preview' && blobUrl ? (
              <div className="w-full space-y-3">
                <audio src={blobUrl} controls className="w-full rounded-xl" />
                <div className="text-center text-[11px] text-white/45">{formatDuration(elapsedSec)} enregistrées</div>
                <button
                  type="button"
                  onClick={reset}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white/65 hover:text-white"
                >
                  <RotateCcw size={14} /> Recommencer
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === 'video' ? (
          <div className="flex flex-col items-center gap-4">
            {recordState !== 'preview' ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                <video ref={videoPreviewRef} className="h-full w-full object-cover" muted playsInline />
                {recordState === 'idle' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-sm font-bold text-white/35">Caméra inactive</div>
                  </div>
                ) : null}
                {recordState === 'recording' ? (
                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-rose-500 px-3 py-1">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    <span className="text-[10px] font-black text-white">{formatDuration(elapsedSec)}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {recordState === 'preview' && blobUrl ? (
              <div className="w-full space-y-3">
                <video src={blobUrl} controls className="max-h-56 w-full rounded-2xl object-cover" playsInline />
                <button
                  type="button"
                  onClick={reset}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white/65 hover:text-white"
                >
                  <RotateCcw size={14} /> Recommencer
                </button>
              </div>
            ) : null}

            {recordState === 'idle' ? (
              <>
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="grid h-14 w-14 place-items-center rounded-full border-2 border-rose-400/40 bg-rose-500/20 transition hover:bg-rose-500/30 active:scale-95"
                  aria-label="Démarrer l'enregistrement vidéo"
                >
                  <Video size={22} className="text-rose-300" />
                </button>
                <div className="text-center text-[11px] font-bold text-white/45">Maximum {formatDuration(MAX_VIDEO_SECONDS)}</div>
              </>
            ) : null}

            {recordState === 'recording' ? (
              <button
                type="button"
                onClick={stopRecording}
                className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 shadow-lg shadow-rose-500/30 active:scale-95"
                aria-label="Arrêter l'enregistrement vidéo"
              >
                <VideoOff size={22} className="text-white" />
              </button>
            ) : null}
          </div>
        ) : null}

        {mode !== 'text' ? (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
            placeholder="Ajoute une courte légende ou un contexte..."
            maxLength={MAX_TEXT_LENGTH}
            rows={3}
            className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
          />
        ) : null}

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || recordState === 'recording'}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-black text-black transition active:scale-[0.99] disabled:opacity-40"
        >
          {submitting ? (
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Star size={16} />
            </motion.span>
          ) : (
            <Send size={16} />
          )}
          {submitting ? 'Envoi en cours...' : 'Partager'}
        </button>
      </motion.div>
    </div>
  );
}

interface Props {
  groupId: string;
}

export default function TestimonialFeed({ groupId }: Props) {
  const { identity } = useCommunityIdentity();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableReady, setTableReady] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const [filterCat, setFilterCat] = useState<TestimonialCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ groupId, limit: '30' });
      const res = await fetch(`/api/testimonials?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Impossible de charger les témoignages.');
      setTestimonials(data.testimonials ?? []);
      setTableReady(data.tableReady !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les témoignages.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadTestimonials();
  }, [loadTestimonials]);

  const handleSubmit = async (payload: {
    category: TestimonialCategory;
    content?: string;
    mediaUrl?: string;
    mediaType?: MediaType;
    durationSec?: number;
  }) => {
    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        authorName: identity?.displayName ?? 'Anonyme',
        deviceId: identity?.deviceId ?? 'unknown',
        ...payload,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Impossible d'envoyer le témoignage.");

    setShowRecorder(false);
    await loadTestimonials();
  };

  const handleReact = async (id: string, reaction: ReactionType) => {
    const reactionMeta = REACTIONS.find((item) => item.key === reaction);
    if (!reactionMeta) return false;

    const res = await fetch('/api/testimonials/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testimonialId: id,
        reaction,
        deviceId: identity?.deviceId ?? 'unknown',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Impossible d’ajouter la réaction.');
      throw new Error(data.error || 'Impossible d’ajouter la réaction.');
    }

    setTestimonials((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const serverCount = Number(data[reactionMeta.countKey]);
        const nextCount = Number.isFinite(serverCount)
          ? serverCount
          : item[reactionMeta.countKey] + (data.reacted === false ? 0 : 1);
        return { ...item, [reactionMeta.countKey]: nextCount };
      })
    );

    return data.reacted !== false;
  };

  const filtered = filterCat === 'all'
    ? testimonials
    : testimonials.filter((testimonial) => testimonial.category === filterCat);

  if (!tableReady) {
    return (
      <div className="space-y-2 py-10 text-center">
        <div className="text-2xl">🛠️</div>
        <p className="text-sm font-bold text-white/70">La table de témoignages n'est pas encore créée.</p>
        <p className="text-xs text-white/40">Exécute la section témoignages du schéma Supabase.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => setShowRecorder(true)}
        className="flex w-full items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white/10 active:scale-[0.99]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-400/15">
          <Plus size={20} className="text-amber-300" />
        </span>
        <span className="text-left">
          <span className="block text-sm font-black text-white">Partager un témoignage</span>
          <span className="block text-xs text-white/45">Texte, audio ou vidéo</span>
        </span>
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterCat('all')}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black transition ${
            filterCat === 'all' ? 'border-white/20 bg-white/15 text-white' : 'border-white/10 bg-white/[0.04] text-white/45'
          }`}
        >
          Tous
        </button>
        {CATEGORIES.map((item) => (
          <button
            type="button"
            key={item.value}
            onClick={() => setFilterCat(item.value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black transition ${
              filterCat === item.value ? item.color : 'border-white/10 bg-white/[0.04] text-white/45'
            }`}
          >
            {item.emoji} {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.04] p-5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="space-y-3 py-12 text-center">
          <div className="text-4xl">🌟</div>
          <p className="text-sm font-bold text-white/65">Aucun témoignage pour l'instant.</p>
          <p className="text-xs text-white/40">Sois le premier à partager ce que Dieu a fait.</p>
        </div>
      ) : (
        <AnimatePresence>
          {filtered.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} onReact={handleReact} />
          ))}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {showRecorder ? (
          <RecorderModal
            authorDeviceId={identity?.deviceId ?? 'testimonial'}
            onClose={() => setShowRecorder(false)}
            onSubmit={handleSubmit}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
