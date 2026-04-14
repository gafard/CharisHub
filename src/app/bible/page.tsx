import { Suspense } from 'react';
import BibleReader from '../../components/BibleReader';
import StudyAppShell from '../../components/StudyAppShell';

export default function BiblePage() {
  return (
    <StudyAppShell>
      <section className="space-y-4">
        <div className="rounded-[32px] border border-border-soft bg-surface/90 p-4 sm:p-6">
          <Suspense
            fallback={
              <div className="flex h-72 items-center justify-center text-sm text-foreground/60">
                Chargement de la Parole...
              </div>
            }
          >
            <BibleReader />
          </Suspense>
        </div>
      </section>
    </StudyAppShell>
  );
}
