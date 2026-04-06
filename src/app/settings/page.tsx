import StudyAppShell from '../../components/StudyAppShell';
import StudyUserPanel from '../../components/StudyUserPanel';

export default function SettingsPage() {
  return (
    <StudyAppShell>
      <section className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/90 p-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/55">
            Profil
          </div>
          <h1 className="mt-2 text-3xl font-extrabold">Ton identité et tes préférences</h1>
          <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]/68">
            Renseigne ton nom, choisis ta langue et active les notifications pour rester connecté
            aux temps de prière, aux rencontres et aux appels de ta communauté.
          </p>
        </div>

        <StudyUserPanel />
      </section>
    </StudyAppShell>
  );
}
