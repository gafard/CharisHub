'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers3,
  Sun,
  Flame,
  X,
} from 'lucide-react';
import { loadLocalBible } from '../../lib/localBible';
import { getBookById } from '../../lib/bibleCatalog';
import {
  formatDayReadingsLabel,
  formatReadingLabel,
  type PlanReading,
} from '../../lib/readingPlans';
import ReflectionQuestions from './ReflectionQuestions';
import GuidedPrayerFlow from './GuidedPrayerFlow';
import { buildPrayerSteps, type PrayerFlowStep } from '../../lib/prayerFlowStore';
import {
  getDayDailyPrompts,
  getOrderedChapterReflections,
  getReflectionInsights,
  markPrayerCompleted,
} from '../../lib/readingPlanReflectionStore';

type VerseSection = {
  reading: PlanReading;
  chapters: { chapter: number; verses: { verse: number; text: string }[] }[];
};

type FocusContext = {
  reading: PlanReading;
  chapter: number;
};

interface ReflectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  readings: PlanReading[];
  planId: string;
  dayIndex: number;
  alreadyCompleted: boolean;
  activeReading?: PlanReading | null;
  activeChapter?: number | null;
  finalChapter?: boolean;
}

function getFocusContext(
  readings: PlanReading[],
  activeReading?: PlanReading | null,
  activeChapter?: number | null,
): FocusContext | null {
  if (activeReading && typeof activeChapter === 'number') {
    return {
      reading: activeReading,
      chapter: activeChapter,
    };
  }

  const lastReading = readings[readings.length - 1];
  const lastChapter = lastReading?.chapters[lastReading.chapters.length - 1];
  if (!lastReading || typeof lastChapter !== 'number') return null;

  return {
    reading: lastReading,
    chapter: lastChapter,
  };
}

export default function ReflectionSheet({
  isOpen,
  onClose,
  onComplete,
  readings,
  planId,
  dayIndex,
  alreadyCompleted,
  activeReading,
  activeChapter,
  finalChapter = false,
}: ReflectionSheetProps) {
  const [verses, setVerses] = useState<VerseSection[]>([]);
  const [versesExpanded, setVersesExpanded] = useState(false);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [showPrayerFlow, setShowPrayerFlow] = useState(false);
  const [prayerSteps, setPrayerSteps] = useState<PrayerFlowStep[]>([]);
  const [syncTick, setSyncTick] = useState(0);

  const focus = useMemo(
    () => getFocusContext(readings, activeReading, activeChapter),
    [activeChapter, activeReading, readings],
  );
  const readingSummary = readings.length ? formatDayReadingsLabel(readings) : 'Lecture du jour';
  const chapterReflections = useMemo(
    () => getOrderedChapterReflections(planId, dayIndex, readings),
    [dayIndex, planId, readings, syncTick],
  );
  const priorReflections = focus
    ? chapterReflections.filter((entry) => !(entry.readingId === focus.reading.id && entry.chapter === focus.chapter))
    : chapterReflections;
  const reflectionInsights = useMemo(
    () => getReflectionInsights(planId, dayIndex),
    [dayIndex, planId, syncTick],
  );

  useEffect(() => {
    if (!isOpen) {
      setVerses([]);
      setVersesExpanded(false);
      return;
    }

    if (!finalChapter && !versesExpanded) return;
    if (verses.length > 0) return;

    setLoadingVerses(true);
    (async () => {
      try {
        const bible = await loadLocalBible('LSG');
        const sections = readings.map((reading) => {
          const catalogBook = getBookById(reading.bookId);
          const searchName = catalogBook?.name?.toLowerCase() || reading.bookName.toLowerCase();
          const book = bible.books.find((entry) => {
            const bookName = entry.name.toLowerCase();
            return (
              bookName === searchName
              || bookName === reading.bookName.toLowerCase()
              || bookName.startsWith(searchName.substring(0, 4))
            );
          });

          return {
            reading,
            chapters: reading.chapters.map((chapterNumber) => {
              const chapter = book?.chapters.find((entry) => entry.chapter === chapterNumber);
              return { chapter: chapterNumber, verses: chapter?.verses || [] };
            }),
          };
        });

        setVerses(sections);
      } catch (error) {
        console.error('Failed to load verses', error);
      } finally {
        setLoadingVerses(false);
      }
    })();
  }, [finalChapter, isOpen, readings, verses.length, versesExpanded]);

  const [loadingPrayer, setLoadingPrayer] = useState(false);

  const handleStartPrayer = useCallback(async () => {
    const dailyPrompts = getDayDailyPrompts(planId, dayIndex);
    const passageText = verses
      .flatMap((section) => section.chapters.flatMap((chapter) => chapter.verses.map((verse) => verse.text)))
      .join(' ');
    const insights = getReflectionInsights(planId, dayIndex);

    // Try AI-reformulation if possible
    let aiPrompts: Record<string, string> | null = null;
    const canCallAI = insights.length > 0 || passageText.trim().length > 0;

    if (canCallAI) {
      setLoadingPrayer(true);
      try {
        const res = await fetch('/api/bible/prayer-prompts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chapterLabel: readingSummary,
            reflectionInsights: insights,
            passageText: passageText || undefined,
            passageThemes: undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.adoration && data.repentance && data.gratitude && data.intercession && data.engagement) {
            aiPrompts = data;
          }
        }
      } catch (error) {
        console.error('AI Prayer failed, falling back to static', error);
      } finally {
        setLoadingPrayer(false);
      }
    }

    const steps = buildPrayerSteps(
      readings,
      dailyPrompts,
      passageText || undefined,
      insights,
      aiPrompts ?? undefined,
    );
    setPrayerSteps(steps);
    setShowPrayerFlow(true);
  }, [dayIndex, planId, readingSummary, readings, verses]);

  const handlePrayerComplete = useCallback(() => {
    markPrayerCompleted(planId, dayIndex);
    setShowPrayerFlow(false);
    onComplete();
    onClose();
  }, [dayIndex, onClose, onComplete, planId]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[20000] flex items-end justify-center px-0 sm:items-center sm:px-4">
        <div className="absolute inset-0 bg-black/72 backdrop-blur-xl" onClick={onClose} />

        <div className={`relative flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[34px] border border-white/10 bg-[linear-gradient(180deg,#1c1c1f_0%,#151518_52%,#0e0f11_100%)] text-white shadow-[0_40px_140px_rgba(0,0,0,0.55)] sm:h-auto sm:max-h-[88vh] sm:max-w-5xl sm:rounded-[36px] ${showPrayerFlow ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,194,123,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(78,180,255,0.12),transparent_18%)]" />

          <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/8 px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(255,240,222,0.7)]">
                <Sun size={13} className="text-amber-400" />
                {finalChapter ? 'Miroir de Grâce' : 'Cœur à Cœur'}
              </div>
              <h2 className="mt-4 font-display text-[28px] font-bold leading-[0.95] text-[#fff7ec] sm:text-[36px]">
                {focus ? `${focus.reading.bookName} ${focus.chapter}` : 'Méditation'}
              </h2>
              <p className="mt-2 max-w-[56ch] text-[13px] leading-relaxed text-[rgba(255,240,222,0.66)] sm:text-[14px]">
                {finalChapter
                  ? 'Félicitations pour votre lecture. Prenez maintenant un temps sacré pour sceller cette Parole par la prière et la méditation.'
                  : 'Que dit Dieu à votre cœur à travers ce chapitre ? Prenez un court instant de pause pour méditer.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-[rgba(255,240,222,0.78)] transition hover:bg-white/[0.08]"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-7 sm:pb-7">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="space-y-5">
                <section className="overflow-hidden rounded-[28px] border border-[rgba(246,225,192,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
                  <button
                    type="button"
                    onClick={() => setVersesExpanded((value) => !value)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#fff7eb]">
                        <BookOpen size={16} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#fff7ec]">Revoir les passages</p>
                        <p className="mt-1 text-[12px] text-[rgba(255,240,222,0.62)]">{readingSummary}</p>
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.05] p-1.5 text-[rgba(255,240,222,0.62)]">
                      {versesExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </button>

                  {versesExpanded ? (
                    <div className="border-t border-white/8 px-4 pb-5 pt-4 sm:px-5">
                      {loadingVerses ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-[rgba(255,240,222,0.82)]" />
                        </div>
                      ) : verses.length === 0 ? (
                        <p className="py-4 text-[13px] text-[rgba(255,240,222,0.56)]">Passage non disponible hors-ligne.</p>
                      ) : (
                        <div className="space-y-5">
                          {verses.map((section) => (
                            <div
                              key={section.reading.id}
                              className="rounded-[22px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4"
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(255,240,222,0.58)]">
                                {formatReadingLabel(section.reading)}
                              </div>
                              {section.chapters.map((chapterData) => (
                                <div key={`${section.reading.id}-${chapterData.chapter}`} className="mt-4 first:mt-3">
                                  {section.reading.chapters.length > 1 ? (
                                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(255,240,222,0.48)]">
                                      Chapitre {chapterData.chapter}
                                    </div>
                                  ) : null}
                                  <div className="text-[14px] leading-8 text-[rgba(255,247,236,0.84)]">
                                    {chapterData.verses.map((verse) => (
                                      <span key={`${section.reading.id}-${chapterData.chapter}-${verse.verse}`}>
                                        <sup className="mr-1 text-[10px] font-bold text-[rgba(240,194,123,0.78)]">{verse.verse}</sup>
                                        {verse.text}{' '}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </section>

                {finalChapter && priorReflections.length > 0 ? (
                  <section className="rounded-[28px] border border-[rgba(246,225,192,0.12)] bg-[linear-gradient(180deg,#1e1c22_0%,#16151c_100%)] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#fff7eb]">
                        <Layers3 size={16} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#fff7ec]">Échos des chapitres précédents</p>
                        <p className="mt-1 text-[12px] text-[rgba(255,240,222,0.62)]">
                          {priorReflections.length} chapitre{priorReflections.length > 1 ? 's' : ''} déjà médité{priorReflections.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {priorReflections.map((entry) => {
                        const excerpt = Object.values(entry.answers).map((value) => value.trim()).find(Boolean);

                        return (
                          <div
                            key={`${entry.readingId}-${entry.chapter}`}
                            className="rounded-[20px] border border-white/8 bg-[rgba(255,255,255,0.04)] p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[13px] font-semibold text-[#fff7ec]">
                                {entry.bookName} {entry.chapter}
                              </p>
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/18 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                                <CheckCircle2 size={12} />
                                Sauvegardé
                              </span>
                            </div>
                            <p className="mt-2 text-[13px] leading-relaxed text-[rgba(255,240,222,0.68)]">
                              {excerpt || 'Réflexion enregistrée pour ce chapitre.'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="space-y-5">
                <ReflectionQuestions
                  key={`${planId}-${dayIndex}-${focus?.reading.id ?? 'none'}-${focus?.chapter ?? 'none'}-${finalChapter ? 'final' : 'chapter'}`}
                  planId={planId}
                  dayIndex={dayIndex}
                  readings={readings}
                  activeReading={focus?.reading}
                  activeChapter={focus?.chapter}
                  finalChapter={finalChapter}
                  onStateChange={() => setSyncTick((value) => value + 1)}
                />

                <section className="overflow-hidden rounded-[30px] border border-[rgba(246,225,192,0.12)] bg-[linear-gradient(180deg,#1f1a1a_0%,#151419_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-amber-400">
                      <Flame size={18} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-[#fff7ec]">
                        {finalChapter ? 'Passer à la prière' : 'Continuer votre journée'}
                      </p>
                      <p className="mt-1 text-[12px] text-[rgba(255,240,222,0.62)]">
                        {finalChapter
                          ? `Vos ${reflectionInsights.length || 1} écho${reflectionInsights.length > 1 ? 's' : ''} spirituel${reflectionInsights.length > 1 ? 's' : ''} serviront de base à la prière guidée.`
                          : 'Votre réflexion est gardée. Vous pourrez revenir au plan ou continuer votre lecture.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        onComplete();
                        onClose();
                      }}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,240,222,0.76)] transition-colors hover:bg-white/[0.08]"
                    >
                      {finalChapter ? 'Plus tard' : 'Fermer'}
                    </button>

                    <button
                      type="button"
                      disabled={loadingPrayer}
                      onClick={finalChapter ? handleStartPrayer : () => {
                        onComplete();
                        onClose();
                      }}
                      className={`inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-[#fff7ef] px-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#160d0a] shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition-all hover:scale-[1.01] active:scale-[0.985] disabled:opacity-60 disabled:pointer-events-none`}
                    >
                      {loadingPrayer ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#160d0a]/30 border-t-[#160d0a]" />
                          Éclairage en cours...
                        </>
                      ) : (
                        <>
                          {finalChapter ? 'Ouvrir la prière' : 'Continuer la lecture'}
                          <ArrowRight size={16} strokeWidth={2.4} />
                        </>
                      )}
                    </button>
                  </div>

                  {finalChapter && alreadyCompleted ? (
                    <p className="mt-4 text-[12px] leading-relaxed text-[rgba(255,240,222,0.54)]">
                      La lecture du jour est validée. Vous pouvez prier maintenant ou revenir plus tard depuis la page du plan.
                    </p>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GuidedPrayerFlow
        key={`${showPrayerFlow ? 'open' : 'closed'}-${planId}-${dayIndex}`}
        isOpen={showPrayerFlow}
        steps={prayerSteps}
        planId={planId}
        dayIndex={dayIndex}
        readings={readings}
        onComplete={handlePrayerComplete}
        onClose={() => setShowPrayerFlow(false)}
      />
    </>
  );
}
