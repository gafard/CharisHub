// IncomingGroupCallModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export type IncomingCallPayload = {
  callId: string;
  groupId: string;
  groupName?: string;
  fromName?: string; // ex: "Alexi Turner" / "Pasteur ..."
  startedAt?: string; // ISO
};

type Props = {
  open: boolean;
  call?: IncomingCallPayload | null;

  // Action: l'utilisateur accepte l'appel (tu navigues vers la room WebRTC)
  onJoin: (call: IncomingCallPayload) => Promise<void> | void;

  // Action: l'utilisateur refuse / ignore
  onDismiss: (call: IncomingCallPayload) => Promise<void> | void;

  // Optionnel: auto-fermeture si personne ne répond
  timeoutMs?: number; // default 30000 (30s)

  // Optionnel: activer une sonnerie (fichier local /public/ringtone.mp3)
  ringtoneUrl?: string; // ex: "/sounds/ringtone.mp3"
  enableVibrate?: boolean; // default true
};

function formatElapsed(startedAt?: string) {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return "";
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
  timeoutMs = 30_000,
  ringtoneUrl,
  enableVibrate = true,
}: Props) {
  const [busy, setBusy] = useState<"join" | "dismiss" | null>(null);
  const [elapsed, setElapsed] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vibratedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const safeCall = useMemo(() => call ?? null, [call]);

  // Timer "elapsed"
  useEffect(() => {
    if (!open || !safeCall?.startedAt) {
      setElapsed("");
      return;
    }
    const tick = () => setElapsed(formatElapsed(safeCall.startedAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, safeCall?.startedAt]);

  // Sonnerie + vibration + auto-timeout
  useEffect(() => {
    if (!open || !safeCall) return;

    // Auto-timeout
    if (timeoutMs > 0) {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        // Auto-dismiss si l'appel "sonne" trop longtemps
        void handleDismiss("timeout");
      }, timeoutMs);
    }

    // Vibrate (une fois)
    if (enableVibrate && !vibratedRef.current) {
      try {
        if (navigator.vibrate) {
          navigator.vibrate([200, 120, 200, 120, 300]);
        }
      } catch {
        // ignore
      }
      vibratedRef.current = true;
    }

    // Sonnerie (optionnelle)
    if (ringtoneUrl) {
      const a = new Audio(ringtoneUrl);
      a.loop = true;
      audioRef.current = a;

      // Sur le web, autoplay peut être bloqué.
      // On essaie quand même; si bloqué, l'utilisateur entendra après interaction.
      a.play().catch(() => {
        // ignore
      });
    }

    return () => {
      // cleanup
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      vibratedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, safeCall?.callId]);

  // Stop sonnerie quand on ferme
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, [open]);

  async function handleJoin() {
    if (!safeCall || busy) return;
    setBusy("join");
    try {
      // stop ringtone before joining
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

  async function handleDismiss(reason: "user" | "timeout" = "user") {
    if (!safeCall || busy) return;
    setBusy("dismiss");
    try {
      // stop ringtone
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      await onDismiss(safeCall);

      // (optionnel) tu peux log reason si tu veux
      void reason;
    } finally {
      setBusy(null);
    }
  }

  // Ne rien rendre si fermé
  if (!open || !safeCall) return null;

  const groupTitle = safeCall.groupName ? safeCall.groupName : "Groupe";
  const from = safeCall.fromName ? safeCall.fromName : "Un membre";
  const sub = elapsed ? `Appel entrant • depuis ${elapsed}` : "Appel entrant";
  const callerInitial = (from.trim().charAt(0) || "M").toUpperCase();

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-label="Appel entrant">
      <div style={styles.modal}>
        <div style={styles.banner}>
          <div style={styles.badge}>📞</div>
          <div style={styles.bannerText}>
            <div style={styles.bannerTitle}>Appel de groupe en cours</div>
            <div style={styles.bannerSubtitle}>
              {groupTitle} • {sub}
            </div>
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.centerStage}>
            <div style={styles.stageBackdropImage} />
            <div style={styles.orbAuraA} />
            <div style={styles.orbAuraB} />
            <div style={styles.pulseRingOuter} />
            <div style={styles.pulseRingInner} />
            <div style={styles.avatarCore}>{callerInitial}</div>
            <div style={styles.liveChip}>
              <span style={styles.liveDot} />
              Appel en direct
            </div>
            <div style={styles.centerTitle}>{groupTitle}</div>
            <div style={styles.centerSubtitle}>
              <span style={styles.from}>{from}</span> vous invite maintenant
            </div>
          </div>

          <div style={styles.actionPanel}>
            <div style={styles.callFrom}>
              Invitation de <span style={styles.from}>{from}</span>
            </div>
            <div style={styles.hint}>Rejoindre l’appel maintenant ?</div>

            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => void handleDismiss("user")}
                disabled={busy !== null}
                style={{
                  ...styles.btn,
                  ...styles.btnSecondary,
                  opacity: busy ? 0.7 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy === "dismiss" ? "..." : "Ignorer"}
              </button>

              <button
                type="button"
                onClick={() => void handleJoin()}
                disabled={busy !== null}
                style={{
                  ...styles.btn,
                  ...styles.btnPrimary,
                  opacity: busy ? 0.7 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy === "join" ? "..." : "Rejoindre"}
              </button>
            </div>

            <div style={styles.footerNote}>
              Astuce : si tu veux une vraie &quot;sonnerie système&quot; même écran éteint,
              il faudra ajouter les notifications push plus tard (optionnel).
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes iccIncomingPulse {
          0% {
            transform: scale(0.9);
            opacity: 0.55;
          }
          70% {
            transform: scale(1.28);
            opacity: 0.1;
          }
          100% {
            transform: scale(1.35);
            opacity: 0;
          }
        }

        @keyframes iccIncomingBreath {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(3,6,18,0.86)",
    backdropFilter: "blur(10px)",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
    zIndex: 9999,
  },
  modal: {
    width: "100vw",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    background:
      "radial-gradient(circle at 85% 0%, rgba(41,103,255,0.24), transparent 38%), radial-gradient(circle at 10% 100%, rgba(23,151,191,0.16), transparent 40%), rgba(9,12,24,0.88)",
    color: "white",
    overflow: "hidden",
  },
  banner: {
    width: "100%",
    minHeight: 112,
    padding: "20px 18px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(90deg, rgba(44,91,255,0.28), rgba(20,28,52,0.28))",
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: "0.01em",
  },
  bannerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.86,
    lineHeight: 1.35,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.2)",
    fontSize: 24,
  },
  body: {
    flex: 1,
    padding: "26px 18px 18px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    maxWidth: 680,
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
    gap: 12,
  },
  centerStage: {
    flex: 1,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    paddingTop: 10,
    gap: 10,
    overflow: "hidden",
  },
  stageBackdropImage: {
    position: "absolute",
    inset: "8% 6% auto 6%",
    height: "58%",
    borderRadius: 28,
    backgroundImage:
      "radial-gradient(circle at 20% 20%, rgba(201,162,39,0.32), transparent 44%), linear-gradient(180deg, rgba(7,11,27,0.08), rgba(7,11,27,0.58))",
    backgroundSize: "auto",
    backgroundPosition: "center",
    opacity: 0.26,
    filter: "blur(1px)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
  },
  orbAuraA: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(46,115,255,0.28), rgba(46,115,255,0))",
    filter: "blur(8px)",
    transform: "translateY(-10px)",
  },
  orbAuraB: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(49,225,179,0.20), rgba(49,225,179,0))",
    filter: "blur(6px)",
    transform: "translateY(-6px)",
  },
  pulseRingOuter: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: "50%",
    border: "2px solid rgba(126,179,255,0.48)",
    animation: "iccIncomingPulse 2.6s ease-out infinite",
  },
  pulseRingInner: {
    position: "absolute",
    width: 148,
    height: 148,
    borderRadius: "50%",
    border: "1px solid rgba(121,232,203,0.5)",
    animation: "iccIncomingPulse 2.6s ease-out 0.35s infinite",
  },
  avatarCore: {
    position: "relative",
    zIndex: 2,
    width: 112,
    height: 112,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 44,
    fontWeight: 900,
    letterSpacing: "0.02em",
    color: "#eff8ff",
    background: "linear-gradient(145deg, rgba(70,131,255,0.95), rgba(45,214,172,0.92))",
    border: "1px solid rgba(255,255,255,0.42)",
    boxShadow: "0 18px 60px rgba(39,123,255,0.42)",
    animation: "iccIncomingBreath 3.2s ease-in-out infinite",
  },
  liveChip: {
    marginTop: 10,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "7px 12px",
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(12,18,42,0.46)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(230,245,255,0.95)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#39f0b1",
    boxShadow: "0 0 0 6px rgba(57,240,177,0.18)",
  },
  centerTitle: {
    marginTop: 10,
    fontSize: 28,
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "#f8fbff",
    textShadow: "0 10px 40px rgba(26,92,255,0.32)",
  },
  centerSubtitle: {
    maxWidth: 520,
    fontSize: 15,
    lineHeight: 1.45,
    color: "rgba(230,239,255,0.82)",
  },
  actionPanel: {
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 22,
    padding: "14px 14px 12px",
    background: "linear-gradient(180deg, rgba(16,25,58,0.72), rgba(11,18,38,0.72))",
    backdropFilter: "blur(12px)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
  },
  callFrom: {
    fontSize: 15,
    opacity: 0.92,
  },
  from: {
    fontWeight: 800,
    opacity: 1,
  },
  hint: {
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 8,
  },
  btn: {
    padding: "14px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.01em",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.12)",
    color: "white",
  },
  btnPrimary: {
    background: "rgba(67, 231, 159, 0.24)",
    border: "1px solid rgba(67, 231, 159, 0.45)",
    color: "white",
  },
  footerNote: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 1.35,
  },
};
