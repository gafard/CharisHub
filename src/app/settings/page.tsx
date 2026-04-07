import StudyAppShell from '../../components/StudyAppShell';
import StudyUserPanel from '../../components/StudyUserPanel';

export default function SettingsPage() {
  return (
    <StudyAppShell>
      <section className="mx-auto max-w-4xl space-y-5">
        <div className="overflow-hidden rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/90 shadow-[0_18px_40px_rgba(16,24,40,0.06)]">
          <div className="relative p-6 sm:p-8">
            {/* Overlay gradient pour l'ambiance premium */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(200,159,45,0.10),rgba(255,255,255,0))]" />

            <div className="relative">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/50">
                Espace personnel
              </div>

              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[color:var(--foreground)]">
                Ton profil, ton compte et tes préférences
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--foreground)]/68">
                Mets à jour ton identité, gère ton compte connecté et configure
                les notifications qui t’aident à rester aligné avec tes groupes,
                tes sessions live et tes formations sur CharisHub.
              </p>
            </div>
          </div>
        </div>

        <StudyUserPanel />
      </section>
    </StudyAppShell>
  );
}
