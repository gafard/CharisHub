'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Search,
  Volume2,
  BookOpen,
  Hash,
  Languages,
  ScrollText,
  Library,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import StrongService, { type StrongEntry, type StrongOccurrence } from '../services/strong-service';

type StrongRef = { number: string; language: 'hebrew' | 'greek' };

function errorMessage(err: unknown, fallback = 'Erreur inconnue') {
  return err instanceof Error ? err.message : fallback;
}

function normalizeStrongNumber(value?: string): StrongRef | null {
  if (!value) return null;
  const raw = value.trim();

  const hebrewMatch = raw.match(/^hebrew[_-]?(\d+)$/i);
  if (hebrewMatch) return { number: hebrewMatch[1], language: 'hebrew' };

  const greekMatch = raw.match(/^greek[_-]?(\d+)$/i);
  if (greekMatch) return { number: greekMatch[1], language: 'greek' };

  const prefixedMatch = raw.match(/^([HG])(\d+)$/i);
  if (prefixedMatch) {
    return {
      number: prefixedMatch[2],
      language: prefixedMatch[1].toUpperCase() === 'H' ? 'hebrew' : 'greek',
    };
  }

  const numericMatch = raw.match(/^(\d+)$/);
  if (numericMatch) {
    const num = Number(numericMatch[1]);
    return { number: numericMatch[1], language: num <= 5624 ? 'greek' : 'hebrew' };
  }

  return null;
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-amber-300">
              {icon}
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-extrabold text-white">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-xs leading-5 text-white/55">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-2xl px-4 py-3 text-sm font-bold transition-all cursor-pointer',
        active
          ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/20'
          : 'border border-white/10 bg-white/[0.04] text-white/68 hover:bg-white/[0.08] hover:text-white',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export default function BibleStrongViewer({
  isOpen,
  onClose,
  strongNumber,
}: {
  isOpen: boolean;
  onClose: () => void;
  strongNumber?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentEntry, setCurrentEntry] = useState<StrongEntry | null>(null);
  const [resolvedStrong, setResolvedStrong] = useState<StrongRef | null>(null);
  const [searchResults, setSearchResults] = useState<
    { number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }[]
  >([]);
  const [activeTab, setActiveTab] = useState<'details' | 'search'>('details');
  const [loading, setLoading] = useState(false);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<StrongOccurrence[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (strongNumber && isOpen) {
      const normalized = normalizeStrongNumber(strongNumber);

      if (!normalized) {
        setError(`Format Strong invalide: ${strongNumber}`);
        setCurrentEntry(null);
        setResolvedStrong(null);
        setOccurrences([]);
        setLoading(false);
        setOccurrencesLoading(false);
        return;
      }

      setResolvedStrong(normalized);
      setLoading(true);
      setOccurrencesLoading(true);
      setError(null);
      setOccurrences([]);

      Promise.all([
        StrongService.getEntry(normalized.number, normalized.language),
        StrongService.getOccurrences(normalized.number, normalized.language, 12),
      ])
        .then(([entry, related]) => {
          if (cancelled) return;

          if (entry) {
            setCurrentEntry(entry);
            setActiveTab('details');
          } else {
            setCurrentEntry(null);
            setError(`Aucune entrée trouvée pour le numéro Strong ${normalized.number}`);
          }

          setOccurrences(related);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(`Erreur lors du chargement de l'entrée Strong: ${errorMessage(err)}`);
          console.error(err);
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          setOccurrencesLoading(false);
        });
    } else if (!strongNumber) {
      setResolvedStrong(null);
      setCurrentEntry(null);
      setOccurrences([]);
      setLoading(false);
      setOccurrencesLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [strongNumber, isOpen]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await StrongService.searchEntries(searchTerm.trim());
      setSearchResults(results);
      setActiveTab('search');
    } catch (err: unknown) {
      setError(`Erreur lors de la recherche: ${errorMessage(err)}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedSearchResult = async (
    result: { number: string; entry: StrongEntry; language: 'hebrew' | 'greek' }
  ) => {
    setCurrentEntry(result.entry);
    setResolvedStrong({ number: result.number, language: result.language });
    setActiveTab('details');
    setSearchTerm('');
    setOccurrences([]);
    setOccurrencesLoading(true);

    try {
      const items = await StrongService.getOccurrences(result.number, result.language, 12);
      setOccurrences(items || []);
    } catch (err) {
       console.error(err);
    } finally {
      setOccurrencesLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Enter' && activeTab === 'search') {
        event.preventDefault();
        void handleSearch();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, activeTab, searchTerm]);

  if (!isOpen) return null;

  const strongCode = resolvedStrong
    ? `${resolvedStrong.language === 'hebrew' ? 'H' : 'G'}${resolvedStrong.number}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[16000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
      onMouseDown={onClose}
    >
      <div
        className="relative flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,#0f1117_0%,#121722_100%)] text-white shadow-[0_35px_110px_rgba(0,0,0,0.5)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,159,45,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(56,125,255,0.10),transparent_22%)]" />

        <div className="relative z-10 border-b border-white/10 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                <Sparkles size={12} />
                Concordance Strong
              </div>

              <h2 className="mt-3 flex items-center gap-3 text-2xl font-black tracking-tight text-white">
                <BookOpen size={24} className="text-amber-300" />
                Lexique biblique
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/58">
                Explorez les racines grecques et hébraïques, les définitions, la translittération et les autres occurrences bibliques.
              </p>
            </div>

            <button
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white cursor-pointer"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative z-10 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <TabButton active={activeTab === 'details'} label="Détails" onClick={() => setActiveTab('details')} />
            <TabButton active={activeTab === 'search'} label="Recherche" onClick={() => setActiveTab('search')} />
          </div>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-amber-300" />
            </div>
          ) : error ? (
            <div className="flex h-40 items-center justify-center">
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">
                {error}
              </div>
            </div>
          ) : activeTab === 'details' ? (
            currentEntry ? (
              <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-5">
                  <SectionCard
                    title="Fiche Strong"
                    subtitle="Informations lexicales principales"
                    icon={<Hash size={18} />}
                  >
                    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {strongCode ? (
                              <span className="rounded-full bg-amber-400/12 px-3 py-1 text-xs font-bold text-amber-300">
                                {strongCode}
                              </span>
                            ) : null}

                            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/60">
                              {currentEntry.type}
                            </span>

                            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/60">
                              {currentEntry.origine}
                            </span>
                          </div>

                          <h3 className="mt-4 text-2xl font-black text-white">
                            {currentEntry.mot}
                          </h3>

                          {currentEntry.phonetique ? (
                            <p className="mt-1 text-sm text-amber-300">
                              {currentEntry.phonetique}
                            </p>
                          ) : null}
                        </div>

                        <button
                          className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-amber-300 transition hover:bg-white/10 cursor-not-allowed"
                          aria-label="Prononciation (bientôt)"
                          title="Prononciation (bientôt)"
                        >
                          <Volume2 size={18} />
                        </button>
                      </div>

                      {(currentEntry.hebreu || currentEntry.grec) ? (
                        <div className="mt-5 rounded-[20px] border border-white/8 bg-black/20 px-4 py-5 text-center">
                          <div className="text-4xl font-semibold tracking-wide text-white">
                            {currentEntry.hebreu || currentEntry.grec}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="Définition"
                    subtitle="Sens lexical et nuances du terme"
                    icon={<ScrollText size={18} />}
                  >
                    <div
                      className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-white/80 [&_*]:text-white/80 [&_a]:text-amber-300 [&_a]:underline prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: currentEntry.definition }}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Traduction LSG"
                    subtitle="Rendu principal dans la Louis Segond"
                    icon={<Languages size={18} />}
                  >
                    <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-white/80">
                      {currentEntry.lsg}
                    </div>
                  </SectionCard>
                </div>

                <div className="space-y-5">
                  <SectionCard
                    title="Autres passages"
                    subtitle="Occurrences liées à ce mot Strong"
                    icon={<Library size={18} />}
                  >
                    {occurrencesLoading ? (
                      <div className="flex h-32 items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-amber-300" />
                      </div>
                    ) : occurrences.length > 0 ? (
                      <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                        {occurrences.map((item) => (
                          <div
                            key={`${item.reference}-${item.strong}`}
                            className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 group hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                              {item.reference}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-white/72">
                              {item.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/55">
                        Aucun autre passage trouvé pour ce mot Strong.
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center">
                <div className="max-w-md text-center text-white/55">
                  {resolvedStrong
                    ? `Aucune entrée Strong trouvée pour le numéro ${resolvedStrong.number}.`
                    : 'Sélectionnez un numéro Strong pour afficher sa fiche détaillée.'}
                </div>
              </div>
            )
          ) : (
            <div className="space-y-5">
              <SectionCard
                title="Recherche Strong"
                subtitle="Recherchez par mot, translittération ou numéro Strong"
                icon={<Search size={18} />}
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                      size={18}
                    />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Ex: agape, G26, hesed..."
                      className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-11 pr-4 text-sm text-white outline-none transition-focus placeholder:text-white/35 focus:border-amber-400/30"
                    />
                  </div>

                  <button
                    onClick={handleSearch}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-bold text-black transition hover:scale-[1.02] cursor-pointer"
                  >
                    <Search size={16} />
                    Rechercher
                  </button>
                </div>
              </SectionCard>

              {searchResults.length > 0 ? (
                <SectionCard
                  title={`Résultats (${searchResults.length})`}
                  subtitle="Cliquez sur une entrée pour ouvrir sa fiche"
                  icon={<BookOpen size={18} />}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {searchResults.map((result, index) => (
                      <button
                        key={`${result.language}-${result.number}-${index}`}
                        type="button"
                        onClick={() => void loadSelectedSearchResult(result)}
                        className="w-full rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06] hover:border-amber-400/20 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-amber-400/12 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                                {result.language === 'hebrew' ? `H${result.number}` : `G${result.number}`}
                              </span>

                              <span className="text-sm font-bold text-white truncate">
                                {result.entry.mot}
                              </span>
                            </div>

                            <div className="mt-2 text-xs text-white/60 line-clamp-1">
                              {result.entry.type} • {result.entry.lsg}
                            </div>
                          </div>

                          <div className="text-xl text-white/88 shrink-0">
                            {result.entry.hebreu || result.entry.grec}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              ) : searchTerm ? (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-8 text-center text-white/55">
                  Aucun résultat trouvé pour “{searchTerm}”.
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-12 text-center text-white/55">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/30">
                    <Search size={24} />
                  </div>
                  <p>Entrez un terme pour lancer la recherche dans la concordance Strong.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative z-10 border-t border-white/10 px-5 py-4 text-[10px] font-medium uppercase tracking-[0.1em] text-white/35 sm:px-6">
          Concordance Strong • Étude lexicale biblique • CharisHub
        </div>
      </div>
    </div>
  );
}
