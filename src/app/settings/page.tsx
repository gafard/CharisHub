import StudyAppShell from '../../components/StudyAppShell';
import StudyUserPanel from '../../components/StudyUserPanel';
import { Bell, Cloud, ShieldCheck, Sparkles } from 'lucide-react';

function SettingsQuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/80 p-4 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--surface-strong)] text-[color:var(--accent)]">
        {icon}
      </div>
      <div className="text-lg font-black tracking-tight text-[color:var(--foreground)]">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)]/48">
        {label}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <StudyAppShell>
      <section className="mx-auto max-w-6xl space-y-6">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-[36px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/92 shadow-[0_18px_44px_rgba(16,24,40,0.07)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,159,45,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.10),transparent_30%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />

          <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--accent)]">
                <Sparkles size={12} />
                Espace personnel
              </div>

              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
                Ton profil, ton compte et tes préférences
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--foreground)]/66 sm:text-[15px]">
                Mets à jour ton identité, gère ton compte connecté et configure les
                notifications qui t’aident à rester aligné avec tes groupes, tes
                sessions live et tes formations sur CharisHub.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <SettingsQuickStat
                icon={<ShieldCheck size={18} />}
                label="Compte"
                value="Sécurisé"
              />
              <SettingsQuickStat
                icon={<Cloud size={18} />}
                label="Sync"
                value="Cloud"
              />
              <SettingsQuickStat
                icon={<Bell size={18} />}
                label="Alertes"
                value="Actives"
              />
            </div>
          </div>
        </div>

        {/* PANEL */}
        <StudyUserPanel />
      </section>
    </StudyAppShell>
  );
}
