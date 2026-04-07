'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircleQuestion,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { formatDayReadingsLabel, type PlanReading } from '../../lib/readingPlans';
import { getReadingPlan } from '../../lib/readingPlans';
import {
  getChapterReflection,
  getDayDailyPrompts,
  saveChapterReflection,
  saveDayDailyPrompts,
} from '../../lib/readingPlanReflectionStore';
import { BIBLE_BOOKS } from '../../lib/bibleCatalog';

const DAILY_PROMPTS = [
  { id: 'p1', text: 'Quel verset ou quelle idee revient le plus dans ma journee ?' },
  { id: 'p2', text: 'Qu\'est-ce que Dieu me demande d\'ajuster ou d\'abandonner ?' },
  { id: 'p3', text: 'Pour quoi puis-je remercier Dieu apres cette lecture ?' },
  { id: 'p4', text: 'Quelle demande ou quelle personne vais-je porter dans la priere ?' },
  { id: 'p5', text: 'Quel pas concret vais-je poser avant la fin de la journee ?' },
];

type FocusContext = {
  reading: PlanReading;
  chapter: number;
};

type AiQuestions = { q1: string; q2: string; q3: string; q4: string };

const DEFAULT_AI_QUESTIONS: AiQuestions = {
  q1: 'Que revele ce chapitre sur Dieu ou sur Jesus ?',
  q2: 'Qu\'est-ce qui me frappe, me derange ou m\'eclaire ici ?',
  q3: 'Y a-t-il un appel concret pour ma vie aujourd\'hui ?',
  q4: 'Quelle verite dois-je retenir ou mediter davantage ?',
};

interface ReflectionQuestionsProps {
  planId: string;
  dayIndex: number;
  readings: PlanReading[];
  activeReading?: PlanReading | null;
  activeChapter?: number | null;
  finalChapter?: boolean;
  passageText?: string;
  onStateChange?: () => void;
}

function getFocusContext(
  readings: PlanReading[],
  activeReading?: PlanReading | null,
  activeChapter?: number | null,
): FocusContext | null {
  if (activeReading && typeof activeChapter === 'number') {
    return { reading: activeReading, chapter: activeChapter };
  }
  const fallbackReading = readings[readings.length - 1];
  const fallbackChapter = fallbackReading?.chapters[fallbackReading.chapters.length - 1];
  if (!fallbackReading || typeof fallbackChapter !== 'number') return null;
  return { reading: fallbackReading, chapter: fallbackChapter };
}

function getBookDisplayName(bookId: string): string {
  const book = BIBLE_BOOKS.find(b => b.id === bookId || b.apiId === bookId);
  return book?.name || bookId;
}

export default function ReflectionQuestions({
  planId,
  dayIndex,
  readings,
  activeReading,
  activeChapter,
  finalChapter = false,
  passageText,
  onStateChange,
}: ReflectionQuestionsProps) {
  const focus = useMemo(
    () => getFocusContext(readings, activeReading, activeChapter),
    [activeChapter, activeReading, readings],
  );
  const readingLabel = readings.length ? formatDayReadingsLabel(readings) : 'Lecture du jour';
  const focusLabel = focus ? `${focus.reading.bookName} ${focus.chapter}` : 'Chapitre du jour';

  // AI questions state
  const [aiQuestions, setAiQuestions] = useState<AiQuestions>(DEFAULT_AI_QUESTIONS);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchAiQuestions = useCallback(async () => {
    if (!focus) return;
    setAiLoading(true);
    try {
      const plan = getReadingPlan(planId);
      const bookName = getBookDisplayName(focus.reading.bookId);
      const res = await fetch('/api/bible/reflection-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookName,
          chapter: focus.chapter,
          passageText: passageText?.slice(0, 4000),
          planCategory: plan?.category,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiQuestions(data);
      }
    } catch (err) {
      console.warn('[ReflectionQuestions] AI fetch failed, using defaults:', err);
    } finally {
      setAiLoading(false);
    }
  }, [focus, passageText, planId]);

  // Fetch AI questions on mount or when chapter changes
  useEffect(() => {
    void fetchAiQuestions();
  }, [fetchAiQuestions]);

  const questions = useMemo(() => [
    { id: 'q1' as const, text: aiQuestions.q1 },
    { id: 'q2' as const, text: aiQuestions.q2 },
    { id: 'q3' as const, text: aiQuestions.q3 },
    { id: 'q4' as const, text: aiQuestions.q4 },
  ], [aiQuestions]);

  const initialAnswers = focus
    ? getChapterReflection(planId, dayIndex, focus.reading.id, focus.chapter)?.answers ?? {}
    : {};
  const initialDailyAnswers = getDayDailyPrompts(planId, dayIndex);

  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [dailyAnswers, setDailyAnswers] = useState<Record<string, string>>(initialDailyAnswers);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(
    questions.find((q) => !(initialAnswers[q.id] ?? '').trim())?.id ?? questions[0]?.id ?? null,
  );
  const [showDailyPrompts, setShowDailyPrompts] = useState(finalChapter);

  // Update expanded question when questions change
  useEffect(() => {
    if (!expandedQuestion || !questions.find(q => q.id === expandedQuestion)) {
      const firstUnanswered = questions.find((q) => !(answers[q.id] ?? '').trim());
      setExpandedQuestion(firstUnanswered?.id ?? questions[0]?.id ?? null);
    }
  }, [aiQuestions, questions, answers, expandedQuestion]);

  const saveChapterAnswer = (nextAnswers: Record<string, string>) => {
    setAnswers(nextAnswers);
    if (!focus) return;
    saveChapterReflection(planId, dayIndex, focus.reading, focus.chapter, nextAnswers);
    onStateChange?.();
  };

  const savePromptAnswer = (nextDailyAnswers: Record<string, string>) => {
    setDailyAnswers(nextDailyAnswers);
    saveDayDailyPrompts(planId, dayIndex, nextDailyAnswers);
    onStateChange?.();
  };

  const answeredCount = questions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length;
  const chapterComplete = answeredCount > 0;
  const promptCount = DAILY_PROMPTS.filter((p) => (dailyAnswers[p.id] ?? '').trim().length > 0).length;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="overflow-hidden rounded-[28px] border border-[rgba(246,225,192,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(255,240,222,0.7)]">
              <Sparkles size={13} />
              {finalChapter ? 'Réflexion finale du jour' : 'Réflexion du chapitre'}
              {aiLoading && <Loader2 size={12} className="animate-spin ml-1" />}
            </div>
            <h3 className="mt-3 font-display text-[24px] font-bold leading-[0.98] text-[#fff7ec] sm:text-[28px]">
              {focusLabel}
            </h3>
            <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[rgba(255,240,222,0.66)]">
              {finalChapter
                ? `${readingLabel}. Terminez votre relecture intérieure avant d'entrer dans la prière.`
                : 'Prenez une minute pour fixer ce que Dieu a mis en lumière dans ce chapitre.'}
            </p>
          </div>

          <div className="grid shrink-0 gap-2 text-right">
            <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,240,222,0.76)]">
              {answeredCount}/{questions.length} réponses
            </span>
            {finalChapter ? (
              <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,240,222,0.76)]">
                {promptCount}/{DAILY_PROMPTS.length} prompts
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* AI-generated questions */}
      <div className="grid gap-3">
        {questions.map((question, index) => {
          const isExpanded = expandedQuestion === question.id;
          const hasAnswer = (answers[question.id] ?? '').trim().length > 0;

          return (
            <div
              key={question.id}
              className="overflow-hidden rounded-[24px] border border-[rgba(246,225,192,0.12)] bg-[linear-gradient(180deg,#15110d_0%,#0f0b08_100%)] text-white shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
            >
              <button
                type="button"
                onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
                className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold ${
                    hasAnswer
                      ? 'border-emerald-300/30 bg-emerald-400/14 text-emerald-200'
                      : aiLoading
                        ? 'border-amber-300/30 bg-amber-400/14 text-amber-200'
                        : 'border-white/12 bg-white/[0.05] text-[rgba(255,240,222,0.68)]'
                  }`}
                >
                  {hasAnswer ? <CheckCircle2 size={16} /> : aiLoading ? <Loader2 size={14} className="animate-spin" /> : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-snug text-[#fff8ef]">
                    {question.text}
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] p-1.5 text-[rgba(255,240,222,0.62)]">
                  {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </button>

              {isExpanded ? (
                <div className="border-t border-white/8 px-4 pb-4 pt-3 sm:px-5">
                  <div className="relative overflow-hidden rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.04)]">
                    <PenLine size={15} className="pointer-events-none absolute left-4 top-4 text-[rgba(255,240,222,0.32)]" />
                    <textarea
                      value={answers[question.id] ?? ''}
                      onChange={(event) => {
                        saveChapterAnswer({
                          ...answers,
                          [question.id]: event.target.value,
                        });
                      }}
                      placeholder="Écrivez votre réflexion..."
                      className="min-h-[118px] w-full resize-none bg-transparent py-4 pl-11 pr-4 text-[14px] leading-relaxed text-[#fff7ec] outline-none placeholder:text-[rgba(255,240,222,0.3)]"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      {!finalChapter ? (
        <div className="rounded-[24px] border border-[rgba(246,225,192,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 text-[13px] leading-relaxed text-[rgba(255,240,222,0.68)]">
          <div className="flex items-center gap-2 text-[#fff6e6]">
            <BookMarked size={15} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
              Chapitre sauvegardé
            </span>
          </div>
          <p className="mt-2">
            {chapterComplete
              ? 'Votre réflexion est conservée. Vous pourrez la retrouver dans la synthèse du dernier chapitre du jour.'
              : 'Vous pouvez laisser une seule phrase. L'app gardera cette trace pour la synthèse finale du jour.'}
          </p>
        </div>
      ) : (
        /* Daily prompts for final chapter */
        <div className="overflow-hidden rounded-[26px] border border-[rgba(246,225,192,0.12)] bg-[linear-gradient(180deg,#130d10_0%,#0a0a0d_100%)] text-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <button
            type="button"
            onClick={() => setShowDailyPrompts((value) => !value)}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] text-[#fff6e6]">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#fff8ef]">Synthèse et élans de prière</p>
              <p className="mt-1 text-[12px] text-[rgba(255,240,222,0.62)]">
                Dernier chapitre du jour: préparez la prière finale.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] p-1.5 text-[rgba(255,240,222,0.62)]">
              {showDailyPrompts ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </div>
          </button>

          {showDailyPrompts ? (
            <div className="grid gap-3 border-t border-white/8 px-4 pb-4 pt-3 sm:px-5">
              {DAILY_PROMPTS.map((prompt) => (
                <div
                  key={prompt.id}
                  className="overflow-hidden rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.04)]"
                >
                  <div className="px-4 pt-4 text-[13px] font-semibold leading-snug text-[#fff8ef]">
                    {prompt.text}
                  </div>
                  <textarea
                    value={dailyAnswers[prompt.id] ?? ''}
                    onChange={(event) => {
                      savePromptAnswer({
                        ...dailyAnswers,
                        [prompt.id]: event.target.value,
                      });
                    }}
                    placeholder="Votre note..."
                    className="min-h-[96px] w-full resize-none bg-transparent px-4 pb-4 pt-3 text-[14px] leading-relaxed text-[#fff7ec] outline-none placeholder:text-[rgba(255,240,222,0.3)]"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

