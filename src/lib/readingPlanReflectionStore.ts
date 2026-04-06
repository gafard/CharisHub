import type { PlanReading } from './readingPlans';

const STORE_KEY = 'formation_biblique_reading_plan_reflections_v2';

export type ChapterReflectionAnswers = Record<string, string>;

export type ChapterReflectionEntry = {
  readingId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  answers: ChapterReflectionAnswers;
  updatedAt: string;
};

export type DayReflectionState = {
  chapterReflections: Record<string, ChapterReflectionEntry>;
  dailyPrompts: Record<string, string>;
  prayerCompletedAt: string | null;
};

type ReflectionStore = Record<string, DayReflectionState>;

function getDayKey(planId: string, dayIndex: number): string {
  return `${planId}:${dayIndex}`;
}

export function getChapterReflectionKey(readingId: string, chapter: number): string {
  return `${readingId}:${chapter}`;
}

function emptyDayState(): DayReflectionState {
  return {
    chapterReflections: {},
    dailyPrompts: {},
    prayerCompletedAt: null,
  };
}

function loadStore(): ReflectionStore {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ReflectionStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(data: ReflectionStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

export function getDayReflectionState(planId: string, dayIndex: number): DayReflectionState {
  const store = loadStore();
  return store[getDayKey(planId, dayIndex)] ?? emptyDayState();
}

export function getChapterReflection(
  planId: string,
  dayIndex: number,
  readingId: string,
  chapter: number,
): ChapterReflectionEntry | null {
  const state = getDayReflectionState(planId, dayIndex);
  return state.chapterReflections[getChapterReflectionKey(readingId, chapter)] ?? null;
}

export function saveChapterReflection(
  planId: string,
  dayIndex: number,
  reading: Pick<PlanReading, 'id' | 'bookId' | 'bookName'>,
  chapter: number,
  answers: ChapterReflectionAnswers,
) {
  const store = loadStore();
  const dayKey = getDayKey(planId, dayIndex);
  const previous = store[dayKey] ?? emptyDayState();
  const chapterKey = getChapterReflectionKey(reading.id, chapter);

  store[dayKey] = {
    ...previous,
    chapterReflections: {
      ...previous.chapterReflections,
      [chapterKey]: {
        readingId: reading.id,
        bookId: reading.bookId,
        bookName: reading.bookName,
        chapter,
        answers,
        updatedAt: new Date().toISOString(),
      },
    },
  };

  saveStore(store);
}

export function saveDayDailyPrompts(
  planId: string,
  dayIndex: number,
  prompts: Record<string, string>,
) {
  const store = loadStore();
  const dayKey = getDayKey(planId, dayIndex);
  const previous = store[dayKey] ?? emptyDayState();

  store[dayKey] = {
    ...previous,
    dailyPrompts: prompts,
  };

  saveStore(store);
}

export function getDayDailyPrompts(planId: string, dayIndex: number): Record<string, string> {
  return getDayReflectionState(planId, dayIndex).dailyPrompts;
}

export function hasChapterReflection(
  planId: string,
  dayIndex: number,
  readingId: string,
  chapter: number,
): boolean {
  const entry = getChapterReflection(planId, dayIndex, readingId, chapter);
  if (!entry) return false;
  return Object.values(entry.answers).some((value) => value.trim().length > 0);
}

export function getReflectionInsights(planId: string, dayIndex: number): string[] {
  const state = getDayReflectionState(planId, dayIndex);
  return Object.values(state.chapterReflections)
    .sort((a, b) => a.chapter - b.chapter)
    .flatMap((entry) =>
      Object.values(entry.answers)
        .map((value) => value.trim())
        .filter(Boolean),
    );
}

export function getOrderedChapterReflections(
  planId: string,
  dayIndex: number,
  readings: PlanReading[],
): ChapterReflectionEntry[] {
  const state = getDayReflectionState(planId, dayIndex);
  const order = new Map<string, number>();
  let index = 0;

  for (const reading of readings) {
    for (const chapter of reading.chapters) {
      order.set(getChapterReflectionKey(reading.id, chapter), index);
      index += 1;
    }
  }

  return Object.entries(state.chapterReflections)
    .sort((a, b) => (order.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (order.get(b[0]) ?? Number.MAX_SAFE_INTEGER))
    .map(([, entry]) => entry);
}

export function isPrayerCompleted(planId: string, dayIndex: number): boolean {
  return Boolean(getDayReflectionState(planId, dayIndex).prayerCompletedAt);
}

export function markPrayerCompleted(planId: string, dayIndex: number) {
  const store = loadStore();
  const dayKey = getDayKey(planId, dayIndex);
  const previous = store[dayKey] ?? emptyDayState();

  store[dayKey] = {
    ...previous,
    prayerCompletedAt: new Date().toISOString(),
  };

  saveStore(store);
}
