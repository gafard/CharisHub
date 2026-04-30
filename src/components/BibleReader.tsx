'use client';

import logger from '@/lib/logger';
import dynamic from 'next/dynamic';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  updateGroup,
  deleteGroup,
  updateBibleReadingChallenges,
  type CommunityGroup,
} from './communityApi';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Volume2, ChevronLeft, ChevronRight, Link2, Search, Star, X, Settings, Maximize, Play, Pause, Bookmark, ListVideo, AlignLeft, BookmarkCheck, AlertCircle, Heart, Shield, Flame, User as UserIcon,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { BIBLE_BOOKS, type BibleBook } from '../lib/bibleCatalog';
import { getSelahAudioAlignedTranslationId, hasSelahAudio } from '../lib/bibleAudio';
import { extractTreasuryRefs, type TreasuryRef } from '../lib/bibleStudyClient';
import { parseBibleTreasuryResponse } from '../lib/bibleStudyApi';
import { audioEngine, type Mood as AudioMood } from '../lib/audioEngine';
import { type StrongToken } from '../lib/strongVerse';
import { useI18n } from '../contexts/I18nContext';
import {
  confirmAudioFocus,
  failAudioFocus,
  getAudioFocusState,
  isAudioFocusOwnedBy,
  requestAudioFocus,
  releaseAudioFocus,
  subscribeAudioFocus,
} from '../lib/audioFocus';

// Import des composants légers (toujours chargés)
import BibleToolbar from './bible/BibleToolbar';
import BibleLongPressSheet from './bible/BibleLongPressSheet';
import ReadingPlanWidget from './ReadingPlanWidget';
import BibleMeditationBar from './bible/BibleMeditationBar';
import { useActiveVerse } from './bible/useActiveVerse';
import { useVerseSync } from '../hooks/useVerseSync';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { getCachedChapter, cacheChapter } from '../lib/bible/cache';
import { useLongPress } from '../hooks/useLongPress';

// Lazy loading des composants lourds (modales et panneaux secondaires)
const BibleStrongViewer = dynamic(() => import('./BibleStrongViewer'), { ssr: false });
const InterlinearViewer = dynamic(() => import('./InterlinearViewer'), { ssr: false });
const AdvancedStudyTools = dynamic(() => import('./AdvancedStudyTools'), { ssr: false });
const ReflectionSheet = dynamic(() => import('./bible/ReflectionSheet'), { ssr: false });
const ShareableVerseCard = dynamic(() => import('./ShareableVerseCard'), { ssr: false });
const BibleCompareModal = dynamic(() => import('./bible/BibleCompareModal'), { ssr: false });
const BibleStudyRadar = dynamic(() => import('./bible/BibleStudyRadar'), { ssr: false });
const MyHighlightsModal = dynamic(() => import('./bible/MyHighlightsModal'), { ssr: false });
const GraceMirrorModal = dynamic(() => import('./bible/GraceMirrorModal'), { ssr: false });
const BibleReaderSkeleton = dynamic(() => import('./bible/BibleReaderSkeleton'), { ssr: false });
const LectioDivina = dynamic(() => import('./bible/LectioDivina'), { ssr: false });
const VerseMemorizationSession = dynamic(() => import('./bible/VerseMemorizationSession'), { ssr: false });

// Import des services Strong
import strongService, { type StrongEntry } from '../services/strong-service';
import BibleVersesStrongMap from '../services/bible-verses-strong-map';
import { recordReading, getStreak } from '../lib/bibleStreak';
import { memorizationStore } from '../lib/memorizationStore';
import { getActivePlan, isReadingChapterCompleted } from '../lib/readingPlans';

import { graceService } from '../lib/graceService';
import { pepitesStore } from '../lib/pepitesStore';
import { AnimatedLetter } from './ui/PrismaAnimations';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { safeParseLooseJson } from '../lib/utils';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { checkAndAwardBadge } from '../lib/badgeService';

// Traductions de la Bible provenant du fichier centralisé
const LOCAL_BIBLE_TRANSLATIONS = [
  { id: 'LSG', label: 'Louis Segond', sourceLabel: 'Fichier local' },
  { id: 'NOUVELLE_SEGOND', label: 'Nouvelle Segond', sourceLabel: 'Fichier local' },
  { id: 'FRANCAIS_COURANT', label: 'Français courant', sourceLabel: 'Fichier local' },
  { id: 'BDS', label: 'Bible du Semeur', sourceLabel: 'Fichier local' },
  { id: 'OECUMENIQUE', label: 'Œcuménique (TOB)', sourceLabel: 'Fichier local' },
  { id: 'KJF', label: 'KJF', sourceLabel: 'Fichier local' },
  { id: 'MARTIN', label: 'Martin 1744', sourceLabel: 'Fichier local' },
  { id: 'OSTERVALD', label: 'Ostervald 1996', sourceLabel: 'Fichier local' },
  { id: 'DARBY', label: 'Darby', sourceLabel: 'Fichier local' },
  { id: 'COLOMBE', label: 'Colombe', sourceLabel: 'Fichier local' },
  { id: 'PAROLE_DE_VIE', label: 'Parole de Vie', sourceLabel: 'Fichier local' },
];

type VerseRow = {
  number: number;
  text: string;
};

type ToolMode = 'read' | 'highlight' | 'note';

// Type pour les couleurs de surlignage
type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple';
type HighlightMap = Record<number, HighlightColor>;

type ReferencePreviewState = {
  open: boolean;
  ref: TreasuryRef | null;
  rows: VerseRow[];
  status: 'idle' | 'loading' | 'error';
  error: string | null;
};

type StrongSearchResult = {
  number: string;
  entry: StrongEntry;
  language: 'hebrew' | 'greek';
};

type CompareRow = {
  id: string;
  label: string;
  sourceLabel: string;
  text: string | null;
  error?: string;
};

type VttCue = {
  start: number;
  end: number;
  verse: number | null;
  text: string;
};

type VerseTiming = {
  verse: number;
  start: number;
  end: number;
};

type AudioVerseSegment = {
  verse: number;
  start: number;
  end: number;
};

type HoldMeta = {
  pointerId: number | 'touch';
  startX: number;
  startY: number;
  verse: VerseRow;
};

type VerseTapMeta = {
  key: string;
  at: number;
};

const STORAGE_KEYS = {
  settings: 'formation_biblique_bible_settings_v1',
  notes: 'formation_biblique_bible_notes_v1',
  highlights: 'formation_biblique_bible_highlights_v1',
  verseNotes: 'formation_biblique_bible_verse_notes_v1',
};

const LONG_PRESS_DELAY_MS = 520;
const LONG_PRESS_MOVE_PX = 12;
const EMBEDDED_DOUBLE_TAP_DELAY_MS = 320;
const EMBEDDED_DOUBLE_TAP_MOVE_PX = 20;
const VERSE_DOUBLE_TAP_DELAY_MS = 240;
const MAX_STRONG_WORDS = 8;
const STRONG_STOP_WORDS = new Set([
  'a', 'au', 'aux', 'avec', 'car', 'ce', 'cela', 'ces', 'cet', 'cette',
  'comme', 'dans', 'de', 'des', 'du', 'elle', 'elles', 'en', 'entre', 'est',
  'et', 'il', 'ils', 'je', 'la', 'le', 'les', 'leur', 'leurs', 'lui', 'ma',
  'mais', 'me', 'mes', 'moi', 'mon', 'ne', 'ni', 'nos', 'notre', 'nous', 'ou',
  'par', 'pas', 'pour', 'que', 'qui', 'sa', 'se', 'ses', 'si', 'son', 'sur',
  'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'vos', 'votre', 'vous', 'y',
]);

const MIN_READER_FONT_SCALE = 0.8;
const MAX_READER_FONT_SCALE = 2.2;
const RADAR_WORD_CLEAN_RE = /[.,;:!?()«»"“”'’]/g;
const APPROX_AUDIO_INTRO_LEAD_SECONDS = 3;
const BOOK_MOODS: Partial<Record<string, AudioMood>> = {
  psa: 'meditative',
  pro: 'calm',
  rev: 'intense',
  jhn: 'calm',
  act: 'joy',
};
const BOOK_THEMES: Record<string, { accent: string; background: string }> = {
  psa: {
    accent: '#c89f2d',
    background: 'var(--background)',
  },
  pro: {
    accent: '#c89f2d',
    background: 'var(--background)',
  },
  jhn: {
    accent: '#c89f2d',
    background: 'var(--background)',
  },
  rev: {
    accent: '#c89f2d',
    background: 'var(--background)',
  },
  default: {
    accent: '#c89f2d',
    background: 'var(--background)',
  },
};

// Aura colors for dynamic book-specific backgrounds (dark mode)
const BOOK_AURA_COLORS: Record<string, string> = {
  psa: '#4F46E5', // Indigo for Psalms
  pro: '#F59E0B', // Amber for Proverbs
  ecc: '#D97706', // Deep amber for Ecclesiastes
  sng: '#EC4899', // Pink for Song of Solomon
  jhn: '#0EA5E9', // Sky blue for John
  rom: '#8B5CF6', // Violet for Romans
  rev: '#B91C1C', // Deep red for Revelation
  gen: '#8B5CF6', // Violet for Genesis
  exo: '#7C3AED', // Purple for Exodus
  isa: '#2563EB', // Blue for Isaiah
  mat: '#059669', // Emerald for Matthew
  act: '#06B6D4', // Cyan for Acts
  heb: '#D946EF', // Fuchsia for Hebrews
  luk: '#10B981', // Green for Luke
  mrk: '#F97316', // Orange for Mark
  dan: '#6366F1', // Indigo for Daniel
  job: '#78716C', // Stone for Job
  default: '#1553FF', // Default blue
};

const OSIS_MAP: Record<string, string> = {
  gen: 'Gen',
  exo: 'Exod',
  lev: 'Lev',
  num: 'Num',
  deu: 'Deut',
  jos: 'Josh',
  jdg: 'Judg',
  rut: 'Ruth',
  '1sa': '1Sam',
  '2sa': '2Sam',
  '1ki': '1Kgs',
  '2ki': '2Kgs',
  '1ch': '1Chr',
  '2ch': '2Chr',
  ezr: 'Ezra',
  neh: 'Neh',
  est: 'Esth',
  job: 'Job',
  psa: 'Ps',
  pro: 'Prov',
  ecc: 'Eccl',
  sng: 'Song',
  isa: 'Isa',
  jer: 'Jer',
  lam: 'Lam',
  ezk: 'Ezek',
  dan: 'Dan',
  hos: 'Hos',
  jol: 'Joel',
  amo: 'Amos',
  oba: 'Obad',
  jon: 'Jonah',
  mic: 'Mic',
  nah: 'Nah',
  hab: 'Hab',
  zep: 'Zeph',
  hag: 'Hag',
  zec: 'Zech',
  mal: 'Mal',
  mat: 'Matt',
  mrk: 'Mark',
  luk: 'Luke',
  jhn: 'John',
  act: 'Acts',
  rom: 'Rom',
  '1co': '1Cor',
  '2co': '2Cor',
  gal: 'Gal',
  eph: 'Eph',
  php: 'Phil',
  col: 'Col',
  '1th': '1Thess',
  '2th': '2Thess',
  '1ti': '1Tim',
  '2ti': '2Tim',
  tit: 'Titus',
  phm: 'Phlm',
  heb: 'Heb',
  jas: 'Jas',
  '1pe': '1Pet',
  '2pe': '2Pet',
  '1jo': '1John',
  '2jo': '2John',
  '3jo': '3John',
  jud: 'Jude',
  rev: 'Rev',
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAudioSourceUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function clampReaderFontScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_READER_FONT_SCALE, Math.max(MIN_READER_FONT_SCALE, value));
}

function formatAudioClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const safe = Math.floor(seconds);
  const minutes = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${minutes}:${String(sec).padStart(2, '0')}`;
}

function maskMemoryWordToken(
  token: string,
  wordIndex: number,
  maskLevel: number,
  revealUntilWord: number
): string {
  const safeMaskLevel = Math.max(2, Math.min(8, Math.floor(maskLevel || 4)));
  if (wordIndex <= revealUntilWord) return token;
  if (wordIndex % safeMaskLevel !== 0) return token;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(token)) return token;
  return token.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]/g, '_');
}

function renderTextWithSearchMatch(text: string, query: string): ReactNode {
  const term = query.trim();
  if (!term) return text;

  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  if (!lowerText.includes(lowerTerm)) return text;

  const nodes: ReactNode[] = [];
  let start = 0;
  let key = 0;

  while (start < text.length) {
    const index = lowerText.indexOf(lowerTerm, start);
    if (index === -1) {
      if (start < text.length) nodes.push(<span key={`text-${key++}`}>{text.slice(start)}</span>);
      break;
    }
    if (index > start) {
      nodes.push(<span key={`text-${key++}`}>{text.slice(start, index)}</span>);
    }
    const end = index + term.length;
    nodes.push(
      <mark
        key={`hit-${key++}`}
        className="search-hit-marker text-foreground"
      >
        {text.slice(index, end)}
      </mark>
    );
    start = end;
  }

  return nodes;
}

function parseTimeToSeconds(rawTime: string): number {
  const normalized = rawTime.trim().replace(',', '.');
  const parts = normalized.split(':');
  const last = parts.pop() ?? '0';
  const [secPart = '0', msPart = '0'] = last.split('.');
  const seconds = Number(secPart);
  const millis = Number(msPart.padEnd(3, '0').slice(0, 3));
  const minutes = parts.length ? Number(parts.pop() ?? '0') : 0;
  const hours = parts.length ? Number(parts.pop() ?? '0') : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(millis) || !Number.isFinite(minutes) || !Number.isFinite(hours)) {
    return 0;
  }
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function parseVttToCues(vtt: string): VttCue[] {
  const raw = vtt.replace(/^\uFEFF/, '').trim();
  if (!raw.startsWith('WEBVTT')) return [];

  const lines = raw.split(/\r?\n/);
  const cues: VttCue[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? '';
    index += 1;

    if (!line || line === 'WEBVTT') continue;
    if (line.startsWith('NOTE')) {
      while (index < lines.length && (lines[index]?.trim() ?? '') !== '') {
        index += 1;
      }
      continue;
    }

    let timingLine = line;
    if (!timingLine.includes('-->') && index < lines.length) {
      timingLine = lines[index]?.trim() ?? '';
      index += 1;
    }
    if (!timingLine.includes('-->')) continue;

    const [startText, endWithSettings] = timingLine.split('-->');
    if (!startText || !endWithSettings) continue;
    const endText = endWithSettings.trim().split(/\s+/)[0] ?? '';
    const start = parseTimeToSeconds(startText);
    const end = parseTimeToSeconds(endText);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const textLines: string[] = [];
    while (index < lines.length && (lines[index]?.trim() ?? '') !== '') {
      textLines.push(lines[index] ?? '');
      index += 1;
    }
    const cueText = textLines.join('\n').trim();
    const verseWithPipe = cueText.match(/^(\d+)\|([\s\S]*)$/);
    const firstLine = cueText.split('\n')[0]?.trim() ?? '';
    const verseOnlyOnFirstLine = /^\d+$/.test(firstLine) ? Number(firstLine) : null;
    const verse = verseWithPipe ? Number(verseWithPipe[1]) : verseOnlyOnFirstLine;
    const cuePayloadText = verseWithPipe
      ? verseWithPipe[2].trim()
      : verseOnlyOnFirstLine !== null
        ? cueText.split('\n').slice(1).join('\n').trim()
        : cueText;
    cues.push({
      start,
      end,
      verse: Number.isFinite(verse ?? NaN) ? verse : null,
      text: cuePayloadText,
    });
  }

  return cues.sort((a, b) => a.start - b.start);
}

function generateApproximateTimings(
  verses: VerseRow[],
  duration: number,
  introLeadSeconds = 0
): VerseTiming[] {
  if (!verses.length || !Number.isFinite(duration) || duration <= 0) return [];

  // Weighted by verse length: long verses receive more playback time.
  const weights = verses.map((verse) => {
    const cleaned = verse.text.replace(/\s+/g, ' ').trim();
    return Math.max(cleaned.length, 1);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return [];

  const startOffset = Math.min(Math.max(0, introLeadSeconds), Math.max(0, duration - 0.01));
  const readingDuration = Math.max(0.01, duration - startOffset);
  let currentTime = startOffset;
  const timings: VerseTiming[] = verses.map((verse, index) => {
    const portion = weights[index] / totalWeight;
    const verseDuration = index === verses.length - 1 ? duration - currentTime : portion * readingDuration;
    const start = currentTime;
    const end = Math.max(start + 0.001, Math.min(duration, start + verseDuration));
    currentTime = end;
    return { verse: verse.number, start, end };
  });

  if (timings.length > 0) {
    timings[timings.length - 1] = {
      ...timings[timings.length - 1],
      end: duration,
    };
  }

  return timings.filter((timing) => timing.end > timing.start);
}

function makeStorageKey(translationId: string, bookId: string, chapter: number) {
  return `${translationId}:${bookId}:${chapter}`;
}

function verseKey(translationId: string, bookId: string, chapter: number, verse: number) {
  return `${translationId}:${bookId}:${chapter}:${verse}`;
}

function extractStrongCandidateWords(text: string) {
  const rawWords = text.match(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g) ?? [];
  const seen = new Set<string>();
  const candidates: Array<{ raw: string; norm: string }> = [];

  for (const rawWord of rawWords) {
    const cleanedRaw = rawWord.replace(/^'+|'+$/g, '');
    const norm = normalize(cleanedRaw);
    if (!norm || norm.length < 3) continue;
    if (STRONG_STOP_WORDS.has(norm)) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    candidates.push({ raw: cleanedRaw, norm });
    if (candidates.length >= MAX_STRONG_WORDS) break;
  }

  return candidates;
}

function extractVerses(list: any[]): VerseRow[] {
  return list
    .map((item, idx) => {
      if (typeof item === 'string') {
        return { number: idx + 1, text: item.trim() };
      }
      const text = String(item?.text ?? item?.content ?? item ?? '').trim();
      if (!text) return null;
      const number = Number(item?.verse ?? item?.number ?? idx + 1);
      return { number, text };
    })
    .filter(Boolean) as VerseRow[];
}

function findBookIndex(dataBooks: any[], book: BibleBook) {
  const bookName = normalize(book.name);
  const apiName = normalize(book.apiName);
  const slug = normalize(book.slug);
  const byName = dataBooks.findIndex((item) => {
    const name = normalize(String(item?.book ?? item?.name ?? item?.title ?? ''));
    const abbrev = normalize(String(item?.abbrev ?? item?.abbreviation ?? item?.abbr ?? ''));
    return (
      name === bookName ||
      name === apiName ||
      name === slug ||
      abbrev === bookName ||
      abbrev === apiName ||
      abbrev === slug
    );
  });
  if (byName >= 0) return byName;
  const index = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
  return index >= 0 ? index : 0;
}

const RAW_BIBLE_CACHE = new Map<string, Promise<any>>();

function readErrorMessage(err: unknown, fallback = 'Erreur inconnue') {
  return err instanceof Error ? err.message : fallback;
}

function parseBiblePayload(raw: string) {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  if (!cleaned) throw new Error('Fichier Bible vide');
  // Utilise un parser JSON sûr sans eval/Function
  return safeParseLooseJson(cleaned);
}

async function loadBiblePayload(translationId: string) {
  if (RAW_BIBLE_CACHE.has(translationId)) return RAW_BIBLE_CACHE.get(translationId)!;

  const loader = (async () => {
    const candidateIds = Array.from(
      new Set(
        [
          translationId,
          translationId.toUpperCase(),
          translationId.toLowerCase(),
          translationId === 'LSG' ? 'lsg' : null,
        ].filter(Boolean) as string[]
      )
    );
    const errors: string[] = [];

    for (const id of candidateIds) {
      const url = `/bibles/${id}/bible.json`;
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) {
          errors.push(`${url} (${res.status})`);
          continue;
        }
        const text = await res.text();
        return parseBiblePayload(text);
      } catch (err) {
        errors.push(`${url} (${readErrorMessage(err)})`);
      }
    }

    throw new Error(`Impossible de charger ${translationId}: ${errors.join(', ')}`);
  })();

  RAW_BIBLE_CACHE.set(translationId, loader);
  return loader;
}

async function loadChapterData(translationId: string, _bookId: string, _chapter: number) {
  return loadBiblePayload(translationId);
}

function readNumberLike(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveChapterEntry(chapters: any[], requestedChapter: number) {
  const parsed = chapters
    .map((entry) => ({
      entry,
      number: readNumberLike(entry?.chapter ?? entry?.number ?? entry?.id),
    }))
    .filter((row) => row.number !== null) as Array<{ entry: any; number: number }>;

  if (!parsed.length) {
    return chapters[requestedChapter - 1] ?? null;
  }

  const numbers = parsed.map((row) => row.number);
  const hasZero = numbers.includes(0);
  const hasOne = numbers.includes(1);
  const maxNumber = Math.max(...numbers);

  // Some French dumps are "one-based except first chapter as 0": 0,2,3,...,N.
  // In this case chapter 1 => 0, and all other chapters keep their own number.
  if (hasZero && !hasOne) {
    const target = maxNumber >= chapters.length
      ? (requestedChapter === 1 ? 0 : requestedChapter)
      : (requestedChapter - 1);
    return parsed.find((row) => row.number === target)?.entry ?? null;
  }

  const exact = parsed.find((row) => row.number === requestedChapter)?.entry;
  if (exact) return exact;

  if (requestedChapter === 1 && hasZero) {
    const firstAsZero = parsed.find((row) => row.number === 0)?.entry;
    if (firstAsZero) return firstAsZero;
  }

  return parsed.find((row) => row.number === requestedChapter - 1)?.entry ?? chapters[requestedChapter - 1] ?? null;
}

function normalizeVerseNumber(raw: unknown, index: number) {
  const numeric = readNumberLike(raw);
  if (numeric === null) return index + 1;
  return numeric === 0 ? 1 : numeric;
}

import { parseBibleJson } from '../lib/bible/parsers';

// readFromJson has been refactored into modular parsers in @/lib/bible/parsers
const readBibleData = parseBibleJson;

interface VerseItemProps {
  verse: VerseRow;
  isSelected: boolean;
  isAudioActive: boolean;
  highlightColor: string | undefined;
  isPrismaMeditation: boolean;
  searchVerse: string;
  onTap: (verse: VerseRow) => void;
  onDoubleTap: (verse: VerseRow) => void;
  onLongPress: (verse: VerseRow) => void;
  bookId: string;
  renderTextWithSearchMatch: (text: string, search: string) => React.ReactNode;
}

const VerseItem = memo(({
  verse,
  isSelected,
  isAudioActive,
  highlightColor,
  isPrismaMeditation,
  searchVerse,
  onTap,
  onDoubleTap,
  onLongPress,
  bookId,
  renderTextWithSearchMatch
}: VerseItemProps) => {
  const interaction = useLongPress<HTMLButtonElement>(
    () => onLongPress(verse),
    () => onTap(verse),
    { delay: 520, moveThreshold: 10 }
  );

  return (
    <button
      key={verse.number}
      {...interaction}
      onDoubleClick={() => onDoubleTap(verse)}
      className={`group relative w-full rounded-lg px-4 py-2.5 text-left transition-all duration-300 ${isSelected ? 'bg-accent/8' : 'hover:bg-foreground/[0.03]'}`}
    >
      <span
        className={`mr-2 inline-block font-sans text-[11px] font-extrabold align-super ${isAudioActive ? 'text-accent' : ''}`}
        style={{ color: isAudioActive ? undefined : 'var(--bible-paper-verse-num)' }}
      >
        {verse.number}
      </span>
      <span
        className={`text-[1em] leading-[1.65] transition-colors duration-500 ${isAudioActive ? 'font-semibold text-accent' : ''} ${highlightColor ? `highlight-${highlightColor} rounded-md px-1` : ''}`}
        style={{ color: isAudioActive ? undefined : 'var(--bible-paper-text, rgba(0,0,0,0.85))' }}
      >
        {isPrismaMeditation ? (
          <AnimatedLetter text={verse.text} />
        ) : (
          searchVerse ? renderTextWithSearchMatch(verse.text, searchVerse) : verse.text
        )}
      </span>
      {isAudioActive && (
        <motion.div
          layoutId="audio-indicator"
          className="absolute bottom-1.5 left-12 right-5 h-[1.5px] rounded-full"
          style={{ background: `${BOOK_AURA_COLORS[bookId] ?? BOOK_AURA_COLORS.default}40` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
        />
      )}
    </button>
  );
});

export default function BibleReader({ 
  embedded = false, 
  onSyncBible,
  initialBookId,
  initialChapter,
  initialVerse
}: { 
  embedded?: boolean;
  onSyncBible?: (ref: string, content: string, metadata?: { bookId: string; chapter: number; verse: number }) => void;
  initialBookId?: string;
  initialChapter?: number;
  initialVerse?: number;
}) {
  const { t } = useI18n();
  const { profile } = useAuth();
  
  // Refs need to be declared before they are used in hooks like useAudioPlayer
  const isStartingPlaybackRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFocusRequestIdRef = useRef<number | null>(null);
  const rootSectionRef = useRef<HTMLElement | null>(null);
  const verseScrollRef = useRef<HTMLDivElement | null>(null);
  const verseNodeRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chapterScenePosRef = useRef<number | null>(null);
  const scrollIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embeddedTapRef = useRef<{ timestamp: number; x: number; y: number } | null>(null);
  const treasuryRequestRef = useRef(0);
  const referencePreviewRequestRef = useRef(0);
  const lastAudioCueVerseRef = useRef<number | null>(null);
  const effectiveAudioCuesRef = useRef<VttCue[]>([]);
  const approximateAudioSyncRef = useRef<{ verse: number | null; progress: number }>({
    verse: null,
    progress: 0,
  });
  const [isClient, setIsClient] = useState(false);
  const [translationId, setTranslationId] = useState(LOCAL_BIBLE_TRANSLATIONS[0]?.id ?? 'LSG');
  const [bookId, setBookId] = useState('jhn');
  const [chapter, setChapter] = useState(3);

  // External Navigation Sync
  useEffect(() => {
    if (initialBookId && initialBookId !== bookId) setBookId(initialBookId);
    if (initialChapter && initialChapter !== chapter) setChapter(initialChapter);
    if (initialVerse) {
        // Optionnel : Scrollez vers le verset ici
    }
  }, [initialBookId, initialChapter, initialVerse]);
  const [searchVerse, setSearchVerse] = useState('');
  const [fontScale, setFontScale] = useState(1);
  const [verses, setVerses] = useState<VerseRow[]>([]);
  const [selectedVerse, setSelectedVerse] = useState<VerseRow | null>(null);
  const [strongTokens, setStrongTokens] = useState<StrongToken[]>([]);
  const [strongOpenFor, setStrongOpenFor] = useState<{ bookId: string; chapter: number; verse: number } | null>(null);
  const { identity } = useCommunityIdentity();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState<Record<string, HighlightMap>>({});
  const [fullScreen, setFullScreen] = useState(false);
  const [embeddedFullscreen, setEmbeddedFullscreen] = useState(false);
  const [treasuryRefs, setTreasuryRefs] = useState<TreasuryRef[]>([]);
  const [treasuryStatus, setTreasuryStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [streakData, setStreakData] = useState<{ current: number; best: number; totalChapters: number }>({ current: 0, best: 0, totalChapters: 0 });
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>('read');
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('yellow');
  const [toast, setToast] = useState<string | null>(null);
  const [verseNotes, setVerseNotes] = useState<Record<string, string>>({});
  const {
    playing: playerPlaying,
    position: playerPosition,
    duration: playerDuration,
    play: playAudio,
    pause: pauseAudio,
    seek: seekAudio,
    setHandlers: setAudioHandlers
  } = useAudioPlayer(audioRef);
  const [longPressTarget, setLongPressTarget] = useState<{
    verse: VerseRow;
    ref: string;
  } | null>(null);
  const [shareVerseTarget, setShareVerseTarget] = useState<{ ref: string; text: string } | null>(null);
  const searchParams = useSearchParams();
  const strongTokenCacheRef = useRef<Map<string, StrongToken[]>>(new Map());
  const strongSearchCacheRef = useRef<Map<string, StrongSearchResult[]>>(new Map());
  const [strongLoadingFor, setStrongLoadingFor] = useState<string | null>(null);
  const [vttCues, setVttCues] = useState<VttCue[]>([]);
  const [approxVerseTimings, setApproxVerseTimings] = useState<VerseTiming[]>([]);
  const [, setVttStatus] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle');
  const [activeCueVerse, setActiveCueVerse] = useState<number | null>(null);
  const [activeVerseReference, setActiveVerseReference] = useState<string | null>(null);
  const [activeVerseText, setActiveVerseText] = useState<string | null>(null);
  const [mirrorAnalysis, setMirrorAnalysis] = useState<string>('');
  const [showLectioDivina, setShowLectioDivina] = useState(false);
  const [lectioVerse, setLectioVerse] = useState<{ ref: string; text: string } | null>(null);
  const [showMemorization, setShowMemorization] = useState(false);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [mirrorError, setMirrorError] = useState<string | null>(null);
  const [mirrorModalOpen, setMirrorModalOpen] = useState(false);
  const [activeVerseProgress, setActiveVerseProgress] = useState(0);
  // Changement : Utiliser noteOpenFor pour gérer la note ouverte par verset
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
  const [pendingFocusRef, setPendingFocusRef] = useState<TreasuryRef | null>(null);
  const [referencePreview, setReferencePreview] = useState<ReferencePreviewState>({
    open: false,
    ref: null,
    rows: [],
    status: 'idle',
    error: null,
  });

  // États pour les fonctionnalités avancées
  const [showStrongViewer, setShowStrongViewer] = useState(false);
  const [showInterlinearViewer, setShowInterlinearViewer] = useState(false);
  const [showCompareViewer, setShowCompareViewer] = useState(false);
  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [showAdvancedStudyTools, setShowAdvancedStudyTools] = useState(false);
  const [currentStrongNumber, setCurrentStrongNumber] = useState<string | null>(null);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [pendingAutoPlayAfterSync, setPendingAutoPlayAfterSync] = useState(false);
  const [immersiveEnabled, setImmersiveEnabled] = useState(true);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [isPrismaMeditation, setIsPrismaMeditation] = useState(false);
  const [showReflectionSheet, setShowReflectionSheet] = useState(false);
  const [memoryMode, setMemoryMode] = useState(false);
  const [memoryMaskLevel, setMemoryMaskLevel] = useState(4);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [zenMode] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [readingPlanActive, setReadingPlanActive] = useState(false);
  const [triggerReflection, setTriggerReflection] = useState(0);
  const reflectionTriggeredRef = useRef(false);
  const readingPlanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chapterSceneDirection, setChapterSceneDirection] = useState<1 | -1>(1);
  const [radarOpen, setRadarOpen] = useState(false);
  const [radarPos, setRadarPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [radarVerse, setRadarVerse] = useState<VerseRow | null>(null);
  const [radarWord, setRadarWord] = useState('');
  const [radarRefsSheetOpen, setRadarRefsSheetOpen] = useState(false);
  const [radarPreferredBubble, setRadarPreferredBubble] = useState<'strong' | 'refs' | 'note' | null>(null);
  const [studyBarOpen, setStudyBarOpen] = useState(false);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const standaloneReading = useMemo(() => ({
    id: `standalone-${bookId}`,
    bookId: bookId,
    bookName: BIBLE_BOOKS.find(b => b.id === bookId)?.name ?? '',
    chapters: [chapter]
  }), [bookId, chapter]);



  const translation = useMemo(
    () => LOCAL_BIBLE_TRANSLATIONS.find((item) => item.id === translationId) ?? LOCAL_BIBLE_TRANSLATIONS[0],
    [translationId]
  );
  const book = useMemo(
    () => BIBLE_BOOKS.find((b) => b.id === bookId) ?? BIBLE_BOOKS[0],
    [bookId]
  );
  const audioAvailable = useMemo(
    () => hasSelahAudio(translation?.id ?? ''),
    [translation?.id]
  );
  const audioUrl = useMemo(() => {
    if (!audioAvailable) return '';
    const params = new URLSearchParams({
      translation: translation?.id ?? 'LSG',
      book: book.id,
      chapter: String(chapter),
    });
    return `/api/bible/audio?${params.toString()}`;
  }, [audioAvailable, translation?.id, book.id, chapter]);
  const audioFocusEntry = useMemo(
    () => ({
      id: `bible:${translation?.id ?? 'LSG'}:${book.id}:${chapter}`,
      kind: 'bible-audio' as const,
      label: `${book.name} ${chapter}`,
    }),
    [book.id, book.name, chapter, translation?.id]
  );
  const vttTranslationId = useMemo(() => {
    const aligned = getSelahAudioAlignedTranslationId(translation?.id ?? '');
    return (aligned ?? translation?.id ?? 'LSG').toUpperCase();
  }, [translation?.id]);
  const { activeVerse: approximatedActiveVerse, activeProgress: approximatedVerseProgress } = useVerseSync(
    vttCues.length > 0 ? null : audioRef.current,
    verses,
    {
      enabled: audioAvailable,
      introLeadSeconds: APPROX_AUDIO_INTRO_LEAD_SECONDS,
    }
  );
  const effectiveAudioCues = useMemo<VttCue[]>(() => {
    return vttCues;
  }, [vttCues]);
  const segmentSourceCues = useMemo<VttCue[]>(() => {
    if (vttCues.length > 0) return vttCues;
    if (approxVerseTimings.length === 0) return [];
    return approxVerseTimings.map((timing) => {
      const verseRow = verses.find((row) => row.number === timing.verse);
      return {
        start: timing.start,
        end: timing.end,
        verse: timing.verse,
        text: verseRow?.text ?? '',
      };
    });
  }, [vttCues, approxVerseTimings, verses]);
  const audioVerseSegments = useMemo<AudioVerseSegment[]>(() => {
    if (segmentSourceCues.length === 0) return [];

    const byVerse = new Map<number, AudioVerseSegment>();
    for (const cue of segmentSourceCues) {
      if (!cue.verse || cue.end <= cue.start) continue;
      const existing = byVerse.get(cue.verse);
      if (!existing) {
        byVerse.set(cue.verse, {
          verse: cue.verse,
          start: cue.start,
          end: cue.end,
        });
        continue;
      }
      existing.start = Math.min(existing.start, cue.start);
      existing.end = Math.max(existing.end, cue.end);
    }

    return Array.from(byVerse.values())
      .filter((segment) => segment.end > segment.start)
      .sort((a, b) => a.start - b.start);
  }, [segmentSourceCues]);
  useEffect(() => {
    effectiveAudioCuesRef.current = effectiveAudioCues;
  }, [effectiveAudioCues]);
  useEffect(() => {
    approximateAudioSyncRef.current = {
      verse: approximatedActiveVerse ?? null,
      progress: approximatedVerseProgress,
    };
  }, [approximatedActiveVerse, approximatedVerseProgress]);
  const currentBookMood = useMemo<AudioMood>(
    () => BOOK_MOODS[book.id] ?? 'calm',
    [book.id]
  );
  const currentBookTheme = useMemo(
    () => BOOK_THEMES[book.id] ?? BOOK_THEMES.default,
    [book.id]
  );
  const verseSelectionPinned = Boolean(
    studyBarOpen ||
    longPressTarget ||
    noteOpenFor ||
    shareVerseTarget ||
    showStrongViewer ||
    showInterlinearViewer ||
    showCompareViewer ||
    showAdvancedStudyTools ||
    radarOpen ||
    radarRefsSheetOpen ||
    referencePreview.open
  );

  const currentMatchingReading = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const active = getActivePlan();
    if (!active) return null;
    const todayDay = active.plan.days[active.todayIndex];
    const reading = todayDay?.readings.find((r) =>
      r.bookId === book.id && r.chapters.includes(chapter)
    );
    if (!reading) return null;
    return {
      planId: active.planId,
      dayIndex: active.todayIndex,
      reading,
      isCompleted: isReadingChapterCompleted(active.planId, active.todayIndex, reading.id, chapter)
    };
  }, [book.id, chapter, isClient]);

  const referenceKey = makeStorageKey(translation?.id ?? 'fr', book.id, chapter);
  // Changement : Utiliser le nouveau type HighlightMap
  const highlightMap: HighlightMap = highlights[referenceKey] || {};
  const scrollVerseIntoView = useCallback(
    (verseNumber: number, behavior: ScrollBehavior = 'smooth') => {
      if (!Number.isFinite(verseNumber) || verseNumber <= 0) return;
      const element =
        verseNodeRefs.current[verseNumber] ??
        (typeof document !== 'undefined'
          ? (document.getElementById(`verse-${book.id}-${chapter}-${verseNumber}`) as HTMLButtonElement | null)
          : null);
      if (!element) return;
      element.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
    },
    [book.id, chapter]
  );

  useEffect(() => {
    const saved = safeParse<{
      translationId?: string;
      bookId?: string;
      chapter?: number;
      fontScale?: number;
    }>(typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.settings), {});
    if (saved.translationId) {
      const migratedTranslationId = saved.translationId === 'LSG1910' ? 'LSG' : saved.translationId;
      setTranslationId(migratedTranslationId);
    }
    if (saved.bookId) setBookId(saved.bookId);
    if (saved.chapter) setChapter(saved.chapter);
    if (typeof saved.fontScale === 'number') {
      setFontScale(clampReaderFontScale(saved.fontScale));
    }

    setNotes(
      safeParse<Record<string, string>>(
        typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.notes),
        {}
      )
    );
    // Changement : Adapter le chargement des surlignages au nouveau type
    setHighlights(
      safeParse<Record<string, HighlightMap>>(
        typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.highlights),
        {}
      )
    );
    setVerseNotes(
      safeParse<Record<string, string>>(
        typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.verseNotes),
        {}
      )
    );
    hasInitializedRef.current = true;
  }, []);

  // Sync with URL parameters on mount
  useEffect(() => {
    if (!isClient) return;

    const bookParam = searchParams.get('book');
    const chapParam = searchParams.get('chapter');
    const verseParam = searchParams.get('verse');
    const planParam = searchParams.get('plan');

    if (bookParam || chapParam) {
      if (bookParam) {
        // Try to find book by ID or name
        const foundBook = BIBLE_BOOKS.find(b =>
          normalize(b.id) === normalize(bookParam) ||
          normalize(b.name) === normalize(bookParam)
        );
        if (foundBook) setBookId(foundBook.id);
      }

      if (chapParam) {
        const n = parseInt(chapParam, 10);
        if (!isNaN(n)) setChapter(n);
      }

      if (verseParam) {
        const v = parseInt(verseParam, 10);
        if (!isNaN(v)) {
          // Set pending focus so it scrolls once verses are loaded
          setPendingFocusRef({
            id: 'url-param',
            label: 'URL',
            bookId: bookParam || bookId,
            chapter: chapParam ? parseInt(chapParam, 10) : chapter,
            verse: v
          });
        }
      }
    }

    if (planParam) {
      reflectionTriggeredRef.current = false;
      setReadingPlanActive(true);
    }
  }, [isClient, searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isClient || !hasInitializedRef.current) return;
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ translationId, bookId, chapter, fontScale })
    );
  }, [translationId, bookId, chapter, fontScale, isClient]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Changement : Adapter la sauvegarde des surlignages au nouveau type
    localStorage.setItem(STORAGE_KEYS.highlights, JSON.stringify(highlights));
  }, [highlights]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.verseNotes, JSON.stringify(verseNotes));
  }, [verseNotes]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (fullScreen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [fullScreen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleFullscreenChange = () => {
      const root = rootSectionRef.current;
      setEmbeddedFullscreen(Boolean(root && document.fullscreenElement === root));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!translation) return;
    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        // 1. Try cache first
        const cached = await getCachedChapter(translation.id, book.id, chapter);
        if (cached && active) {
          setVerses(cached);
          updateReadingStreakAndBadges();
          setInitialSelectedVerse(cached);
          setLoading(false);
          return;
        }

        // 2. Load from network
        const data = await loadChapterData(translation.id, book.id, chapter);
        if (!active) return;

        const rows: VerseRow[] = readBibleData(data, book, chapter);
        setVerses(rows);

        // 3. Cache for next time
        if (rows.length > 0) {
          void cacheChapter(translation.id, book.id, chapter, rows);
        }

        updateReadingStreakAndBadges();
        setInitialSelectedVerse(rows);
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Détail indisponible';
        setError(`Erreur de chargement: ${msg}. Vérifiez votre connexion internet ou réessayez plus tard.`);
        setVerses([]);
        setSelectedVerse(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    function updateReadingStreakAndBadges() {
      const streak = recordReading();
      setStreakData({ current: streak.current, best: streak.best, totalChapters: streak.totalChapters });

      if (identity) {
        void checkAndAwardBadge('streak', streak.current, {
          userId: identity.userId,
          deviceId: identity.deviceId
        });
        void checkAndAwardBadge('reading', streak.totalChapters, {
          userId: identity.userId,
          deviceId: identity.deviceId
        });
        void updateBibleReadingChallenges({
          userId: identity.userId,
          deviceId: identity.deviceId
        }, book.id, chapter);
      }
    }

    function setInitialSelectedVerse(rows: VerseRow[]) {
      setSelectedVerse((prev) => {
        if (!rows.length) return null;
        if (prev) {
          const same = rows.find((row) => row.number === prev.number);
          if (same) return same;
        }
        return rows[0];
      });
    }

    void load();

    return () => {
      active = false;
    };
  }, [translation, book, chapter, identity]);

  const loadTreasuryRefs = useCallback(
    async (targetBookId: string, targetChapter: number, targetVerse: number) => {
      const requestId = treasuryRequestRef.current + 1;
      treasuryRequestRef.current = requestId;
      setTreasuryStatus('loading');
      setTreasuryRefs([]);

      try {
        const response = await fetch(
          `/api/bible/treasury?bookId=${encodeURIComponent(targetBookId)}&chapter=${targetChapter}&verse=${targetVerse}`
        );
        if (!response.ok) {
          throw new Error('missing');
        }
        const data = parseBibleTreasuryResponse(await response.json());
        if (treasuryRequestRef.current !== requestId) return;
        setTreasuryRefs(extractTreasuryRefs(data.entries));
        setTreasuryStatus('idle');
      } catch {
        if (treasuryRequestRef.current !== requestId) return;
        setTreasuryStatus('error');
        setTreasuryRefs([]);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedVerse) {
      setTreasuryRefs([]);
      setTreasuryStatus('idle');
      return;
    }
    void loadTreasuryRefs(book.id, chapter, selectedVerse.number);
  }, [selectedVerse?.number, book.id, chapter, loadTreasuryRefs]);

  const visibleVerses = useMemo(() => {
    // In embedded call mode, always render full chapter text even if a previous
    // hidden search filter exists on this client.
    if (embedded || !searchVerse.trim()) return verses;
    const query = searchVerse.toLowerCase();
    return verses.filter((verse) => verse.text.toLowerCase().includes(query));
  }, [embedded, searchVerse, verses]);
  const searchQuery = embedded ? '' : searchVerse.trim();
  const activeVerseId = useActiveVerse({
    root: verseScrollRef.current ?? undefined,
    rootMargin: '-35% 0px -45% 0px',
  });
  const activeSignature = useMemo(() => {
    const verseNumber = selectedVerse?.number ?? 1;
    return (verseNumber * 97 + chapter * 13 + book.id.length * 7) % 360;
  }, [selectedVerse?.number, chapter, book.id]);
  const chapterSceneKey = `${translation?.id ?? 'fr'}-${book.id}-${chapter}`;
  const chapterScenePosition = useMemo(() => {
    const index = BIBLE_BOOKS.findIndex((item) => item.id === book.id);
    return index * 1000 + chapter;
  }, [book.id, chapter]);

  const chapterNotes = notes[referenceKey] || '';
  const selectedVerseNoteKey = selectedVerse
    ? verseKey(translation?.id ?? 'fr', book.id, chapter, selectedVerse.number)
    : null;
  const selectedVerseNote = selectedVerseNoteKey ? (verseNotes[selectedVerseNoteKey] ?? '') : '';
  const selectedStrongCacheKey = selectedVerse
    ? `${book.id}:${chapter}:${selectedVerse.number}`
    : null;
  const selectedVerseHasLoadedStrongTokens = Boolean(
    selectedVerse &&
    strongOpenFor &&
    strongOpenFor.bookId === book.id &&
    strongOpenFor.chapter === chapter &&
    strongOpenFor.verse === selectedVerse.number
  );
  const selectedVerseStrongTokens = selectedVerseHasLoadedStrongTokens ? strongTokens : [];
  const selectedVerseStrongLoading =
    selectedStrongCacheKey !== null &&
    strongLoadingFor === selectedStrongCacheKey;
  const studyRefLabel = selectedVerse ? `${book.name} ${chapter}:${selectedVerse.number}` : '';
  const studyVerseText = selectedVerse?.text ?? '';
  const studyNoteKey = selectedVerse
    ? verseKey(translation?.id ?? 'fr', book.id, chapter, selectedVerse.number)
    : null;
  const studyHasNote = studyNoteKey ? Boolean((verseNotes[studyNoteKey] ?? '').trim()) : false;
  const openRefsForVerse = useCallback(
    (verse: VerseRow | null) => {
      if (!verse) return;
      setSelectedVerse(verse);
      setRadarVerse(verse);
      setRadarWord('');
      setRadarOpen(false);
      setRadarPreferredBubble(null);
      setRadarRefsSheetOpen(true);
      void loadTreasuryRefs(book.id, chapter, verse.number);
    },
    [book.id, chapter, loadTreasuryRefs]
  );
  const radarRefLabel = radarVerse ? `${book.name} ${chapter}:${radarVerse.number}` : '';
  const radarNoteKey = radarVerse
    ? verseKey(translation?.id ?? 'fr', book.id, chapter, radarVerse.number)
    : null;
  const radarHasNote = radarNoteKey ? Boolean((verseNotes[radarNoteKey] ?? '').trim()) : false;
  const referencePreviewBook = useMemo(() => {
    const previewRef = referencePreview.ref;
    if (!previewRef) return null;
    return BIBLE_BOOKS.find((item) => item.id === previewRef.bookId) ?? null;
  }, [referencePreview.ref]);
  const radarRefsCount =
    radarVerse && selectedVerse?.number === radarVerse.number
      ? treasuryRefs.length
      : 0;
  const radarRefsSubtitle =
    treasuryStatus === 'loading'
      ? 'Chargement...'
      : radarRefsCount
        ? `${radarRefsCount} trouvées`
        : 'Aucune';

  const radarBubbles = [
    {
      id: 'strong' as const,
      title: 'Strong',
      subtitle: radarWord ? `Mot: ${radarWord}` : undefined,
      disabled: !radarVerse,
      onClick: async () => {
        if (!radarVerse) return;
        const tokens = await loadStrongTokensForVerse(radarVerse);
        if (!tokens.length) {
          showToast(t('bible.toast.noStrong'));
          setRadarOpen(false);
          return;
        }
        const hint = normalize(radarWord);
        const tokenMatch = hint
          ? tokens.find((token) => {
            const wordNorm = normalize(token.w);
            return wordNorm.includes(hint) || hint.includes(wordNorm);
          })
          : null;
        setCurrentStrongNumber((tokenMatch ?? tokens[0]).strong);
        setShowStrongViewer(true);
        setRadarOpen(false);
        setRadarPreferredBubble(null);
      },
    },
    {
      id: 'refs' as const,
      title: 'Références',
      subtitle: radarRefsSubtitle,
      disabled: !radarVerse,
      onClick: () => {
        openRefsForVerse(radarVerse);
      },
    },
    {
      id: 'note' as const,
      title: radarHasNote ? 'Note' : 'Créer une note',
      subtitle: radarHasNote ? 'Déjà enregistrée' : 'Ajouter un mémo',
      disabled: !radarVerse,
      onClick: () => {
        if (radarNoteKey) setNoteOpenFor(radarNoteKey);
        setRadarOpen(false);
        setRadarPreferredBubble(null);
      },
    },
  ];

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1400);
  }, []);

  const revealUI = useCallback(() => {
    setUiHidden(false);
    if (scrollIdleRef.current) clearTimeout(scrollIdleRef.current);
    scrollIdleRef.current = setTimeout(() => {
      if (zenMode) setUiHidden(true);
    }, 1100);
  }, [zenMode]);

  const stopAmbientLayer = useCallback((fadeMs = 420) => {
    audioEngine.fadeOutAmbient(false, fadeMs);
  }, []);

  const startAmbientLayer = useCallback(
    async (mood: AudioMood) => {
      audioEngine.setVoiceElement(audioRef.current);
      audioEngine.setMood(mood);
      audioEngine.setAmbientEnabled(ambientEnabled);
      await audioEngine.syncWithVoiceState();
    },
    [ambientEnabled]
  );

  const startBibleAudioPlayback = useCallback(async () => {
    if (isStartingPlaybackRef.current) return false;
    
    if (!audioAvailable || !audioUrl) {
      showToast(`Audio non disponible pour ${translation?.label ?? 'cette traduction'}`);
      return false;
    }

    const audio = audioRef.current;
    if (!audio) {
      showToast('Audio non disponible');
      return false;
    }

    isStartingPlaybackRef.current = true;
    const requestId = requestAudioFocus(audioFocusEntry);
    audioFocusRequestIdRef.current = requestId;

    try {
      const resolvedAudioUrl = normalizeAudioSourceUrl(audioUrl);
      if (!audio.src || (audio.src !== resolvedAudioUrl && audio.currentSrc !== resolvedAudioUrl)) {
        audio.src = audioUrl;
        audio.load();
      }
      audio.defaultPlaybackRate = 1;
      audio.playbackRate = 1;
      if (audio.duration && audio.currentTime >= Math.max(0, audio.duration - 0.35)) {
        audio.currentTime = 0;
      }
      await audio.play();
      const confirmed = confirmAudioFocus(audioFocusEntry, requestId);
      if (!confirmed) {
        audio.pause();
        return false;
      }
      return true;
    } catch (error) {
      logger.error('[BibleReader] Audio focus error:', error);
      failAudioFocus(requestId, "Impossible de lancer l'audio");
      showToast("Impossible de lancer l'audio");
      return false;
    } finally {
      isStartingPlaybackRef.current = false;
      if (audioFocusRequestIdRef.current === requestId) {
        audioFocusRequestIdRef.current = null;
      }
    }
  }, [audioAvailable, audioFocusEntry, audioUrl, showToast, translation?.label]);

  const toggleReaderFullscreen = async () => {
    if (!embedded) {
      setFullScreen((prev) => !prev);
      return;
    }
    if (typeof document === 'undefined') return;

    const root = rootSectionRef.current;
    if (!root || !document.fullscreenEnabled) {
      setFullScreen((prev) => !prev);
      return;
    }

    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch (err) {
      logger.error('[BibleReader] Fullscreen toggle error:', err);
      showToast('Plein écran indisponible');
    }
  };

  const navigateToVerse = (ref: TreasuryRef) => {
    setPendingFocusRef(ref);
    if (book.id !== ref.bookId) {
      setBookId(ref.bookId);
    }
    if (chapter !== ref.chapter) {
      setChapter(ref.chapter);
    }
    setSelectedVerse(null);
  };

  const openReferencePreview = useCallback(
    async (ref: TreasuryRef) => {
      setReferencePreview({
        open: true,
        ref,
        rows: [],
        status: 'loading',
        error: null,
      });

      const requestId = referencePreviewRequestRef.current + 1;
      referencePreviewRequestRef.current = requestId;

      try {
        const targetBook = BIBLE_BOOKS.find((item) => item.id === ref.bookId);
        if (!targetBook) {
          throw new Error('Livre introuvable');
        }

        const raw = await loadChapterData(translation?.id ?? 'LSG', ref.bookId, ref.chapter);
        const chapterRows = readBibleData(raw, targetBook, ref.chapter) as VerseRow[];

        if (!chapterRows.length) {
          throw new Error('Passage indisponible');
        }

        const verseIndex = chapterRows.findIndex((row) => row.number === ref.verse);
        const centerIndex = verseIndex >= 0 ? verseIndex : 0;
        const start = Math.max(0, centerIndex - 1);
        const end = Math.min(chapterRows.length, centerIndex + 2);
        const previewRows = chapterRows.slice(start, end);

        if (referencePreviewRequestRef.current !== requestId) return;

        setReferencePreview({
          open: true,
          ref,
          rows: previewRows,
          status: 'idle',
          error: null,
        });
      } catch (err) {
        if (referencePreviewRequestRef.current !== requestId) return;
        const message = err instanceof Error ? err.message : 'Impossible de charger le passage';
        setReferencePreview({
          open: true,
          ref,
          rows: [],
          status: 'error',
          error: message,
        });
      }
    },
    [translation?.id]
  );

  useEffect(() => {
    if (!pendingFocusRef) return;
    if (pendingFocusRef.bookId !== book.id || pendingFocusRef.chapter !== chapter) return;

    const verseRow = verses.find((v) => v.number === pendingFocusRef.verse);
    if (!verseRow) return;

    setSelectedVerse(verseRow);
    setPendingFocusRef(null);

    setTimeout(() => {
      scrollVerseIntoView(verseRow.number, 'smooth');
    }, 80);
  }, [pendingFocusRef, book.id, chapter, verses, scrollVerseIntoView]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioAvailable || !audioUrl) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setApproxVerseTimings([]);
      setActiveCueVerse(null);
      setActiveVerseProgress(0);
      lastAudioCueVerseRef.current = null;
      return;
    }
    // Always enforce normal narration speed when source changes.
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    if ('preservesPitch' in audio) {
      // Keep natural voice tone if browser supports it.
      (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    }
    const resolvedAudioUrl = normalizeAudioSourceUrl(audioUrl);
    if (audio.src !== resolvedAudioUrl && audio.currentSrc !== resolvedAudioUrl) {
      audio.pause();
      audio.src = audioUrl;
      audio.load();
    }
    try {
      audio.currentTime = 0;
    } catch {
      // ignore browsers that block currentTime before metadata.
    }
    setApproxVerseTimings([]);
    setActiveCueVerse(null);
    setActiveVerseProgress(0);
    lastAudioCueVerseRef.current = null;
  }, [audioAvailable, audioUrl]);

  useEffect(() => {
    if (!audioAvailable) {
      setVttCues([]);
      setApproxVerseTimings([]);
      setVttStatus('idle');
      setActiveCueVerse(null);
      setActiveVerseProgress(0);
      lastAudioCueVerseRef.current = null;
      return;
    }

    let active = true;
    setVttStatus('loading');
    setVttCues([]);
    setApproxVerseTimings([]);
    setActiveCueVerse(null);
    setActiveVerseProgress(0);
    lastAudioCueVerseRef.current = null;

    const url = `/api/bible/vtt?translation=${encodeURIComponent(vttTranslationId)}&book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(String(chapter))}`;
    fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setVttStatus('missing');
          return;
        }
        const text = await response.text();
        const parsedCues = parseVttToCues(text);
        setVttCues(parsedCues);
        setVttStatus(parsedCues.length ? 'idle' : 'missing');
      })
      .catch(() => {
        if (!active) return;
        setVttStatus('error');
      });

    return () => {
      active = false;
    };
  }, [audioAvailable, vttTranslationId, book.id, chapter]);

  useEffect(() => {
    if (vttCues.length > 0) {
      setApproxVerseTimings([]);
      return;
    }
    if (!audioAvailable || playerDuration <= 0 || verses.length === 0) {
      setApproxVerseTimings([]);
      return;
    }
    setApproxVerseTimings(
      generateApproximateTimings(verses, playerDuration, APPROX_AUDIO_INTRO_LEAD_SECONDS)
    );
  }, [audioAvailable, vttCues, playerDuration, verses]);

  useEffect(() => {
    if (!pendingAutoPlayAfterSync) return;
    if (!audioAvailable || !audioUrl) {
      setPendingAutoPlayAfterSync(false);
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      setPendingAutoPlayAfterSync(false);
      return;
    }
    const launch = async () => {
      try {
        await startBibleAudioPlayback();
      } finally {
        setPendingAutoPlayAfterSync(false);
      }
    };
    void launch();
  }, [audioAvailable, audioUrl, pendingAutoPlayAfterSync, startBibleAudioPlayback]);

  useEffect(() => {
    return subscribeAudioFocus((state) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      if (isAudioFocusOwnedBy(audioFocusEntry, state)) return;
      audio.pause();
    });
  }, [audioFocusEntry]);

  useEffect(() => {
    return () => {
      audioFocusRequestIdRef.current = null;
      releaseAudioFocus({ id: audioFocusEntry.id, kind: audioFocusEntry.kind });
    };
  }, [audioFocusEntry]);

  useEffect(() => {
    setAudioHandlers({
      onTimeUpdate: () => {
        const audio = audioRef.current;
        if (!audio) return;
        const currentTime = audio.currentTime || 0;
        const cues = effectiveAudioCuesRef.current;

        if (cues.length === 0) {
          const fallbackVerse = approximateAudioSyncRef.current.verse;
          const fallbackProgress = fallbackVerse ? approximateAudioSyncRef.current.progress : 0;

          setActiveCueVerse((prev) => (prev === fallbackVerse ? prev : fallbackVerse));
          setActiveVerseProgress((prev) =>
            Math.abs(prev - fallbackProgress) < 0.01 ? prev : fallbackProgress
          );

          if (!fallbackVerse || audio.paused) {
            if (!fallbackVerse) lastAudioCueVerseRef.current = null;
            return;
          }
          if (lastAudioCueVerseRef.current === fallbackVerse) return;
          lastAudioCueVerseRef.current = fallbackVerse;
          scrollVerseIntoView(fallbackVerse, 'smooth');
          return;
        }

        const cue = cues.find((item) => currentTime >= item.start && currentTime < item.end) ?? null;
        const verse = cue?.verse ?? null;

        setActiveCueVerse((prev) => (prev === verse ? prev : verse));
        if (cue && verse) {
          const cueSpan = Math.max(0.001, cue.end - cue.start);
          const progress = Math.min(1, Math.max(0, (currentTime - cue.start) / cueSpan));
          setActiveVerseProgress((prev) => (Math.abs(prev - progress) < 0.01 ? prev : progress));
        } else {
          setActiveVerseProgress((prev) => (prev === 0 ? prev : 0));
        }

        if (!verse || audio.paused) {
          if (!verse) lastAudioCueVerseRef.current = null;
          return;
        }
        if (lastAudioCueVerseRef.current === verse) return;
        lastAudioCueVerseRef.current = verse;
        scrollVerseIntoView(verse, 'smooth');
      },
      onPlay: () => {
        if (!isAudioFocusOwnedBy(audioFocusEntry, getAudioFocusState())) {
          audioRef.current?.pause();
          return;
        }
      },
      onPause: () => {
        if (isAudioFocusOwnedBy(audioFocusEntry, getAudioFocusState())) {
          releaseAudioFocus({ id: audioFocusEntry.id, kind: audioFocusEntry.kind });
        }
      },
      onEnded: () => {
        setActiveCueVerse(null);
        setActiveVerseProgress(0);
        lastAudioCueVerseRef.current = null;
        if (isAudioFocusOwnedBy(audioFocusEntry, getAudioFocusState())) {
          releaseAudioFocus({ id: audioFocusEntry.id, kind: audioFocusEntry.kind });
        }
      }
    });
  }, [audioFocusEntry, scrollVerseIntoView, setAudioHandlers]);

  const togglePlayer = async () => {
    if (!audioAvailable || !audioUrl) {
      showToast(`Audio non disponible pour ${translation?.label ?? 'cette traduction'}`);
      return;
    }
    const alignedTranslationId = getSelahAudioAlignedTranslationId(translationId);
    if (alignedTranslationId && alignedTranslationId !== translationId) {
      setPendingAutoPlayAfterSync(true);
      setTranslationId(alignedTranslationId);
      showToast(`Texte synchronisé avec l'audio (${alignedTranslationId})`);
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      showToast('Audio non disponible');
      return;
    }
    try {
      if (audio.paused) {
        await startBibleAudioPlayback();
      } else {
        audio.pause();
      }
    } catch (error) {
      logger.error('[BibleReader] Strong token fetch error:', error);
      showToast("Impossible de lancer l'audio");
    }
  };

  const seekToAudioVerse = useCallback(
    (verseNumber: number) => {
      const segment = audioVerseSegments.find((item) => item.verse === verseNumber);
      if (!segment) return;

      const targetTime = Math.max(0, segment.start + 0.01);
      const audio = audioRef.current;
      if (!audio) return;

      const applySeek = () => {
        try {
          audio.currentTime = targetTime;
        } catch {
          return;
        }
        seekAudio(targetTime);
        setActiveCueVerse(verseNumber);
        lastAudioCueVerseRef.current = verseNumber;
      };

      const resolvedAudioUrl = audioUrl ? normalizeAudioSourceUrl(audioUrl) : '';
      const needsSource =
        Boolean(audioUrl) && (!audio.src || (audio.src !== resolvedAudioUrl && audio.currentSrc !== resolvedAudioUrl));

      if (needsSource && audioUrl) {
        audio.src = audioUrl;
        audio.load();
        const onLoaded = () => applySeek();
        audio.addEventListener('loadedmetadata', onLoaded, { once: true });
      } else {
        applySeek();
      }

      const verseRow = verses.find((verse) => verse.number === verseNumber);
      if (verseRow) {
        setSelectedVerse(verseRow);
      }
      scrollVerseIntoView(verseNumber, 'smooth');
    },
    [audioVerseSegments, audioUrl, verses, scrollVerseIntoView]
  );

  const playerProgress = playerDuration ? playerPosition / playerDuration : 0;
  const globalAudioProgress = Math.max(0, Math.min(1, playerProgress));
  const clampedMemoryMaskLevel = Math.max(2, Math.min(8, memoryMaskLevel));
  const adjustMemoryMaskLevel = (delta: number) => {
    setMemoryMaskLevel((prev) => Math.max(2, Math.min(8, prev + delta)));
  };

  const exportNotesPdf = () => {
    if (typeof window === 'undefined') return;
    const noteText = chapterNotes.trim();
    if (!noteText) {
      window.alert('Aucune note à exporter.');
      return;
    }
    const title = `${book.name} ${chapter}`;
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Notes - ${title}</title>
  <style>
    body { font-family: "Times New Roman", serif; padding: 32px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 0 0 24px; color: #555; }
    pre { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    .meta { font-size: 12px; color: #777; margin-bottom: 16px; }
  </style>
</head>
<body>
  <h1>Notes bibliques</h1>
  <h2>${title}</h2>
  <div class="meta">Exporté le ${new Date().toLocaleDateString('fr-FR')}</div>
  <pre>${noteText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  // Changement : Fonction améliorée pour basculer le surlignage avec couleur
  const toggleHighlight = (verse: VerseRow, color: HighlightColor = 'yellow') => {
    setSelectedVerse(verse);
    setHighlights((prev) => {
      const current = { ...(prev[referenceKey] ?? {}) };

      if (current[verse.number] === color) {
        delete current[verse.number];
      } else {
        current[verse.number] = color;
      }

      return { ...prev, [referenceKey]: current };
    });
  };

  const searchStrongByWord = async (wordNorm: string): Promise<StrongSearchResult[]> => {
    const cached = strongSearchCacheRef.current.get(wordNorm);
    if (cached) return cached;
    const results = await strongService.searchEntries(wordNorm);
    strongSearchCacheRef.current.set(wordNorm, results as StrongSearchResult[]);
    return results as StrongSearchResult[];
  };

  const inferStrongTokensFromVerseText = async (verse: VerseRow): Promise<StrongToken[]> => {
    const candidates = extractStrongCandidateWords(verse.text);
    if (!candidates.length) return [];
    const bookIndex = BIBLE_BOOKS.findIndex((item) => item.id === book.id);
    const expectedLanguage: 'hebrew' | 'greek' = bookIndex >= 39 ? 'greek' : 'hebrew';

    const matches = await Promise.all(
      candidates.map(async (candidate) => {
        const results = await searchStrongByWord(candidate.norm);
        if (!results.length) return null;
        const byWordMatch = results.filter((item) => {
          const wordInLsg = normalize(item.entry.lsg || '').includes(candidate.norm);
          const wordInMot = normalize(item.entry.mot || '').includes(candidate.norm);
          return wordInLsg || wordInMot;
        });
        const selected =
          byWordMatch.find((item) => item.language === expectedLanguage) ||
          byWordMatch[0] ||
          results.find((item) => item.language === expectedLanguage) ||
          results[0];
        return { candidate, selected };
      })
    );

    const tokens: StrongToken[] = [];
    const seen = new Set<string>();
    for (const match of matches) {
      if (!match) continue;
      const strong = `${match.selected.language === 'hebrew' ? 'H' : 'G'}${match.selected.number}`;
      if (seen.has(strong)) continue;
      seen.add(strong);
      tokens.push({
        w: match.candidate.raw,
        lang: match.selected.language,
        strong,
        originalForm: match.selected.entry.hebreu ?? match.selected.entry.grec,
        phonetic: match.selected.entry.phonetique,
      });
      if (tokens.length >= MAX_STRONG_WORDS) break;
    }

    return tokens;
  };

  const loadStrongTokensForVerse = async (verse: VerseRow): Promise<StrongToken[]> => {
    const cacheKey = `${book.id}:${chapter}:${verse.number}`;
    const cachedTokens = strongTokenCacheRef.current.get(cacheKey);
    if (cachedTokens) {
      setStrongTokens(cachedTokens);
      setStrongOpenFor({ bookId: book.id, chapter, verse: verse.number });
      return cachedTokens;
    }

    setStrongLoadingFor(cacheKey);
    try {
      let tokens: StrongToken[] = [];
      const mapping = await BibleVersesStrongMap.findStrongMappingsByText(
        book.id,
        chapter,
        verse.number,
        verse.text
      );

      if (mapping?.wordMappings?.length) {
        for (const wm of mapping.wordMappings) {
          const entry = await strongService.getEntry(wm.strongNumber, wm.language);
          if (!entry) continue;
          tokens.push({
            w: wm.word,
            lang: wm.language,
            strong: `${wm.language === 'hebrew' ? 'H' : 'G'}${wm.strongNumber}`,
            originalForm: wm.originalForm ?? entry.hebreu ?? entry.grec,
            phonetic: wm.phonetic ?? entry.phonetique,
          });
        }
      }

      if (!tokens.length) {
        tokens = await inferStrongTokensFromVerseText(verse);
      }

      if (!tokens.length) {
        setStrongTokens([]);
        setStrongOpenFor(null);
        return [];
      }

      strongTokenCacheRef.current.set(cacheKey, tokens);
      setStrongTokens(tokens);
      setStrongOpenFor({ bookId: book.id, chapter, verse: verse.number });
      return tokens;
    } finally {
      setStrongLoadingFor((prev) => (prev === cacheKey ? null : prev));
    }
  };

  useEffect(() => {
    if (!selectedVerse) {
      setStrongTokens([]);
      setStrongOpenFor(null);
      return;
    }
    if (
      strongOpenFor &&
      strongOpenFor.bookId === book.id &&
      strongOpenFor.chapter === chapter &&
      strongOpenFor.verse === selectedVerse.number &&
      strongTokens.length > 0
    ) {
      return;
    }
    void loadStrongTokensForVerse(selectedVerse);
  }, [selectedVerse?.number, book.id, chapter, strongOpenFor, strongTokens.length]);



  const commitVersePrimaryAction = (verse: VerseRow) => {
    setRadarOpen(false);
    setRadarRefsSheetOpen(false);
    setRadarPreferredBubble(null);
    setSelectedVerse(verse);

    if (tool === 'highlight') {
      toggleHighlight(verse, highlightColor);
      return;
    }

    if (tool === 'note') {
      setNoteOpenFor(verseKey(translation?.id ?? 'fr', book.id, chapter, verse.number));
      return;
    }

    setStudyBarOpen(true);
  };

  const handleLongPress = useCallback((verse: VerseRow) => {
    setLongPressTarget({
      verse,
      ref: `${book.name} ${chapter}:${verse.number}`,
    });
  }, [book.name, chapter]);



  const handleVerseDoubleTap = useCallback((verse: VerseRow) => {
    setRadarOpen(false);
    setRadarRefsSheetOpen(false);
    setRadarPreferredBubble(null);
    setStudyBarOpen(false);
    setSelectedVerse(verse);

    const nextActionRemovesHighlight = highlightMap[verse.number] === highlightColor;
    toggleHighlight(verse, highlightColor);
    showToast(nextActionRemovesHighlight ? 'Surlignage retiré ✅' : 'Verset surligné ✅');
  }, [highlightMap, highlightColor, toggleHighlight, showToast]);

  const prevChapter = () => {
    if (chapter > 1) {
      setChapter((prev) => prev - 1);
      return;
    }
    const index = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
    if (index > 0) {
      const prevBook = BIBLE_BOOKS[index - 1];
      setBookId(prevBook.id);
      setChapter(prevBook.chapters);
    }
  };

  const nextChapter = () => {
    if (chapter < book.chapters) {
      setChapter((prev) => prev + 1);
      return;
    }
    const index = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
    if (index < BIBLE_BOOKS.length - 1) {
      const nextBook = BIBLE_BOOKS[index + 1];
      setBookId(nextBook.id);
      setChapter(1);
    }
  };

  const handleEmbeddedReaderPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!embedded || event.pointerType !== 'touch') return;

    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        '[data-no-embedded-fullscreen="true"],input,select,textarea'
      )
    ) {
      return;
    }

    const now = Date.now();
    const previousTap = embeddedTapRef.current;
    embeddedTapRef.current = {
      timestamp: now,
      x: event.clientX,
      y: event.clientY,
    };

    if (!previousTap) return;
    if (now - previousTap.timestamp > EMBEDDED_DOUBLE_TAP_DELAY_MS) return;
    if (
      Math.abs(event.clientX - previousTap.x) > EMBEDDED_DOUBLE_TAP_MOVE_PX ||
      Math.abs(event.clientY - previousTap.y) > EMBEDDED_DOUBLE_TAP_MOVE_PX
    ) {
      return;
    }

    event.preventDefault();
    void toggleReaderFullscreen();
  };

  const openStrongViewerForVerse = async (verse: VerseRow | null = selectedVerse) => {
    if (!verse) {
      showToast(t('bible.toast.selectVerse'));
      return;
    }
    const tokens = await loadStrongTokensForVerse(verse);
    if (tokens.length === 0) {
      showToast(t('bible.toast.noStrong'));
      return;
    }
    setCurrentStrongNumber(tokens[0].strong);
    setShowStrongViewer(true);
  };

  const openInterlinearForVerse = () => {
    if (!selectedVerse) {
      showToast(t('bible.toast.selectVerse'));
      return;
    }
    setShowInterlinearViewer(true);
  };

  const openCompareForVerse = async (verse: VerseRow | null = selectedVerse) => {
    if (!verse) {
      showToast(t('bible.toast.selectVerse'));
      return;
    }
    setShowCompareViewer(true);
    setCompareLoading(true);
    try {
      const rows = await Promise.all(
        LOCAL_BIBLE_TRANSLATIONS.map(async (translationItem) => {
          try {
            const data = await loadChapterData(translationItem.id, book.id, chapter);
            const chapterRows: VerseRow[] = readBibleData(data, book, chapter);
            const row = chapterRows.find((item: VerseRow) => item.number === verse.number);
            return {
              id: translationItem.id,
              label: translationItem.label,
              sourceLabel: translationItem.sourceLabel,
              text: row?.text?.trim() || null,
            } satisfies CompareRow;
          } catch (err) {
            return {
              id: translationItem.id,
              label: translationItem.label,
              sourceLabel: translationItem.sourceLabel,
              text: null,
              error: readErrorMessage(err),
            } satisfies CompareRow;
          }
        })
      );
      setCompareRows(rows);
    } finally {
      setCompareLoading(false);
    }
  };

  type LongPressAction = 'strong' | 'refs' | 'note' | 'compare' | 'share' | 'mirror' | 'pepite';

  const handleLongPressAction = async (action: LongPressAction) => {
    if (!longPressTarget) return;
    const target = longPressTarget;
    setLongPressTarget(null);
    const { verse, ref } = target;
    setSelectedVerse(verse);
    switch (action) {
      case 'strong': {
        await openStrongViewerForVerse(verse);
        break;
      }
      case 'refs':
        openRefsForVerse(verse);
        break;
      case 'note':
        setNoteOpenFor(verseKey(translation?.id ?? 'fr', book.id, chapter, verse.number));
        showToast(`Note créée pour ${ref}`);
        break;
      case 'compare':
        await openCompareForVerse(verse);
        break;
      case 'share':
        setShareVerseTarget({ ref, text: verse.text });
        if (onSyncBible) {
          onSyncBible(ref, verse.text, { bookId: book.id, chapter, verse: verse.number });
        }
        break;
      case 'mirror': {
        setStudyBarOpen(false);
        setRadarOpen(false);
        setMirrorError(null);
        setMirrorModalOpen(true);
        setMirrorLoading(true);
        graceService.analyzeVerse(verse.text, `${book.name} ${chapter}:${verse.number}`)
          .then(res => {
            if (res.error) {
              setMirrorError(res.error);
            } else {
              setMirrorAnalysis(res.content);
            }
            setMirrorLoading(false);
          })
          .catch((err: unknown) => {
            setMirrorError(err instanceof Error ? err.message : 'Éclairage indisponible');
            setMirrorLoading(false);
          });
        break;
      }
      case 'pepite': {
        pepitesStore.save({
          reference: `${book.name} ${chapter}:${verse.number}`,
          text: verse.text,
          type: 'identity'
        });
        showToast('Pépite d\'Identité sauvegardée ! 💎');
        break;
      }
      default:
        break;
    }
  };

  const openAdvancedStudyTools = () => {
    if (!selectedVerse && verses.length > 0) {
      setSelectedVerse(verses[0]);
    }
    setShowAdvancedStudyTools(true);
  };

  useEffect(() => {
    if (!activeVerseId) return;
    if (tool !== 'read') return;
    if (verseSelectionPinned) return;

    const parts = activeVerseId.split('-');
    const verseNumber = Number(parts[parts.length - 1]);
    if (!Number.isFinite(verseNumber)) return;

    const row = verses.find((verse) => verse.number === verseNumber);
    if (!row) return;

    setSelectedVerse((prev) => (prev?.number === row.number ? prev : row));
  }, [activeVerseId, tool, verseSelectionPinned, verses]);

  useEffect(() => {
    if (!zenMode) {
      setUiHidden(false);
      if (scrollIdleRef.current) {
        clearTimeout(scrollIdleRef.current);
        scrollIdleRef.current = null;
      }
      return;
    }
    revealUI();
  }, [zenMode, book.id, chapter, revealUI]);

  useEffect(() => {
    setImmersiveMode(playerPlaying && immersiveEnabled);
    // Keep the screen awake during audio playback
    if (playerPlaying) {
      void KeepAwake.keepAwake().catch(() => {});
    } else {
      void KeepAwake.allowSleep().catch(() => {});
    }
  }, [playerPlaying, immersiveEnabled]);

  useEffect(() => {
    if (!ambientEnabled || !playerPlaying) {
      stopAmbientLayer(420);
      return;
    }
    void startAmbientLayer(currentBookMood);
  }, [ambientEnabled, playerPlaying, currentBookMood, startAmbientLayer, stopAmbientLayer]);

  useEffect(() => {
    setRadarOpen(false);
    setRadarRefsSheetOpen(false);
    setRadarPreferredBubble(null);
  }, [book.id, chapter, translation?.id, tool]);

  useEffect(() => {
    setStudyBarOpen(false);
  }, [book.id, chapter]);

  useEffect(() => {
    if (!selectedVerse) {
      setStudyBarOpen(false);
    }
  }, [selectedVerse]);

  useEffect(() => {
    return () => {
      stopAmbientLayer(180);
      audioEngine.dispose();
      if (scrollIdleRef.current) {
        clearTimeout(scrollIdleRef.current);
      }
    };
  }, [stopAmbientLayer]);

  useEffect(() => {
    setScrollProgress(0);
  }, [book.id, chapter, translation?.id]);

  useEffect(() => {
    const previous = chapterScenePosRef.current;
    if (previous !== null) {
      setChapterSceneDirection(chapterScenePosition >= previous ? 1 : -1);
    }
    chapterScenePosRef.current = chapterScenePosition;
  }, [chapterScenePosition]);

  useEffect(() => {
    const element = verseScrollRef.current;
    if (!element) return;
    element.scrollTop = 0;
  }, [chapterSceneKey]);

  return (
    <section
      ref={rootSectionRef}
      className={`relative transition-all duration-700 ${embedded ? 'bible-embedded-shell bible-enter h-full flex flex-col p-0 bg-transparent' : 'pb-24 sm:px-6 sm:pt-12 md:px-12'} 
        ${immersiveMode ? 'text-white' : ''} ${fullScreen ? 'fixed inset-0 z-[12000] overflow-hidden bg-background' : ''}`}
      style={{
        ['--accent' as any]: currentBookTheme.accent,
      }}
    >
      {/* Dynamic book-specific aura backgrounds */}
      {embedded ? (
        <>
          <div className="pointer-events-none absolute -top-20 left-1/3 h-52 w-52 rounded-full blur-3xl opacity-10" style={{ background: BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default }} />
          <div className="pointer-events-none absolute -bottom-20 right-8 h-56 w-56 rounded-full blur-3xl opacity-10" style={{ background: BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default }} />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -top-32 -left-16 h-[500px] w-[500px] rounded-full blur-3xl transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default}18 0%, ${BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default}05 40%, transparent 70%)` }} />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-[450px] w-[450px] rounded-full blur-3xl transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default}14 0%, ${BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default}04 40%, transparent 70%)` }} />
          <div className="pointer-events-none absolute inset-0 transition-colors duration-1000" style={{ background: `${BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default}02` }} />
        </>
      )}

      <div className={`mx-auto w-full ${embedded ? 'h-full min-h-0 flex flex-col' : 'max-w-6xl space-y-6'}`}>
        {/* Header Section (Flexible for both standard and embedded mode) */}
        <header className={`bible-paper transition-all duration-500 sm:rounded-[32px] sm:border sm:border-border-soft sm:bg-surface sm:shadow-sm
          ${embedded ? 'p-4 mb-2' : 'sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-3xl border-b border-border-soft/50 py-3 sm:static sm:z-auto sm:border sm:border-border-soft sm:bg-surface sm:p-8 md:p-12 mb-0 sm:mb-8'}`} 
        >
          <div className={`${embedded ? 'flex flex-wrap items-center justify-between gap-4' : 'flex flex-col gap-8'}`}>
            {/* 1. Identity & Status Row (Desktop) */}
            {!embedded && (
              <div className="hidden sm:flex items-end justify-between gap-6">
                <div className="space-y-1">
                  <div className="text-[11px] font-black uppercase tracking-[0.4em] text-accent/80 flex items-center gap-2">
                    <div className="h-px w-4 bg-accent/40" />
                    Parole
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight text-foreground md:text-6xl font-display">
                    La Parole <span className="text-accent/90 italic">vivante</span>
                  </h1>
                  <p className="max-w-xl text-sm sm:text-base font-medium leading-relaxed text-muted opacity-80">
                    Lis, médite et laisse la Parole te transformer.
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3 pb-2">
                  {!embedded && streakData.current > 0 && (
                    <div className="flex items-center gap-2.5 rounded-2xl bg-accent/5 px-4 py-2 ring-1 ring-accent/10 shadow-sm transition-all hover:bg-accent/8">
                      <span className="text-[11px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
                        <Flame size={14} className="fill-current animate-pulse" />
                        {streakData.current} jour{streakData.current > 1 ? 's' : ''} de feu
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.15em] text-amber-500 bg-amber-500/5 px-4 py-2 rounded-2xl border border-amber-500/10 shadow-inner">
                      <Flame size={12} className="text-amber-400" />
                      Pleine Puissance
                  </div>
                </div>
              </div>
            )}

            {/* 2. Main Navigation & Selection Control Center */}
            <div className={`flex flex-col sm:flex-row items-center gap-4 ${embedded ? 'flex-1' : ''}`}>
              {/* Selectors Group */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-foreground/5 sm:bg-background/50 border border-border-soft/30 w-full sm:w-auto overflow-x-auto no-scrollbar">
                <div className="relative group/select">
                  <select
                    value={translationId}
                    onChange={(e) => setTranslationId(e.target.value)}
                    className="cursor-pointer appearance-none rounded-xl bg-transparent px-3 py-2 text-[12px] sm:text-[13px] font-bold text-foreground outline-none transition-colors hover:text-accent"
                  >
                    {LOCAL_BIBLE_TRANSLATIONS.map((t) => (
                      <option key={t.id} value={t.id} className="bg-surface text-foreground">{t.id}</option>
                    ))}
                  </select>
                </div>
                
                <div className="h-4 w-[1px] bg-border-soft/50" />

                <div className="relative group/select">
                  <select
                    value={book.id}
                    onChange={(e) => {
                      setBookId(e.target.value);
                      setChapter(1);
                    }}
                    className="cursor-pointer appearance-none rounded-xl bg-transparent px-3 py-2 text-[12px] sm:text-[13px] font-bold text-foreground outline-none transition-colors hover:text-accent"
                  >
                    {BIBLE_BOOKS.map((b) => (
                      <option key={b.id} value={b.id} className="bg-surface text-foreground">{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="h-4 w-[1px] bg-border-soft/50" />

                <div className="relative group/select">
                  <select
                    value={chapter}
                    onChange={(e) => setChapter(Number(e.target.value))}
                    className="cursor-pointer appearance-none rounded-xl bg-transparent px-3 py-2 text-[12px] sm:text-[13px] font-bold text-foreground outline-none transition-colors hover:text-accent"
                  >
                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c} className="bg-surface text-foreground">Chap. {c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Player Navigation Group */}
              <div className="flex items-center gap-2 bg-foreground/5 sm:bg-background/50 p-1.5 rounded-2xl border border-border-soft/30 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevChapter}
                    className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-surface-strong transition-all active:scale-90 text-foreground/60 hover:text-foreground"
                    title="Chapitre précédent"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  
                  <button
                    type="button"
                    onClick={togglePlayer}
                    disabled={!audioAvailable}
                    className={`flex h-9 w-14 items-center justify-center rounded-xl transition-all ${
                      playerPlaying 
                        ? 'bg-accent text-white shadow-[0_8px_20px_rgba(var(--accent-rgb),0.3)]' 
                        : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/70 disabled:opacity-30'
                    }`}
                    title={playerPlaying ? "Pause" : "Lire l'audio"}
                  >
                    {playerPlaying ? <Pause size={18} fill="currentColor" stroke="none" /> : <Play size={18} fill="currentColor" stroke="none" />}
                  </button>

                  <button
                    type="button"
                    onClick={nextChapter}
                    className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-surface-strong transition-all active:scale-90 text-foreground/60 hover:text-foreground"
                    title="Chapitre suivant"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="flex sm:hidden h-9 w-px bg-border-soft/30 mx-2" />

                {/* Mobile Profile Avatar */}
                <Link 
                  href="/profile" 
                  className="flex sm:hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface-strong/60 overflow-hidden"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon size={18} className="text-accent" />
                  )}
                </Link>
              </div>

              {/* Journey (Parcours) Group - Highlighted */}
              <div className="w-full sm:w-auto sm:ml-auto">
                <div className="relative group/parcours">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-accent/20 to-amber-500/20 rounded-2xl blur opacity-30 group-hover/parcours:opacity-60 transition duration-500"></div>
                  <div className="relative flex items-center h-full">
                    <ReadingPlanWidget variant="button" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>


        {!embedded && (
          <>
            {/* Removed ReadingPlanWidget as it's now in the App Bar */}
          </>
        )}

        <div
          className={`grid gap-6 ${embedded
            ? 'h-full min-h-0 grid-cols-1'
            : 'lg:grid-cols-1'
            }`}
        >
          <main className={`relative flex flex-col ${embedded ? 'flex-1 min-h-0' : 'min-h-[60vh]'}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${book.id}-${chapter}-${translation?.id}`}
                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                {/* Paper/Kindle container */}
                <div
                  className={`bible-paper-kindle relative overflow-hidden transition-all duration-500 ${
                    embedded
                      ? 'flex-1 min-h-0 rounded-xl'
                      : 'mx-auto w-full max-w-4xl rounded-none border-x-0 sm:border-x sm:rounded-[20px]'
                  }`}
                >
                <div 
                  ref={verseScrollRef}
                  className={`custom-scrollbar touch-pan-y ${embedded ? 'flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4' : 'px-4 py-5 pb-48 sm:px-6 sm:py-8 sm:pb-60 md:px-10 lg:px-14'}`}
                  style={{ fontFamily: 'var(--font-merriweather), serif', fontSize: `${Math.round(18 * fontScale)}px`, lineHeight: 1.65 }}
                  onScroll={(e) => { const el = e.currentTarget; setScrollProgress(el.scrollTop / (el.scrollHeight - el.clientHeight)); }}
                >
                  {loading ? (
                    <BibleReaderSkeleton />
                  ) : error ? (
                     <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-12 text-center text-rose-500 backdrop-blur-md"><p className="font-bold">{error}</p></div>
                  ) : (
                    <div className="space-y-0">
                      {/* Decorative Drop-cap */}
                      {visibleVerses.length > 0 && (
                        <div className="mb-4 sm:mb-6 flex items-start gap-3 px-2 sm:px-4">
                          <div
                            className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-[10px] font-extrabold text-white text-xl sm:text-2xl shadow-lg"
                            style={{
                              background: `linear-gradient(135deg, ${BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default}, ${BOOK_AURA_COLORS[book.id] ?? BOOK_AURA_COLORS.default}99)`,
                            }}
                          >
                            {(visibleVerses[0]?.text?.[0] ?? '').toUpperCase()}
                          </div>
                          <div className="flex flex-col justify-center gap-1.5 pt-0.5">
                            <span className="text-[12px] font-semibold tracking-wide" style={{ color: 'var(--bible-paper-subtitle, rgba(0,0,0,0.45))' }}>
                              {book.name} {chapter}
                            </span>
                            <div className="h-[2px] w-10 rounded-full" style={{ background: 'var(--bible-paper-rule, rgba(0,0,0,0.1))' }} />
                          </div>
                        </div>
                      )}

                      {visibleVerses.map((verse) => (
                        <VerseItem
                          key={verse.number}
                          verse={verse}
                          isSelected={selectedVerse?.number === verse.number}
                          isAudioActive={activeCueVerse === verse.number}
                          highlightColor={highlightMap[verse.number]}
                          isPrismaMeditation={isPrismaMeditation}
                          searchVerse={searchVerse}
                          onTap={commitVersePrimaryAction}
                          onDoubleTap={handleVerseDoubleTap}
                          onLongPress={handleLongPress}
                          bookId={book.id}
                          renderTextWithSearchMatch={renderTextWithSearchMatch}
                        />
                      ))}

                      {currentMatchingReading && (
                        <div className="mt-16 mb-32 flex flex-col items-center px-4">
                          <div className="mb-6 h-[1px] w-24 bg-gradient-to-r from-transparent via-[#c89f2d]/30 to-transparent" />
                          <motion.button
                            onClick={() => {
                              setTriggerReflection(Date.now());
                              // Forced refresh for the memo
                              setTimeout(() => setTriggerReflection(0), 100);
                            }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05, y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            className="group relative flex items-center gap-3 overflow-hidden rounded-full bg-foreground px-8 py-4 text-background shadow-xl transition-all hover:shadow-accent/20"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            <Star size={18} className="text-accent" />
                            <span className="text-xs font-black uppercase tracking-[0.2em]">
                              {currentMatchingReading.isCompleted ? 'Revoir ma méditation' : 'Valider ma lecture'}
                            </span>
                            <div className="ml-1 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                          </motion.button>
                          {!currentMatchingReading.isCompleted && (
                            <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted">
                              Jour {currentMatchingReading.dayIndex + 1} du plan
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </div>{/* end paper container */}
              </motion.div>
            </AnimatePresence>
          </main>

          {noteOpenFor && (
            <div className="fixed inset-0 z-[15000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
              <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl border border-border-soft bg-surface-strong p-6 text-foreground shadow-[var(--shadow-soft)]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">
                    Note pour {book.name} {chapter}:{selectedVerse?.number}
                  </h3>
                  <button
                    onClick={() => setNoteOpenFor(null)}
                    className="text-foreground/55 transition-colors hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={verseNotes[noteOpenFor] || ''}
                  onChange={(e) => setVerseNotes((prev) => ({
                    ...prev,
                    [noteOpenFor]: e.target.value,
                  }))}
                  placeholder="Écrivez votre note ici..."
                  className="h-40 w-full rounded-lg border border-border-soft bg-surface p-3 text-foreground outline-none"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setNoteOpenFor(null)}
                    className="btn-base btn-primary"
                  >
                    Sauvegarder
                  </button>
                </div>
              </div>
            </div>
          )}

          <BibleLongPressSheet
            target={longPressTarget}
            onClose={() => setLongPressTarget(null)}
            onAction={handleLongPressAction}
            onHighlight={(color) => {
              if (longPressTarget) {
                toggleHighlight(longPressTarget.verse, color);
              }
            }}
          />

          <MyHighlightsModal
            isOpen={showHighlightsModal}
            onClose={() => setShowHighlightsModal(false)}
            highlights={highlights}
            onNavigate={(navBookId, navChapter, navVerse) => {
              setBookId(navBookId);
              setChapter(navChapter);
              setPendingFocusRef({ id: 'nav', label: 'nav', bookId: navBookId, chapter: navChapter, verse: navVerse });
            }}
            onRemoveHighlight={(refKey, vNum) => {
              setHighlights((prev) => {
                const map = { ...(prev[refKey] || {}) };
                delete map[vNum];
                if (Object.keys(map).length === 0) {
                  const next = { ...prev };
                  delete next[refKey];
                  return next;
                }
                return { ...prev, [refKey]: map };
              });
            }}
          />

          <BibleCompareModal
            isOpen={showCompareViewer}
            bookName={book.name}
            chapter={chapter}
            verseNumber={selectedVerse?.number ?? null}
            compareLoading={compareLoading}
            compareRows={compareRows}
            onClose={() => setShowCompareViewer(false)}
          />
        </div>
      </div>

      <audio ref={audioRef} preload="none" />
      <BibleMeditationBar
        open={Boolean(selectedVerse && studyBarOpen)}
        refLabel={studyRefLabel}
        verseText={studyVerseText}
        hasNote={studyHasNote}
        refsCount={selectedVerse ? treasuryRefs.length : 0}
        highlightColor={highlightColor}
        onClose={() => setStudyBarOpen(false)}
        onStrong={() => {
          setStudyBarOpen(false);
          void openStrongViewerForVerse(selectedVerse);
        }}
        onRefs={() => {
          setStudyBarOpen(false);
          openRefsForVerse(selectedVerse);
        }}
        onHighlight={() => {
          if (!selectedVerse) return;
          toggleHighlight(selectedVerse, highlightColor);
          showToast('Surlignage mis à jour ✅');
          setStudyBarOpen(false);
        }}
        onNote={() => {
          if (!studyNoteKey) return;
          setNoteOpenFor(studyNoteKey);
          setStudyBarOpen(false);
        }}
        onCompare={() => {
          setStudyBarOpen(false);
          void openCompareForVerse(selectedVerse);
        }}
        onCopy={() => {
          if (!selectedVerse) return;
          navigator.clipboard?.writeText(`${studyRefLabel}\n${selectedVerse.text}`);
          showToast('Verset copié ✅');
          setStudyBarOpen(false);
        }}
        strongTokens={selectedVerseStrongTokens}
        strongLoading={selectedVerseStrongLoading}
        onStrongToken={(strong) => {
          setCurrentStrongNumber(strong);
          setShowStrongViewer(true);
          setStudyBarOpen(false);
        }}
        onLectio={() => {
          if (!selectedVerse) return;
          setLectioVerse({ ref: `${book.name} ${chapter}:${selectedVerse.number}`, text: selectedVerse.text });
          setShowLectioDivina(true);
          setStudyBarOpen(false);
        }}
        onMemorize={() => {
          if (!selectedVerse) return;
          const ref = `${book.name} ${chapter}:${selectedVerse.number}`;
          memorizationStore.add(ref, selectedVerse.text);
          showToast('Verset ajouté à la mémorisation 📚');
          setStudyBarOpen(false);
        }}
        isMemorized={selectedVerse ? memorizationStore.has(`${book.name} ${chapter}:${selectedVerse.number}`) : false}
        onMirror={() => {
          if (!selectedVerse) return;
          const ref = `${book.name} ${chapter}:${selectedVerse.number}`;
          setStudyBarOpen(false);
          setMirrorError(null);
          setMirrorModalOpen(true);
          setMirrorLoading(true);
          graceService.analyzeVerse(selectedVerse.text, ref)
            .then(res => {
              if (res.error) {
                setMirrorError(res.error);
              } else {
                setMirrorAnalysis(res.content);
              }
              setMirrorLoading(false);
            })
            .catch((err: unknown) => {
              setMirrorError(err instanceof Error ? err.message : 'Éclairage indisponible');
              setMirrorLoading(false);
            });
        }}
      />
      <BibleStudyRadar
        open={radarOpen}
        x={radarPos.x}
        y={radarPos.y}
        refLabel={radarRefLabel}
        bubbles={radarBubbles}
        preferredBubbleId={radarPreferredBubble}
        onClose={() => {
          setRadarOpen(false);
          setRadarPreferredBubble(null);
        }}
      />
      {radarRefsSheetOpen ? (
        <div
          className="fixed inset-0 z-[16100] bg-black/30 backdrop-blur-[4px]"
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            setRadarRefsSheetOpen(false);
          }}
        >
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3 sm:p-4 md:items-center md:p-6">
            <div
              className="pointer-events-auto max-h-[78vh] w-full max-w-xl overflow-hidden rounded-t-[26px] rounded-b-[20px] border border-white/15 bg-black/65 p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,0.45)] sm:p-5 md:max-h-[72vh] md:rounded-[28px]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Radar</div>
                  <div className="text-base font-extrabold">Références croisées</div>
                  <div className="text-xs text-white/70">{radarRefLabel || `${book.name} ${chapter}`}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setRadarRefsSheetOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-white/80"
                  aria-label="Fermer les références"
                >
                  <X size={14} />
                </button>
              </div>

              {treasuryStatus === 'loading' ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
                  Chargement des références...
                </div>
              ) : null}

              {treasuryStatus === 'error' ? (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
                  <p>Impossible de charger les références pour le moment.</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!radarVerse) return;
                      void loadTreasuryRefs(book.id, chapter, radarVerse.number);
                    }}
                    className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
                  >
                    Réessayer
                  </button>
                </div>
              ) : null}

              {treasuryStatus === 'idle' && treasuryRefs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
                  Aucune référence disponible pour ce verset.
                </div>
              ) : null}

              {treasuryRefs.length > 0 ? (
                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1 md:max-h-[54vh]">
                  {treasuryRefs.slice(0, 18).map((ref) => (
                    <button
                      key={`radar-ref-${ref.id}`}
                      type="button"
                      onClick={() => {
                        setRadarRefsSheetOpen(false);
                        void openReferencePreview(ref);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-left transition hover:bg-white/15"
                    >
                      <span className="truncate text-sm font-bold">{ref.label}</span>
                      <span className="ml-3 shrink-0 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/75">
                        <Link2 size={12} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {referencePreview.open ? (
        <div
          className="fixed inset-0 z-[16200] bg-black/35 backdrop-blur-[6px]"
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            setReferencePreview({
              open: false,
              ref: null,
              rows: [],
              status: 'idle',
              error: null,
            });
          }}
        >
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3 sm:p-4 md:items-center md:p-6">
            <div
              className="pointer-events-auto max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-t-[26px] rounded-b-[20px] border border-white/15 bg-black/72 p-4 text-white shadow-[0_22px_70px_rgba(0,0,0,0.45)] sm:p-5 md:max-h-[74vh] md:rounded-[28px]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Référence</div>
                  <div className="text-base font-extrabold">Passage</div>
                  <div className="text-xs text-white/72">
                    {referencePreview.ref?.label ??
                      (referencePreviewBook
                        ? `${referencePreviewBook.name} ${referencePreview.ref?.chapter}:${referencePreview.ref?.verse}`
                        : '')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setReferencePreview({
                      open: false,
                      ref: null,
                      rows: [],
                      status: 'idle',
                      error: null,
                    })
                  }
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-white/80"
                  aria-label="Fermer le passage"
                >
                  <X size={14} />
                </button>
              </div>

              {referencePreview.status === 'loading' ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
                  Chargement du passage...
                </div>
              ) : null}

              {referencePreview.status === 'error' ? (
                <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
                  {referencePreview.error ?? 'Impossible de charger ce passage.'}
                </div>
              ) : null}

              {referencePreview.status !== 'loading' && referencePreview.status !== 'error' ? (
                <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1 md:max-h-[56vh]">
                  {referencePreview.rows.map((row) => {
                    const active = row.number === referencePreview.ref?.verse;
                    return (
                      <div
                        key={`preview-ref-verse-${row.number}`}
                        className={`rounded-xl border px-3 py-2 ${active
                          ? 'border-orange-300/45 bg-orange-400/16'
                          : 'border-white/12 bg-white/6'
                          }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/65">
                          Verset {row.number}
                        </div>
                        <div className="mt-1 text-sm leading-relaxed text-white/92">
                          {row.text}
                        </div>
                      </div>
                    );
                  })}
                  {referencePreview.rows.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/75">
                      Aucun texte disponible pour cette référence.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setReferencePreview({
                      open: false,
                      ref: null,
                      rows: [],
                      status: 'idle',
                      error: null,
                    })
                  }
                  className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white/85 transition hover:bg-white/15"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={!referencePreview.ref}
                  onClick={() => {
                    if (!referencePreview.ref) return;
                    navigateToVerse(referencePreview.ref);
                    setReferencePreview({
                      open: false,
                      ref: null,
                      rows: [],
                      status: 'idle',
                      error: null,
                    });
                  }}
                  className="rounded-xl border border-orange-300/45 bg-orange-400/25 px-3 py-2 text-xs font-bold text-orange-50 transition hover:bg-orange-400/35 disabled:opacity-50"
                >
                  Ouvrir le passage
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="fixed bottom-[calc(130px+env(safe-area-inset-bottom))] left-1/2 z-[13000] -translate-x-1/2 rounded-full bg-black/72 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur-md md:bottom-24">
          {toast}
        </div>
      ) : null}

      <div className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-0 right-0 z-[12500] px-3 sm:px-4 md:bottom-6 md:left-[90px] md:px-6 pointer-events-none">
        <div className="mx-auto max-w-4xl pointer-events-auto">
          <BibleToolbar
            tool={tool}
            setTool={setTool}
            onCopy={() => {
              if (!selectedVerse) return;
              navigator.clipboard?.writeText(`${book.name} ${chapter}:${selectedVerse.number}\n${selectedVerse.text}`);
              showToast('Verset copié ✅');
            }}
            onOpenCompare={() => {
              if (selectedVerse) void openCompareForVerse(selectedVerse);
              else setShowCompareViewer(true);
            }}
            highlightColor={highlightColor}
            setHighlightColor={setHighlightColor}
            onOpenAdvancedStudyTools={openAdvancedStudyTools}
            playerProgress={playerProgress}
            playerPlaying={playerPlaying}
            onTogglePlayer={togglePlayer}
            audioAvailable={audioAvailable}
            isClient={isClient}
            audioVerseSegments={audioVerseSegments}
            activeAudioVerseNumber={activeCueVerse}
            onSeekToAudioVerse={seekToAudioVerse}
            isPrismaMeditation={isPrismaMeditation}
            setIsPrismaMeditation={setIsPrismaMeditation}
            onOpenReflection={() => setShowReflectionSheet(true)}
          />
        </div>
      </div>

      <BibleStrongViewer
        isOpen={showStrongViewer}
        onClose={() => setShowStrongViewer(false)}
        strongNumber={currentStrongNumber || undefined}
      />
      <InterlinearViewer
        isOpen={showInterlinearViewer}
        onClose={() => setShowInterlinearViewer(false)}
        bookId={book.id}
        chapter={chapter}
        verse={selectedVerse?.number || 1}
        onStrongSelect={(strong) => {
          setCurrentStrongNumber(strong);
          setShowStrongViewer(true);
        }}
      />
      <AdvancedStudyTools
        isOpen={showAdvancedStudyTools}
        onClose={() => setShowAdvancedStudyTools(false)}
        bookId={book.id}
        chapter={chapter}
        verse={selectedVerse?.number || 1}
        selectedVerseText={selectedVerse?.text}
        strongTokens={strongTokens}
      />

      <ReflectionSheet
        isOpen={showReflectionSheet}
        onClose={() => setShowReflectionSheet(false)}
        onComplete={() => setShowReflectionSheet(false)}
        activeReading={standaloneReading}
        activeChapter={chapter}
        finalChapter={true}
      />

      {shareVerseTarget && (
        <ShareableVerseCard
          reference={shareVerseTarget.ref}
          text={shareVerseTarget.text}
          translation={translation?.id ?? 'LSG'}
          onClose={() => setShareVerseTarget(null)}
        />
      )}

      <GraceMirrorModal
        isOpen={mirrorModalOpen}
        onClose={() => { setMirrorModalOpen(false); setMirrorError(null); }}
        content={mirrorAnalysis}
        loading={mirrorLoading}
        error={mirrorError}
        reference={activeVerseReference || ''}
      />

      {showLectioDivina && lectioVerse && (
        <LectioDivina
          reference={lectioVerse.ref}
          verseText={lectioVerse.text}
          onClose={() => { setShowLectioDivina(false); setLectioVerse(null); }}
        />
      )}

      {showMemorization && (
        <VerseMemorizationSession onClose={() => setShowMemorization(false)} />
      )}
    </section>
  );
}
