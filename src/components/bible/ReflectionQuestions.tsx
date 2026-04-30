'use client';

import logger from '@/lib/logger';
import { Haptics } from '@/lib/haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  PenLine,
  ScrollText,
} from 'lucide-react';
import { formatDayReadingsLabel, type PlanReading, findReadingPlan } from '../../lib/readingPlans';
import {
  getChapterReflection,
  getDayDailyPrompts,
  saveChapterReflection,
  saveDayDailyPrompts,
  getStandaloneReflection,
  saveStandaloneReflection,
} from '../../lib/readingPlanReflectionStore';
import { BIBLE_BOOKS } from '../../lib/bibleCatalog';

const DAILY_PROMPTS = [
  { id: 'p1', text: 'Quel verset ou quelle idée revient le plus dans ma journée ?' },
  { id: 'p2', text: "Qu'est-ce que Dieu me demande d'ajuster ou d'abandonner ?" },
  { id: 'p3', text: 'Pour quoi puis-je remercier Dieu après cette lecture ?' },
  { id: 'p4', text: 'Quelle demande ou quelle personne vais-je porter dans la prière ?' },
  { id: 'p5', text: 'Quel pas concret vais-je poser avant la fin de la journée ?' },
] as const;

type FocusContext = {
  reading: PlanReading;
  chapter: number;
};

type AiQuestions = {
  q1: string;
  q1_suggestions: string[];
  q2: string;
  q2_suggestions: string[];
  q3: string;
  q3_suggestions: string[];
  q4: string;
  q4_suggestions: string[];
};

const DEFAULT_AI_QUESTIONS: AiQuestions = {
  q1: 'Que révèle ce chapitre sur Dieu ou sur Jésus ?',
  q1_suggestions: [],
  q2: "Qu'est-ce qui me frappe, me dérange ou m'éclaire ici ?",
  q2_suggestions: [],
  q3: "Y a-t-il un appel concret pour ma vie aujourd'hui ?",
  q3_suggestions: [],
  q4: 'Quelle vérité dois-je retenir ou méditer davantage ?',
  q4_suggestions: [],
};

interface ReflectionQuestionsProps {
  planId?: string;
  dayIndex?: number;
  readings?: PlanReading[];
  activeReading?: PlanReading | null;
  activeChapter?: number | null;
  finalChapter?: boolean;
  passageText?: string;
  preloadedQuestions?: AiQuestions;
  onStateChange?: () => void;
}

function getFocusContext(
  readings: PlanReading[] | undefined,
  activeReading?: PlanReading | null,
  activeChapter?: number | null,
): FocusContext | null {
  if (activeReading && typeof activeChapter === 'number') {
    return { reading: activeReading, chapter: activeChapter };
  }

  if (!readings || readings.length === 0) return null;

  const fallbackReading = readings[readings.length - 1];
  const fallbackChapter = fallbackReading?.chapters[fallbackReading.chapters.length - 1];

  if (!fallbackReading || typeof fallbackChapter !== 'number') return null;

  return { reading: fallbackReading, chapter: fallbackChapter };
}

function getBookDisplayName(bookId: string): string {
  const book = BIBLE_BOOKS.find((b) => b.id === bookId);
  return book?.name || bookId;
}

function ReflectionQuestionCard({
  index,
  id,
  text,
  value,
  suggestions = [],
  expanded,
  loading,
  onToggle,
  onChange,
}: {
  index: number;
  id: string;
  text: string;
  value: string;
  suggestions?: string[];
  expanded: boolean;
  loading: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  const hasAnswer = value.trim().length > 0;

  return (
    <div
      className={`overflow-hidden rounded-[24px] border shadow-[0_18px_52px_rgba(0,0,0,0.18)] transition-all ${
        expanded
          ? 'border-amber-300/18 bg-[linear-gradient(180deg,#17120d_0%,#100c09_100%)]'
          : 'border-[rgba(246,225,192,0.10)] bg-[linear-gradient(180deg,#15110d_0%,#0f0b08_100%)]'
      } text-white`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold ${
            hasAnswer
              ? 'border-emerald-300/30 bg-emerald-400/14 text-emerald-200'
              : loading
                ? 'border-amber-300/30 bg-amber-400/14 text-amber-200'
                : 'border-white/12 bg-white/[0.05] text-[rgba(255,240,222,0.68)]'
          }`}
        >
          {hasAnswer ? (
            <CheckCircle2 size={16} />
          ) : loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            index + 1
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug text-[#fff8ef]">
            {text}
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.05] p-1.5 text-[rgba(255,240,222,0.62)]">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-white/8 px-4 pb-4 pt-3 sm:px-5">
          {suggestions.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion, i) => (
                <button
                  key={`${id}-sug-${i}`}
                  type="button"
                  onClick={() => {
                    Haptics.light();
                    const nextVal = value.trim() ? `${value.trim()} ${suggestion}` : suggestion;
                    onChange(nextVal);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-left text-[12px] leading-tight text-amber-200/90 transition-all hover:border-amber-400/30 hover:bg-amber-400/10 active:scale-95"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="relative overflow-hidden rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.04)]">
            <PenLine
              size={15}
              className="pointer-events-none absolute left-4 top-4 text-[rgba(255,240,222,0.32)]"
            />
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Écrivez votre réflexion..."
              className="min-h-[124px] w-full resize-none bg-transparent py-4 pl-11 pr-4 text-[14px] leading-relaxed text-[#fff7ec] outline-none placeholder:text-[rgba(255,240,222,0.3)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ReflectionQuestions({
  planId,
  dayIndex,
  readings,
  activeReading,
  activeChapter,
  finalChapter = false,
  passageText,
  preloadedQuestions,
  onStateChange,
}: ReflectionQuestionsProps) {
  const focus = useMemo(
    () => getFocusContext(readings, activeReading, activeChapter),
    [activeChapter, activeReading, readings],
  );

  const readingLabel = useMemo(
    () => (readings?.length ? formatDayReadingsLabel(readings) : 'Lecture du jour'),
    [readings],
  );

  const focusLabel = useMemo(
    () => (focus ? `${focus.reading.bookName} ${focus.chapter}` : 'Chapitre du jour'),
    [focus],
  );

  const focusStorageKey = useMemo(() => {
    if (!focus) return null;
    if (planId && dayIndex !== undefined) {
       return `${planId}:${dayIndex}:${focus.reading.id}:${focus.chapter}`;
    }
    return `standalone:${focus.reading.bookId}:${focus.chapter}`;
  }, [focus, planId, dayIndex]);

  const [showDailyPrompts, setShowDailyPrompts] = useState(finalChapter);

  // Initialize with preloaded questions if available
  const [aiQuestions, setAiQuestions] = useState<AiQuestions>(() => {
    if (preloadedQuestions) {
      logger.info('[ReflectionQuestions] Using preloaded questions');
      return preloadedQuestions;
    }
    return DEFAULT_AI_QUESTIONS;
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dailyAnswers, setDailyAnswers] = useState<Record<string, string>>({});
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const aiRequestRef = useRef(0);

  const questions = useMemo(
    () => [
      { id: 'q1' as const, text: aiQuestions.q1, suggestions: aiQuestions.q1_suggestions },
      { id: 'q2' as const, text: aiQuestions.q2, suggestions: aiQuestions.q2_suggestions },
      { id: 'q3' as const, text: aiQuestions.q3, suggestions: aiQuestions.q3_suggestions },
      { id: 'q4' as const, text: aiQuestions.q4, suggestions: aiQuestions.q4_suggestions },
    ],
    [aiQuestions],
  );

  const storedAnswers = useMemo(() => {
    if (!focus) return {};
    if (planId && dayIndex !== undefined) {
      return getChapterReflection(planId, dayIndex, focus.reading.id, focus.chapter)?.answers ?? {};
    }
    return getStandaloneReflection(focus.reading.bookId, focus.chapter)?.answers ?? {};
  }, [focus, planId, dayIndex]);

  const storedDailyAnswers = useMemo(() => {
    if (planId && dayIndex !== undefined) {
      return getDayDailyPrompts(planId, dayIndex);
    }
    return {}; // Pas de prompts quotidiens en mode standalone pour le moment
  }, [planId, dayIndex]);

  useEffect(() => {
    setAnswers(storedAnswers);
  }, [focusStorageKey, storedAnswers]);

  useEffect(() => {
    setDailyAnswers(storedDailyAnswers);
  }, [planId, dayIndex, storedDailyAnswers]);

  useEffect(() => {
    setShowDailyPrompts(finalChapter);
  }, [finalChapter]);

  useEffect(() => {
    const firstUnanswered = questions.find((q) => !(storedAnswers[q.id] ?? '').trim());
    setExpandedQuestion(firstUnanswered?.id ?? questions[0]?.id ?? null);
  }, [focusStorageKey, questions, storedAnswers]);

  const fetchAiQuestions = useCallback(async () => {
    if (!focus) return;

    const requestId = ++aiRequestRef.current;
    setAiLoading(true);

    try {
      let planCategory;
      if (planId) {
         const plan = findReadingPlan(planId);
         planCategory = plan?.category;
      }
      const bookName = getBookDisplayName(focus.reading.bookId);

      const res = await fetch('/api/bible/reflection-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookName,
          chapter: focus.chapter,
          passageText: passageText?.slice(0, 4000),
          planCategory,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as Partial<AiQuestions>;
      if (requestId !== aiRequestRef.current) return;

      console.log('[ReflectionQuestions] Received AI data:', data);

      setAiQuestions({
        q1: data.q1 || DEFAULT_AI_QUESTIONS.q1,
        q1_suggestions: data.q1_suggestions || [],
        q2: data.q2 || DEFAULT_AI_QUESTIONS.q2,
        q2_suggestions: data.q2_suggestions || [],
        q3: data.q3 || DEFAULT_AI_QUESTIONS.q3,
        q3_suggestions: data.q3_suggestions || [],
        q4: data.q4 || DEFAULT_AI_QUESTIONS.q4,
        q4_suggestions: data.q4_suggestions || [],
      });
    } catch (err) {
      logger.warn('[ReflectionQuestions] AI fetch failed, using defaults:', err);
      if (requestId === aiRequestRef.current) {
        setAiQuestions(DEFAULT_AI_QUESTIONS);
      }
    } finally {
      if (requestId === aiRequestRef.current) {
        setAiLoading(false);
      }
    }
  }, [focus, passageText, planId]);

  useEffect(() => {
    // Skip fetch if we already have preloaded questions for this focus context
    if (preloadedQuestions) {
      console.log('[ReflectionQuestions] Applying preloaded questions:', preloadedQuestions);
      setAiQuestions(preloadedQuestions);
      setAiLoading(false);
      return;
    }
    void fetchAiQuestions();
  }, [fetchAiQuestions, preloadedQuestions]);

  const saveChapterAnswer = useCallback(
    (nextAnswers: Record<string, string>) => {
      setAnswers(nextAnswers);
      if (!focus) return;

      if (planId && dayIndex !== undefined) {
        saveChapterReflection(planId, dayIndex, focus.reading, focus.chapter, nextAnswers);
      } else {
        saveStandaloneReflection(focus.reading.bookId, focus.reading.bookName, focus.chapter, nextAnswers);
      }
      onStateChange?.();
    },
    [focus, planId, dayIndex, onStateChange],
  );

  const savePromptAnswer = useCallback(
    (nextDailyAnswers: Record<string, string>) => {
      setDailyAnswers(nextDailyAnswers);
      if (planId && dayIndex !== undefined) {
         saveDayDailyPrompts(planId, dayIndex, nextDailyAnswers);
         onStateChange?.();
      }
    },
    [planId, dayIndex, onStateChange],
  );

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? '').trim().length > 0).length,
    [answers, questions],
  );

  const chapterComplete = answeredCount > 0;

  const promptCount = useMemo(
    () => DAILY_PROMPTS.filter((p) => (dailyAnswers[p.id] ?? '').trim().length > 0).length,
    [dailyAnswers],
  );

  const progressPercent = useMemo(
    () => Math.round((answeredCount / questions.length) * 100),
    [answeredCount, questions.length],
  );

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[30px] border border-[rgba(246,225,192,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] text-white shadow-[0_26px_80px_rgba(0,0,0,0.22)]">
        <div className="relative p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-white/8" />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(255,240,222,0.72)]">
                <ScrollText size={13} className="text-amber-400" />
                {finalChapter ? 'Réflexion finale du jour' : 'Réflexion du chapitre'}
                {aiLoading ? (
                  <span className="ml-2 flex items-center gap-1 text-amber-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[9px] animate-pulse">Éclairage par l'Esprit...</span>
                  </span>
                ) : null}
              </div>

              <h3 className="mt-3 font-display text-[24px] font-bold leading-[0.98] text-[#fff7ec] sm:text-[30px]">
                {focusLabel}
              </h3>

              <p className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-[rgba(255,240,222,0.68)]">
                {finalChapter
                  ? `${readingLabel}. Prenez quelques instants pour recueillir ce que Dieu vous a montré aujourd’hui.`
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

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,240,222,0.56)]">
              <span>Avancement</span>
              <span>{progressPercent}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(251,191,36,0.95),rgba(255,238,186,0.9))] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {questions.map((question, index) => (
          <ReflectionQuestionCard
            key={question.id}
            index={index}
            id={question.id}
            text={question.text}
            suggestions={question.suggestions}
            value={answers[question.id] ?? ''}
            expanded={expandedQuestion === question.id}
            loading={aiLoading}
            onToggle={() =>
              setExpandedQuestion((prev) => (prev === question.id ? null : question.id))
            }
            onChange={(value) =>
              saveChapterAnswer({
                ...answers,
                [question.id]: value,
              })
            }
          />
        ))}
      </div>

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
              : "Vous pouvez laisser une seule phrase. L'app gardera cette trace pour la synthèse finale du jour."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-amber-300/14 bg-[linear-gradient(180deg,#160f11_0%,#0b090c_100%)] text-white shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
          <button
            type="button"
            onClick={() => setShowDailyPrompts((value) => !value)}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] sm:px-5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] text-[#fff6e6]">
              <ScrollText size={17} className="text-amber-400" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#fff8ef]">Synthèse et élans de prière</p>
              <p className="mt-1 text-[12px] text-[rgba(255,240,222,0.62)]">
                Dernier chapitre du jour : préparez votre réponse intérieure.
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.05] p-1.5 text-[rgba(255,240,222,0.62)]">
              {showDailyPrompts ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </div>
          </button>

          {showDailyPrompts ? (
            <div className="grid gap-3 border-t border-white/8 px-4 pb-4 pt-3 sm:px-5">
              {DAILY_PROMPTS.map((prompt, index) => (
                <div
                  key={prompt.id}
                  className="overflow-hidden rounded-[18px] border border-white/8 bg-[rgba(255,255,255,0.04)]"
                >
                  <div className="flex items-start gap-3 px-4 pt-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[11px] font-bold text-[rgba(255,240,222,0.78)]">
                      {index + 1}
                    </div>

                    <div className="pt-1 text-[13px] font-semibold leading-snug text-[#fff8ef]">
                      {prompt.text}
                    </div>
                  </div>

                  <textarea
                    value={dailyAnswers[prompt.id] ?? ''}
                    onChange={(event) =>
                      savePromptAnswer({
                        ...dailyAnswers,
                        [prompt.id]: event.target.value,
                      })
                    }
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
