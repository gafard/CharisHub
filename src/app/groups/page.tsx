import { Suspense } from 'react';
import CommunityGroups from '../../components/CommunityGroups';
import StudyAppShell from '../../components/StudyAppShell';

export default function GroupsPage() {
  return (
    <StudyAppShell>
      <section className="space-y-4">
        <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/90 p-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/55">
            Groupes · Appels · Formations
          </div>
          <h1 className="mt-2 text-3xl font-extrabold">
            Organisez vos groupes et animez vos sessions chrétiennes
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--foreground)]/68">
            Créez des groupes d’étude, lancez des appels en direct, planifiez vos rencontres,
            proposez des formations gratuites ou payantes et accompagnez votre communauté
            dans un cadre centré sur la Parole.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex h-72 items-center justify-center rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/90 text-sm text-[color:var(--foreground)]/60">
              Chargement de la communauté...
            </div>
          }
        >
          <CommunityGroups />
        </Suspense>
      </section>
    </StudyAppShell>
  );
}
