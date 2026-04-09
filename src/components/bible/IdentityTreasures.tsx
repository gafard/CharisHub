'use client';

import { useState, useEffect } from 'react';
import { pepitesStore, Pepite } from '../../lib/pepitesStore';
import { Sun, Trash2, BookOpen, Quote, ShieldCheck, Search, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function IdentityTreasures() {
  const [pepites, setPepites] = useState<Pepite[]>([]);
  const [filter, setFilter] = useState<'all' | 'grace' | 'identity' | 'promise'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setPepites(pepitesStore.load());
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('Supprimer ce trésor ?')) {
      pepitesStore.remove(id);
      setPepites(pepitesStore.load());
    }
  };

  const filteredPepites = pepites.filter(p => {
    const matchesFilter = filter === 'all' || p.type === filter;
    const matchesSearch = p.reference.toLowerCase().includes(search.toLowerCase()) || 
                          p.text.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'grace': return <Sun className="h-4 w-4 text-emerald-500" />;
      case 'identity': return <ShieldCheck className="h-4 w-4 text-sky-500" />;
      case 'promise': return <Quote className="h-4 w-4 text-amber-500" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'grace': return 'Grâce';
      case 'identity': return 'Identité';
      case 'promise': return 'Promesse';
      default: return 'Trésor';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">Bibliothèque de Pépites</h2>
          <p className="text-sm text-[color:var(--foreground)]/60">Vos trésors d'identité et de grâce découverts dans la Parole.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--foreground)]/40" />
            <input 
              type="text" 
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] pl-10 pr-4 text-sm focus:border-[color:var(--accent-border)] focus:outline-none sm:w-64"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${filter === 'all' ? 'bg-[color:var(--accent)] text-white shadow-lg shadow-[color:var(--accent)]/20' : 'bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] text-[color:var(--foreground)]/70 hover:border-[color:var(--border-strong)]'}`}
        >
          Tout
        </button>
        <button 
          onClick={() => setFilter('identity')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition ${filter === 'identity' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] text-[color:var(--foreground)]/70 hover:border-[color:var(--border-strong)]'}`}
        >
          <ShieldCheck className="h-3 w-3" /> Identité
        </button>
        <button 
          onClick={() => setFilter('grace')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition ${filter === 'grace' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] text-[color:var(--foreground)]/70 hover:border-[color:var(--border-strong)]'}`}
        >
          <Sun className="h-3 w-3" /> Grâce
        </button>
        <button 
          onClick={() => setFilter('promise')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition ${filter === 'promise' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] text-[color:var(--foreground)]/70 hover:border-[color:var(--border-strong)]'}`}
        >
          <Quote className="h-3 w-3" /> Promesses
        </button>
      </div>

      {filteredPepites.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPepites.map((pepite) => (
            <div 
              key={pepite.id}
              className="group relative flex flex-col rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6 transition hover:border-[color:var(--accent-border)] hover:shadow-xl hover:shadow-[color:var(--accent)]/5 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--surface-strong)] border border-[color:var(--border-soft)] text-[10px] font-bold uppercase tracking-wider text-[color:var(--foreground)]/60">
                  {getTypeIcon(pepite.type)}
                  {getTypeName(pepite.type)}
                </div>
                <button 
                  onClick={() => handleDelete(pepite.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              
              <div className="mb-4 flex-1">
                <div className="text-xs font-extrabold text-[color:var(--accent)] mb-1 uppercase tracking-widest">{pepite.reference}</div>
                <p className="text-[15px] leading-relaxed text-[color:var(--foreground)]/80 italic line-clamp-4">
                  "{pepite.text}"
                </p>
                {pepite.note && (
                  <div className="mt-3 text-xs text-[color:var(--foreground)]/50 border-t border-[color:var(--border-soft)] pt-3">
                    {pepite.note}
                  </div>
                )}
              </div>

              <div className="mt-auto text-[10px] text-[color:var(--foreground)]/40 font-medium">
                Ajouté {formatDistanceToNow(new Date(pepite.createdAt), { addSuffix: true, locale: fr })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 rounded-[40px] border-2 border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface)]/50">
          <div className="h-16 w-16 mb-6 rounded-full bg-[color:var(--accent-soft)] flex items-center justify-center">
            <Sun className="h-8 w-8 text-[color:var(--accent)]" />
          </div>
          <h3 className="text-lg font-bold">Aucun trésor trouvé</h3>
          <p className="text-sm text-[color:var(--foreground)]/60 mt-1 max-w-xs text-center">
            Utilisez le "Miroir de Grâce" dans le lecteur biblique pour découvrir et enregistrer vos pépites.
          </p>
        </div>
      )}
    </div>
  );
}
