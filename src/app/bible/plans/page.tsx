import StudyAppShell from '../../../components/StudyAppShell';
import ReadingPlansIndexClient from '../../../components/bible/ReadingPlansIndexClient';

export default function ReadingPlansCatalog() {
  return (
    <StudyAppShell>
      <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
        <ReadingPlansIndexClient />
      </div>
    </StudyAppShell>
  );
}
