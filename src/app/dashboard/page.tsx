import { Suspense } from 'react';
import StudyAppShell from '../../components/StudyAppShell';
import SpiritualDashboard from '../../components/SpiritualDashboard';

export default function DashboardPage() {
  return (
    <StudyAppShell>
      <section className="mx-auto max-w-4xl space-y-5">
        <Suspense
          fallback={
            <div className="flex h-72 items-center justify-center text-sm text-[color:var(--foreground)]/60">
              Chargement du tableau de bord...
            </div>
          }
        >
          <SpiritualDashboard />
        </Suspense>
      </section>
    </StudyAppShell>
  );
}
