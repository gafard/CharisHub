import React, { useEffect, useMemo, useRef, useState } from 'react';

export type IncomingCallPayload = {
  callId: string;
  groupId: string;
  groupName?: string;
  fromName?: string;
  startedAt?: string;
};

type Props = {
  open: boolean;
  call?: IncomingCallPayload | null;
  onJoin: (call: IncomingCallPayload) => Promise<void> | void;
  onDismiss: (call: IncomingCallPayload) => Promise<void> | void;
  timeoutMs?: number;
  ringtoneUrl?: string;
  enableVibrate?: boolean;
};

function formatElapsed(startedAt?: string) {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return '';
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export default function IncomingGroupCallModal({
  open,
  call,
  onJoin,
  onDismiss,
  timeoutMs = 30000,
  ringtoneUrl,
  enableVibrate = true,
}: Props) {
  const [busy, setBusy] = useState<'join' | 'dismiss' | null>(null);
  const [elapsed, setElapsed] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const vibratedRef = useRef(false);

  const safeCall = useMemo(() => call ?? null, [call]);

  useEffect(() => {
    if (!open || !safeCall?.startedAt) {
      setElapsed('');
      return;
    }

    const tick = () => setElapsed(formatElapsed(safeCall.startedAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, safeCall?.startedAt]);

  useEffect(() => {
    if (!open || !safeCall) return;

    if (timeoutMs > 0) {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        void handleDismiss();
      }, timeoutMs);
    }

    if (enableVibrate && !vibratedRef.current) {
      try {
        if (navigator.vibrate) {
          navigator.vibrate([220, 140, 220, 140, 320]);
        }
      } catch {
        //
      }
      vibratedRef.current = true;
    }

    if (ringtoneUrl) {
      const a = new Audio(ringtoneUrl);
      a.loop = true;
      audioRef.current = a;
      a.play().catch(() => {});
    }

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }

      vibratedRef.current = false;
    };
  }, [open, safeCall, timeoutMs, ringtoneUrl, enableVibrate]);

  async function handleJoin() {
    if (!safeCall || busy) return;
    setBusy('join');

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }

      await onJoin(safeCall);
    } finally {
      setBusy(null);
    }
  }

  async function handleDismiss() {
    if (!safeCall || busy) return;
    setBusy('dismiss');

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }

      await onDismiss(safeCall);
    } finally {
      setBusy(null);
    }
  }

  if (!open || !safeCall) return null;

  const groupTitle = safeCall.groupName || 'Session de groupe';
  const from = safeCall.fromName || 'Un membre';
  const callerInitial = (from.trim().charAt(0) || 'M').toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] bg-[rgba(3,6,18,0.82)] backdrop-blur-xl">
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-[460px] overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,25,44,0.96),rgba(10,14,28,0.98))] text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(69,122,255,0.30),transparent_62%)]" />
          <div className="absolute -top-10 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(68,211,168,0.20),transparent_70%)] blur-2xl" />

          <div className="relative px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-8">
            {/* Top status */}
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.14)]" />
                Appel entrant
              </div>

              {elapsed ? (
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
                  Depuis {elapsed}
                </div>
              ) : null}
            </div>

            {/* Center */}
            <div className="mt-8 text-center">
              <div className="relative mx-auto flex h-[108px] w-[108px] items-center justify-center rounded-full border border-white/20 bg-[linear-gradient(145deg,#447bff,#35d6aa)] text-[42px] font-black text-white shadow-[0_24px_60px_rgba(52,120,255,0.35)]">
                <div className="absolute inset-[-18px] rounded-full border border-[#7eb3ff]/30 animate-[ping_2.4s_ease-out_infinite]" />
                <div className="absolute inset-[-34px] rounded-full border border-[#7de8cd]/18 animate-[ping_2.8s_ease-out_infinite]" />
                {callerInitial}
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/75">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Session en cours
              </div>

              <h2 className="mt-5 text-3xl font-black tracking-tight text-white">
                {groupTitle}
              </h2>

              <p className="mt-3 text-sm leading-7 text-white/72">
                <span className="font-bold text-white">{from}</span> vous invite à rejoindre
                l’appel maintenant.
              </p>
            </div>

            {/* Content card */}
            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                    Groupe
                  </div>
                  <div className="mt-1 text-sm font-bold text-white/90">{groupTitle}</div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                    Invitation de
                  </div>
                  <div className="mt-1 text-sm font-bold text-white/90">{from}</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void handleDismiss()}
                  disabled={busy !== null}
                  className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3.5 text-sm font-bold text-white/92 transition hover:bg-white/12 disabled:opacity-60"
                >
                  {busy === 'dismiss' ? '...' : 'Ignorer'}
                </button>

                <button
                  type="button"
                  onClick={() => void handleJoin()}
                  disabled={busy !== null}
                  className="rounded-2xl border border-emerald-300/25 bg-[linear-gradient(135deg,rgba(67,231,159,0.24),rgba(50,180,255,0.24))] px-4 py-3.5 text-sm font-bold text-white shadow-[0_18px_35px_rgba(67,231,159,0.12)] transition hover:translate-y-[-1px] disabled:opacity-60"
                >
                  {busy === 'join' ? 'Connexion...' : 'Rejoindre'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
