'use client';

import { useEffect, useMemo, useState } from 'react';
import { pepitesStore, Pepite } from '../../lib/pepitesStore';
import {
  BookOpen,
  Clock3,
  Filter,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type PepiteType = 'grace' | 'identity' | 'promise';
type FilterType = 'all' | PepiteType;
type SortType = 'recent' | 'oldest' | 'reference';

function getTypeIcon(type: PepiteType) {
  switch (type) {
    case 'grace':
      return <Sparkles className="h-4 w-4 text-emerald-500" />;
    case 'identity':
      return <ShieldCheck className="h-4 w-4 text-sky-500" />;
    case 'promise':
      return <Quote className="h-4 w-4 text-amber-500" />;
  }
}

function getTypeLabel(type: PepiteType) {
  switch (type) {
    case 'grace':
      return 'Grâce';
    case 'identity':
      return 'Identité';
    case 'promise':
      return 'Promesse';
  }
}

function getTypeStyles(type: PepiteType) {
  switch (type) {
    case 'grace':
      return {
        chip: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300',
        glow: 'from-emerald-500/12 to-transparent',
        accent: 'text-emerald-600 dark:text-emerald-300',
      };
    case 'identity':
      return {
        chip: 'bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300',
        glow: 'from-sky-500/12 to-transparent',
        accent: 'text-sky-600 dark:text-sky-300',
      };
    case 'promise':
      return {
        chip: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300',
        glow: 'from-amber-500/12 to-transparent',
        accent: 'text-amber-600 dark:text-amber-300',
      };
  }
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[26px] border border-border-soft bg-surface/90 p-5 shadow-sm transition-all hover:border-border-strong hover:shadow-md">
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-surface-strong opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-strong shadow-inner">
          {icon}
        </div>
        <div className="text-3xl font-black tracking-tight text-foreground">{value}</div>
        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">
          {label}
        </div>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-xs font-black transition-all',
        active
          ? 'bg-[color:var(--foreground)] text-[color:var(--surface)] shadow-lg'
          : 'border border-border-soft bg-surface text-foreground/60 hover:border-border-strong hover:bg-surface-strong',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
      <span
        className={[
          'rounded-full px-2 py-0.5 text-[10px] font-black',
          active ? 'bg-white/20 text-white' : 'bg-surface-strong text-foreground/40',
        ].join(' ')}
      >
        {count}
      </span>
    </button>
  );
}

function DeleteConfirmModal({
  pepite,
  onCancel,
  onConfirm,
}: {
  pepite: Pepite | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!pepite) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [pepite]);

  if (!pepite) return null;

  return (
    <div className="fixed inset-0 z-[20002] flex items-end justify-center bg-black/60 p-4 transition-all animate-in fade-in duration-300 backdrop-blur-md sm:items-center">
      <div className="w-full max-w-md rounded-[40px] border border-white/10 bg-surface p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <Trash2 className="h-8 w-8" />
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-black tracking-tight text-foreground">Supprimer ce trésor ?</h3>
          <p className="mt-3 text-sm leading-relaxed text-foreground/60">
            Cette action est irréversible. Ce verset et vos notes associées seront définitivement retirés de votre bibliothèque.
          </p>
        </div>

        <div className="mt-7 rounded-[24px] border border-border-soft bg-surface-strong/50 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--accent)]">
            {pepite.reference}
          </div>
          <p className="mt-2 line-clamp-2 text-sm italic leading-relaxed text-foreground/80">
            “{pepite.text}”
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-border-soft bg-surface-strong px-4 py-4 text-sm font-black text-foreground/70 transition-all active:scale-95"
          >
            Garder
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-rose-600 px-4 py-4 text-sm font-black text-white shadow-xl shadow-rose-600/20 transition-all hover:bg-rose-700 active:scale-95"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function PepiteCard({
  pepite,
  onDelete,
}: {
  pepite: Pepite;
  onDelete: () => void;
}) {
  const styles = getTypeStyles(pepite.type as PepiteType);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[36px] border border-border-soft bg-surface p-7 transition-all hover:-translate-y-1 hover:border-border-strong hover:shadow-2xl hover:shadow-black/[0.04]">
      {/* Decorative Gradient Glow */}
      <div className={`pointer-events-none absolute inset-x-0 -top-10 h-40 bg-gradient-to-b opacity-40 blur-3xl transition-opacity group-hover:opacity-60 ${styles.glow}`} />

      <div className="relative flex h-full flex-col">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className={`inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] ${styles.chip}`}>
            {getTypeIcon(pepite.type as PepiteType)}
            {getTypeLabel(pepite.type as PepiteType)}
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="grid h-11 w-11 place-items-center rounded-2xl text-foreground/20 transition-all hover:bg-rose-500/10 hover:text-rose-500 group-hover:text-foreground/40"
            title="Supprimer"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mb-4">
          <div className={`text-[11px] font-black uppercase tracking-[0.22em] ${styles.accent}`}>
            {pepite.reference}
          </div>
        </div>

        <blockquote className="flex-1">
          <p className="text-[17px] font-medium leading-[1.8] text-foreground/90 sm:text-[18px]">
            <span className="font-serif italic text-foreground/40">“</span>
            <span className="font-serif italic">{pepite.text}</span>
            <span className="font-serif italic text-foreground/40">”</span>
          </p>
        </blockquote>

        {pepite.note ? (
          <div className="mt-7 rounded-[24px] border border-border-soft bg-surface-strong/40 p-5">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">
              Note de méditation
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/65">{pepite.note}</p>
          </div>
        ) : null}

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-border-soft pt-5">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-foreground/35">
            <Clock3 className="h-3.5 w-3.5 opacity-60" />
            <span>
              Célébré {formatDistanceToNow(new Date(pepite.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function IdentityTreasures() {
  const [pepites, setPepites] = useState<Pepite[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortType>('recent');
  const [deleteTarget, setDeleteTarget] = useState<Pepite | null>(null);

  useEffect(() => {
    const reload = () => setPepites(pepitesStore.load());
    reload();

    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, []);

  const stats = useMemo(() => {
    return {
      total: pepites.length,
      identity: pepites.filter((p) => p.type === 'identity').length,
      grace: pepites.filter((p) => p.type === 'grace').length,
      promise: pepites.filter((p) => p.type === 'promise').length,
    };
  }, [pepites]);

  const filteredPepites = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = pepites.filter((p) => {
      const matchesFilter = filter === 'all' || p.type === filter;
      const matchesSearch =
        !q ||
        p.reference.toLowerCase().includes(q) ||
        p.text.toLowerCase().includes(q) ||
        (p.note ?? '').toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });

    result.sort((a, b) => {
      if (sort === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return a.reference.localeCompare(b.reference, 'fr');
    });

    return result;
  }, [pepites, filter, search, sort]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    pepitesStore.remove(deleteTarget.id);
    setPepites((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Editorial Header Section */}
        <section className="relative overflow-hidden rounded-[42px] border border-border-soft bg-surface/80 p-8 shadow-sm sm:p-10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[color:var(--accent)] opacity-[0.03] blur-3xl" />
          
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-[color:var(--accent)]/10 bg-[color:var(--accent)]/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[color:var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                Patrimoine Spirituel
              </div>

              <h2 className="mt-5 text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                Bibliothèque de trésors
              </h2>

              <p className="mt-4 text-[15px] leading-relaxed text-foreground/60">
                L'archive personnalisée de votre identité révélée. Chaque pépite est une ancre pour votre 
                vie de foi, un miroir de la grâce inépuisable du Père.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:min-w-[560px]">
              <StatCard label="Trésors" value={stats.total} icon={<BookOpen className="h-5 w-5 text-[color:var(--accent)]" />} />
              <StatCard label="Identité" value={stats.identity} icon={<ShieldCheck className="h-5 w-5 text-sky-500" />} />
              <StatCard label="Grâce" value={stats.grace} icon={<Sparkles className="h-5 w-5 text-emerald-500" />} />
              <StatCard label="Promesses" value={stats.promise} icon={<Quote className="h-5 w-5 text-amber-500" />} />
            </div>
          </div>
        </section>

        {/* Toolbar & Filters */}
        <section className="flex flex-col gap-5 rounded-[36px] border border-border-soft bg-surface/80 p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2.5">
            <FilterPill active={filter === 'all'} label="Tout" count={stats.total} icon={<Filter className="h-3.5 w-3.5" />} onClick={() => setFilter('all')} />
            <FilterPill active={filter === 'identity'} label="Identité" count={stats.identity} icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setFilter('identity')} />
            <FilterPill active={filter === 'grace'} label="Grâce" count={stats.grace} icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => setFilter('grace')} />
            <FilterPill active={filter === 'promise'} label="Promesses" count={stats.promise} icon={<Quote className="h-3.5 w-3.5" />} onClick={() => setFilter('promise')} />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
              <input
                type="text"
                placeholder="Chercher une pépite..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 w-full min-w-[280px] rounded-2xl border border-border-soft bg-surface-strong/50 pl-11.5 pr-10 text-sm font-medium text-foreground outline-none transition focus:border-[color:var(--accent)] focus:bg-surface"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-foreground/30 hover:bg-surface-strong hover:text-foreground/60">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative group">
              <ArrowUpDown className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/40" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortType)}
                className="h-12 appearance-none rounded-2xl border border-border-soft bg-surface-strong/50 pl-10 pr-10 text-xs font-black text-foreground/70 outline-none transition hover:border-border-strong focus:border-[color:var(--accent)] cursor-pointer"
              >
                <option value="recent">Plus récentes</option>
                <option value="oldest">Plus anciennes</option>
                <option value="reference">Par référence</option>
              </select>
            </div>
          </div>
        </section>

        {/* Treasures Grid */}
        {filteredPepites.length > 0 ? (
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredPepites.map((pepite) => (
              <PepiteCard
                key={pepite.id}
                pepite={pepite}
                onDelete={() => setDeleteTarget(pepite)}
              />
            ))}
          </section>
        ) : (
          <section className="flex flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-border-soft bg-surface/40 px-6 py-24 text-center">
            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[32px] bg-[color:var(--accent)]/5">
              <Sparkles className="h-10 w-10 text-[color:var(--accent)] opacity-40" />
            </div>

            <h3 className="text-2xl font-black text-foreground">Aucune pépite à afficher</h3>

            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-foreground/50">
              Le silence n'est pas une absence. Votre Miroir de Grâce attend de révéler votre identité dans le lecteur biblique.
            </p>
            
            <p className="mt-8 text-[11px] font-black uppercase tracking-[0.25em] text-[color:var(--accent)] opacity-80">
              #RévélationIdentitaire
            </p>
          </section>
        )}
      </div>

      <DeleteConfirmModal
        pepite={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
