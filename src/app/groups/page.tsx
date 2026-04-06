import { Suspense } from 'react';
import CommunityGroups from '../../components/CommunityGroups';
import StudyAppShell from '../../components/StudyAppShell';

export default function GroupsPage() {
  return (
    <StudyAppShell>
      <section className="space-y-4">
        <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/90 p-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/55">
            Communauté
          </div>
          <h1 className="mt-2 text-3xl font-extrabold">Grandissez ensemble dans la Parole</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--foreground)]/68">
            Rejoignez des groupes, organisez vos temps de prière, préparez les prochaines rencontres
            et vivez des moments de communion avec les appels vidéo, le chat, le partage d&apos;écran
            et la lecture biblique synchronisée.
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
