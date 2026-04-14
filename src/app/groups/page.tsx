import { Suspense } from 'react';
import CommunityGroups from '../../components/CommunityGroups';
import StudyAppShell from '../../components/StudyAppShell';

export default function GroupsPage() {
  return (
    <StudyAppShell>
      <section className="space-y-4">
        <Suspense
          fallback={
            <div className="flex h-72 items-center justify-center rounded-[32px] border border-border-soft bg-surface/90 text-sm text-foreground/60">
              Chargement des groupes...
            </div>
          }
        >
          <CommunityGroups />
        </Suspense>
      </section>
    </StudyAppShell>
  );
}
