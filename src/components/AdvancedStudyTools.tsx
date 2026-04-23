'use client';

import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import {
  X,
  Search,
  Link as LinkIcon,
  Bookmark,
  MessageSquare,
  Tag,
  BookText,
  BookOpen,
  Hash,
  BookOpenText,
  Plus,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  PenSquare,
} from 'lucide-react';
import strongService from '../services/strong-service';
import { parseStrong, type StrongToken } from '../lib/strongVerse';
import { extractTreasuryRefs, type NaveTopic, type TreasuryRef } from '../lib/bibleStudyClient';
import {
  parseBibleCommentaryResponse,
  parseBibleNaveResponse,
  parseBibleTreasuryResponse,
  type BibleCommentarySection,
} from '../lib/bibleStudyApi';

type StudyTab = 'tags' | 'links' | 'bookmarks' | 'notes' | 'strong';

type BookmarkItem = {
  id: string;
  ref: string;
  title: string;
  timestamp: Date;
};

type LinkItem = {
  id: string;
  ref: string;
  description: string;
};

type VerseWordItem = {
  details?: any;
  w?: string;
  word?: string;
  originalForm?: string;
  strong?: string;
  strong_number?: string;
  language?: string;
  phonetic?: string;
};

const PREDEFINED_TAGS = [
  { name: 'Foi', color: '#FF6B6B' },
  { name: 'Espérance', color: '#4ECDC4' },
  { name: 'Amour', color: '#FFD166' },
  { name: 'Prière', color: '#6A0572' },
  { name: 'Guérison', color: '#1A936F' },
  { name: 'Salut', color: '#114B5F' },
];

function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <h3 className="text-sm font-extrabold text-white">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-white/50">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex min-w-[108px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all',
        active
          ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20'
          : 'border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SoftActionButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer',
        danger
          ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
          : 'bg-white/8 text-white/70 hover:bg-white/15 hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function AdvancedStudyTools({
  isOpen,
  onClose,
  bookId,
  chapter,
  verse,
  selectedVerseText,
  strongTokens,
}: {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  chapter: number;
  verse: number;
  selectedVerseText?: string;
  strongTokens?: StrongToken[];
}) {
  const [activeTab, setActiveTab] = useState<StudyTab>('tags');

  const [verseTags, setVerseTags] = useState<string[]>([]);
  const [customTagName, setCustomTagName] = useState('');
  const [tagColor, setTagColor] = useState('#FFD700');

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [newLink, setNewLink] = useState({ ref: '', description: '' });

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarkTitle, setBookmarkTitle] = useState('');

  const [verseNotes, setVerseNotes] = useState('');

  const [strongSearch, setStrongSearch] = useState('');
  const [strongResults, setStrongResults] = useState<any[]>([]);
  const [verseWords, setVerseWords] = useState<VerseWordItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [naveTopics, setNaveTopics] = useState<NaveTopic[]>([]);
  const [naveLoading, setNaveLoading] = useState(false);
  const [naveError, setNaveError] = useState<string | null>(null);

  const [treasuryRefs, setTreasuryRefs] = useState<TreasuryRef[]>([]);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryError, setTreasuryError] = useState<string | null>(null);

  const [mhSections, setMhSections] = useState<BibleCommentarySection[]>([]);
  const [mhLoading, setMhLoading] = useState(false);
  const [mhError, setMhError] = useState<string | null>(null);

  const [autoTagsApplied, setAutoTagsApplied] = useState(false);

  const refKey = `${bookId}_${chapter}_${verse}`;
  const verseLabel = `${bookId} ${chapter}:${verse}`;

  const handleNaveLinksClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target && target.tagName === 'A') {
      event.preventDefault();
    }
  };

  const saveChanges = useCallback(() => {
    localStorage.setItem(`bible_tags_${refKey}`, JSON.stringify(verseTags));
    localStorage.setItem(`bible_links_${refKey}`, JSON.stringify(links));
    localStorage.setItem(`bible_notes_${refKey}`, verseNotes);
  }, [refKey, verseNotes, verseTags, links]);

  const closeWithSave = useCallback(() => {
    saveChanges();
    onClose();
  }, [onClose, saveChanges]);

  const loadVerseWords = useCallback(async (tokens: StrongToken[] | undefined) => {
    setLoading(true);
    try {
      if (tokens && tokens.length > 0) {
        const detailedWords = await Promise.all(
          tokens.map(async (token) => {
            const parsed = token.strong ? parseStrong(token.strong) : null;
            let entry = null;

            if (parsed) {
              entry = await strongService.getEntry(parsed.id, parsed.lang);
            }

            return {
              details: entry,
              ...token,
              strong_number: token.strong,
              language: parsed?.lang || 'greek',
              originalForm: token.w,
            };
          })
        );
        setVerseWords(detailedWords);
      } else {
        setVerseWords([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des mots Strong:', error);
      setVerseWords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const savedTags = localStorage.getItem(`bible_tags_${refKey}`);
    const savedLinks = localStorage.getItem(`bible_links_${refKey}`);
    const savedNotes = localStorage.getItem(`bible_notes_${refKey}`);
    const savedBookmarks = localStorage.getItem('bible_bookmarks');

    setVerseTags(savedTags ? JSON.parse(savedTags) : []);
    setLinks(savedLinks ? JSON.parse(savedLinks) : []);
    setVerseNotes(savedNotes || '');

    if (savedBookmarks) {
      try {
        const parsed = JSON.parse(savedBookmarks);
        setBookmarks(
          parsed.map((bookmark: any) => ({
            id: String(bookmark.id || Date.now()),
            ref: String(bookmark.ref || ''),
            title: String(bookmark.title || ''),
            timestamp: new Date(bookmark.timestamp || Date.now()),
          }))
        );
      } catch (e) {
        setBookmarks([]);
      }
    } else {
      setBookmarks([]);
    }

    if (activeTab === 'strong' && selectedVerseText) {
      void loadVerseWords(strongTokens);
    }
  }, [isOpen, refKey, activeTab, selectedVerseText, strongTokens, loadVerseWords]);

  useEffect(() => {
    setAutoTagsApplied(false);
  }, [bookId, chapter, verse]);

  useEffect(() => {
    if (!isOpen || !bookId || !chapter || !verse) return;
    let active = true;

    const loadNave = async () => {
      setNaveLoading(true);
      setNaveError(null);
      try {
        const res = await fetch(
          `/api/bible/nave?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}&verse=${verse}`
        );
        if (!res.ok) throw new Error(`Nave API error: ${res.status}`);
        const data = parseBibleNaveResponse(await res.json());
        if (!active) return;
        setNaveTopics(data.topics);
      } catch (error) {
        if (!active) return;
        console.error('Erreur Nave:', error);
        setNaveError('Impossible de charger les thèmes Nave.');
        setNaveTopics([]);
      } finally {
        if (active) setNaveLoading(false);
      }
    };

    const loadTreasury = async () => {
      setTreasuryLoading(true);
      setTreasuryError(null);
      try {
        const res = await fetch(
          `/api/bible/treasury?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}&verse=${verse}`
        );
        if (!res.ok) throw new Error(`Treasury API error: ${res.status}`);
        const data = parseBibleTreasuryResponse(await res.json());
        if (!active) return;
        setTreasuryRefs(extractTreasuryRefs(data.entries));
      } catch (error) {
        if (!active) return;
        console.error('Erreur Treasury:', error);
        setTreasuryError('Impossible de charger les références Treasury.');
        setTreasuryRefs([]);
      } finally {
        if (active) setTreasuryLoading(false);
      }
    };

    const loadMatthewHenry = async () => {
      setMhLoading(true);
      setMhError(null);
      try {
        const res = await fetch(
          `/api/bible/commentary?bookId=${encodeURIComponent(bookId)}&chapter=${chapter}`
        );
        if (!res.ok) throw new Error(`Bible commentary API error: ${res.status}`);
        const data = parseBibleCommentaryResponse(await res.json());
        if (!active) return;
        setMhSections(data.sections);
      } catch (error) {
        if (!active) return;
        console.error('Erreur commentaire biblique:', error);
        setMhError('Impossible de charger le commentaire biblique.');
        setMhSections([]);
      } finally {
        if (active) setMhLoading(false);
      }
    };

    void loadNave();
    void loadTreasury();
    void loadMatthewHenry();

    return () => {
      active = false;
    };
  }, [isOpen, bookId, chapter, verse]);

  useEffect(() => {
    if (!isOpen || autoTagsApplied || naveTopics.length === 0) return;

    setVerseTags((prev) => {
      if (prev.length > 0) return prev;
      const autoTags = naveTopics.slice(0, 6).map((topic) => `#8B5CF6:${topic.name}`);
      const unique = autoTags.filter((tag) => !prev.includes(tag));
      return [...prev, ...unique];
    });

    setAutoTagsApplied(true);
  }, [isOpen, naveTopics, autoTagsApplied]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeWithSave();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeWithSave]);

  const addTag = (tagName: string, color: string) => {
    const newTag = `${color}:${tagName}`;
    if (!verseTags.includes(newTag)) {
      setVerseTags((prev) => [...prev, newTag]);
    }
  };

  const removeTag = (tag: string) => {
    setVerseTags((prev) => prev.filter((t) => t !== tag));
  };

  const addCustomTag = () => {
    if (!customTagName.trim()) return;
    addTag(customTagName.trim(), tagColor);
    setCustomTagName('');
  };

  const addAllNaveTags = () => {
    if (naveTopics.length === 0) return;
    setVerseTags((prev) => {
      const extra = naveTopics.map((topic) => `#8B5CF6:${topic.name}`);
      const unique = extra.filter((tag) => !prev.includes(tag));
      return [...prev, ...unique];
    });
  };

  const addLink = () => {
    if (!newLink.ref.trim() || !newLink.description.trim()) return;

    const link = {
      id: Date.now().toString(),
      ref: newLink.ref.trim(),
      description: newLink.description.trim(),
    };

    setLinks((prev) => [...prev, link]);
    setNewLink({ ref: '', description: '' });
  };

  const addTreasuryLink = (refLabel: string) => {
    setLinks((prev) => {
      if (prev.some((link) => link.ref === refLabel)) return prev;
      return [
        ...prev,
        {
          id: Date.now().toString(),
          ref: refLabel,
          description: 'Référence Treasury',
        },
      ];
    });
  };

  const removeLink = (id: string) => {
    setLinks((prev) => prev.filter((link) => link.id !== id));
  };

  const addBookmark = () => {
    if (!bookmarkTitle.trim()) return;

    const bookmark = {
      id: Date.now().toString(),
      ref: verseLabel,
      title: bookmarkTitle.trim(),
      timestamp: new Date(),
    };

    const updatedBookmarks = [...bookmarks, bookmark];
    setBookmarks(updatedBookmarks);
    localStorage.setItem('bible_bookmarks', JSON.stringify(updatedBookmarks));
    setBookmarkTitle('');
  };

  const removeBookmark = (id: string) => {
    const updatedBookmarks = bookmarks.filter((bookmark) => bookmark.id !== id);
    setBookmarks(updatedBookmarks);
    localStorage.setItem('bible_bookmarks', JSON.stringify(updatedBookmarks));
  };

  const searchStrong = async () => {
    if (!strongSearch.trim()) return;

    setLoading(true);
    try {
      const results = await strongService.searchEntries(strongSearch.trim());
      const formattedResults = results.map((result) => ({
        ...result.entry,
        strong_number: result.number,
        language: result.language,
      }));
      setStrongResults(formattedResults);
    } catch (error) {
      console.error('Erreur lors de la recherche Strong:', error);
      setStrongResults([]);
    } finally {
      setLoading(false);
    }
  };

  const currentTabTitle = {
    tags: 'Thèmes & classification',
    links: 'Références liées',
    bookmarks: 'Repères personnels',
    notes: 'Notes d’étude',
    strong: 'Concordance Strong',
  }[activeTab];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[17000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      onClick={closeWithSave}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,#0f1117_0%,#121722_100%)] text-white shadow-[0_30px_100px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,159,45,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(56,125,255,0.10),transparent_22%)]" />

        <div className="relative z-10 border-b border-white/10 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                <BookOpenText size={12} />
                Étude avancée
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
                {currentTabTitle}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/60">
                <span className="rounded-full bg-white/5 px-3 py-1 font-semibold">{verseLabel}</span>
                {selectedVerseText ? (
                  <span className="max-w-[720px] truncate text-white/45">
                    “{selectedVerseText}”
                  </span>
                ) : null}
              </div>
            </div>

            <button
              onClick={closeWithSave}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Fermer et sauvegarder"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative z-10 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <TabButton active={activeTab === 'tags'} icon={<Tag size={16} />} label="Thèmes" onClick={() => setActiveTab('tags')} />
            <TabButton active={activeTab === 'links'} icon={<LinkIcon size={16} />} label="Références" onClick={() => setActiveTab('links')} />
            <TabButton active={activeTab === 'bookmarks'} icon={<Bookmark size={16} />} label="Repères" onClick={() => setActiveTab('bookmarks')} />
            <TabButton active={activeTab === 'notes'} icon={<MessageSquare size={16} />} label="Notes" onClick={() => setActiveTab('notes')} />
            <TabButton active={activeTab === 'strong'} icon={<BookText size={16} />} label="Strong" onClick={() => {
              setActiveTab('strong');
              if (selectedVerseText && verseWords.length === 0) {
                void loadVerseWords(strongTokens);
              }
            }} />
          </div>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {activeTab === 'tags' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard
                title="Thèmes rapides"
                subtitle="Ajoutez des catégories visuelles pour classer ce verset."
              >
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TAGS.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => addTag(tag.name, tag.color)}
                      className="rounded-full px-3 py-2 text-sm font-semibold transition hover:scale-[1.02] cursor-pointer"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Ajouter un thème personnalisé"
                subtitle="Créez votre propre classification."
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-transparent sm:w-14 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customTagName}
                    onChange={(e) => setCustomTagName(e.target.value)}
                    placeholder="Nom du thème"
                    className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35"
                  />
                  <button
                    onClick={addCustomTag}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-bold text-black transition hover:scale-[1.02] cursor-pointer"
                  >
                    <Plus size={16} />
                    Ajouter
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="Thèmes associés à ce verset"
                subtitle="Vos thèmes déjà reliés à cette référence."
              >
                {verseTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {verseTags.map((tag) => {
                      const [color, name] = tag.split(':');
                      return (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {name}
                          <button onClick={() => removeTag(tag)} className="text-current/80 hover:text-current cursor-pointer p-0.5">
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/55">Aucun thème enregistré pour ce verset.</p>
                )}
              </SectionCard>

              <SectionCard
                title="Thèmes Nave"
                subtitle="Suggestions bibliques liées à ce verset."
                right={
                  naveTopics.length > 0 ? (
                    <button
                      type="button"
                      onClick={addAllNaveTags}
                      className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-white/12 cursor-pointer"
                    >
                      Ajouter tous
                    </button>
                  ) : null
                }
              >
                {naveLoading ? (
                  <p className="text-sm text-white/55">Chargement des thèmes...</p>
                ) : naveError ? (
                  <p className="text-sm text-rose-300">{naveError}</p>
                ) : naveTopics.length === 0 ? (
                  <p className="text-sm text-white/55">Aucun thème trouvé pour ce verset.</p>
                ) : (
                  <div className="space-y-3">
                    {naveTopics.map((topic) => (
                      <details key={topic.name_lower} className="group rounded-2xl border border-white/8 bg-white/5 p-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-white">
                          <span>{topic.name}</span>
                          <div className="flex items-center gap-3">
                             <button
                                type="button"
                                onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                addTag(topic.name, '#8B5CF6');
                                }}
                                className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300 hover:bg-violet-500/25"
                            >
                                Ajouter
                            </button>
                             <ChevronDown size={14} className="text-white/30 transition-transform group-open:rotate-180" />
                          </div>
                        </summary>
                        <div
                          className="mt-3 text-sm leading-6 text-white/72 [&_a]:text-amber-300 [&_a]:underline"
                          onClick={handleNaveLinksClick}
                          dangerouslySetInnerHTML={{ __html: topic.description }}
                        />
                      </details>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard
                title="Ajouter une référence liée"
                subtitle="Créez vos propres ponts entre passages."
              >
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newLink.ref}
                    onChange={(e) => setNewLink({ ...newLink, ref: e.target.value })}
                    placeholder="Référence (ex: Rom 3:23)"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35"
                  />
                  <textarea
                    value={newLink.description}
                    onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                    placeholder="Description du lien"
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                  />
                  <button
                    onClick={addLink}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-bold text-black transition hover:scale-[1.02] cursor-pointer"
                  >
                    <Plus size={16} />
                    Ajouter le lien
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="Références enregistrées"
                subtitle="Vos liens personnels sur ce verset."
              >
                {links.length > 0 ? (
                  <div className="space-y-3">
                    {links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/5 p-4"
                      >
                        <div>
                          <div className="font-bold text-white">{link.ref}</div>
                          <div className="mt-1 text-sm leading-6 text-white/65">{link.description}</div>
                        </div>
                        <SoftActionButton danger onClick={() => removeLink(link.id)}>
                          Supprimer
                        </SoftActionButton>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/55">Aucune référence enregistrée pour ce verset.</p>
                )}
              </SectionCard>

              <SectionCard
                title="Références croisées"
                subtitle="Issues du Treasury of Scripture Knowledge."
              >
                {treasuryLoading ? (
                  <p className="text-sm text-white/55">Chargement des références...</p>
                ) : treasuryError ? (
                  <p className="text-sm text-rose-300">{treasuryError}</p>
                ) : treasuryRefs.length === 0 ? (
                  <p className="text-sm text-white/55">Aucune référence trouvée pour ce verset.</p>
                ) : (
                  <div className="space-y-2">
                    {treasuryRefs.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/5 p-4"
                      >
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <ChevronRight size={15} className="text-amber-300" />
                          {ref.label}
                        </div>
                        <button
                          type="button"
                          onClick={() => addTreasuryLink(ref.label)}
                          className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-white/12 cursor-pointer"
                        >
                          Ajouter
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {activeTab === 'bookmarks' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard
                title="Créer un repère"
                subtitle="Enregistrez ce verset dans votre bibliothèque personnelle."
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={bookmarkTitle}
                    onChange={(e) => setBookmarkTitle(e.target.value)}
                    placeholder="Nom du repère"
                    className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35"
                  />
                  <button
                    onClick={addBookmark}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-bold text-black transition hover:scale-[1.02] cursor-pointer"
                  >
                    <Bookmark size={16} />
                    Enregistrer
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="Vos repères"
                subtitle="Tous vos passages marqués."
              >
                {bookmarks.length > 0 ? (
                  <div className="space-y-3">
                    {bookmarks.map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/5 p-4"
                      >
                        <div>
                          <div className="font-bold text-white">{bookmark.title}</div>
                          <div className="mt-1 text-sm text-white/62">
                            {bookmark.ref} • {bookmark.timestamp.toLocaleDateString()}
                          </div>
                        </div>
                        <SoftActionButton danger onClick={() => removeBookmark(bookmark.id)}>
                          Supprimer
                        </SoftActionButton>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/55">Aucun repère enregistré.</p>
                )}
              </SectionCard>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="grid gap-5 xl:grid-cols-2">
              <SectionCard
                title="Notes sur ce verset"
                subtitle={`Référence active : ${verseLabel}`}
              >
                <div className="relative">
                    <PenSquare size={16} className="absolute top-4 left-4 text-white/20" />
                    <textarea
                    value={verseNotes}
                    onChange={(e) => setVerseNotes(e.target.value)}
                    placeholder="Écris ici ce que ce verset t’enseigne, t’éclaire ou te rappelle..."
                    className="min-h-[320px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 pl-12 text-sm leading-6 text-white outline-none transition-all focus:border-amber-400/30 focus:bg-white/10 placeholder:text-white/35"
                    />
                </div>
              </SectionCard>

              <SectionCard
                title="Commentaire"
                subtitle="Aide exégétique et observations complémentaires."
              >
                {mhLoading ? (
                  <p className="text-sm text-white/55">Chargement du commentaire...</p>
                ) : mhError ? (
                  <p className="text-sm text-rose-300">{mhError}</p>
                ) : mhSections.length === 0 ? (
                  <p className="text-sm text-white/55">Aucun commentaire pour ce chapitre.</p>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {mhSections.map((section) => (
                      <div
                        key={section.key}
                        className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm leading-6 text-white/75 [&_*]:text-white/75 [&_a]:text-amber-300 [&_a]:underline"
                        dangerouslySetInnerHTML={{ __html: section.html }}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {activeTab === 'strong' && (
            <div className="space-y-5">
              <SectionCard
                title="Explorer la concordance Strong"
                subtitle="Analyses grammaticales et racines originales du verset."
              >
                {loading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-amber-300" />
                  </div>
                ) : !selectedVerseText ? (
                  <div className="py-8 text-center text-white/55">
                    <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-40" />
                    <p>Sélectionnez un verset pour explorer les mots Strong correspondants.</p>
                  </div>
                ) : verseWords.length === 0 ? (
                  <div className="py-8 text-center text-white/55">
                    <p>Aucun mot Strong trouvé dans ce verset.</p>
                    <p className="mt-2 text-sm text-white/40">“{selectedVerseText}”</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-400/10 bg-amber-400/5 p-4">
                      <div className="text-sm italic leading-6 text-white/82">“{selectedVerseText}”</div>
                      <div className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-300/40">
                        {verseLabel}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {verseWords.map((word, index) => (
                        <div
                          key={`${word.strong_number || word.originalForm || word.w || index}-${index}`}
                          className="flex flex-col rounded-2xl border border-white/8 bg-white/5 p-4 transition-all hover:bg-white/10"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-white">
                                {word.originalForm || word.w || word.word}
                                </span>
                                {word.phonetic ? (
                                <span className="text-sm text-white/55">({word.phonetic})</span>
                                ) : null}
                            </div>
                            {word.strong_number ? (
                              <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                                {word.strong_number}
                              </span>
                            ) : null}
                          </div>

                          {word.details ? (
                            <div className="mt-3 flex-1">
                              <div
                                className="text-xs leading-5 text-white/70 [&_*]:text-white/70 [&_a]:text-amber-300 [&_a]:underline"
                                dangerouslySetInnerHTML={{
                                  __html: word.details.definition || word.details.def || '',
                                }}
                              />
                              {word.details.lsg ? (
                                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/50">
                                  <strong className="text-white/70 mr-2">LSG :</strong> {word.details.lsg}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-white/45">Définition non disponible localement.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              {strongResults.length > 0 || strongSearch ? (
                  <SectionCard
                    title="Recherche avancée"
                    subtitle="Trouvez un terme spécifique dans la concordance."
                  >
                  <div className="flex flex-col gap-3 sm:flex-row mb-6">
                    <input
                        type="text"
                        value={strongSearch}
                        onChange={(e) => setStrongSearch(e.target.value)}
                        placeholder="Ex: agape, hesed, G26..."
                        className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35"
                    />
                    <button
                        onClick={searchStrong}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 text-sm font-bold text-black transition hover:scale-[1.02] cursor-pointer"
                    >
                        <Search size={16} />
                        Chercher
                    </button>
                    </div>

                    {strongResults.length > 0 ? (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {strongResults.map((result, index) => (
                            <div
                            key={`${result.strong_number || result.number || index}-${index}`}
                            className="rounded-2xl border border-white/8 bg-white/5 p-4"
                            >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-amber-300">{result.strong_number || result.number}</span>
                                {result.transliteration ? (
                                <span className="text-sm font-bold text-white/80">{result.transliteration}</span>
                                ) : null}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-white/60">
                                {result.definition || result.gloss || 'Aucune définition disponible.'}
                            </div>
                            </div>
                        ))}
                        </div>
                    ) : strongSearch && (
                        <div className="text-center py-6 text-sm text-white/40">
                             Lancez la recherche pour voir les résultats.
                        </div>
                    )}
                  </SectionCard>
              ) : null}
            </div>
          )}
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-white/45">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Sauvegarde automatique active</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={closeWithSave}
              className="rounded-2xl bg-amber-400 px-6 py-3 text-sm font-extrabold text-black transition hover:scale-[1.02] cursor-pointer shadow-lg shadow-amber-400/20"
            >
              Enregistrer l’étude
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
