import { Suspense } from 'react';
import BibleReader from '../../components/BibleReader';
import StudyAppShell from '../../components/StudyAppShell';

export default function BiblePage() {
  return (
    <StudyAppShell>
      <section className="space-y-4">
        <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/90 p-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--foreground)]/55">
            Parole
          </div>
          <h1 className="mt-2 text-3xl font-extrabold">Ouvre la Parole et laisse-toi façonner</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--foreground)]/68">
            Lis, médite et approfondis les Écritures. Retrouve tes outils d&apos;étude, prépare tes
            temps de partage et garde la Parole au centre, même pendant les appels de groupe.
          </p>
        </div>

        <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/90 p-4 sm:p-6">
          <Suspense
            fallback={
              <div className="flex h-72 items-center justify-center text-sm text-[color:var(--foreground)]/60">
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
