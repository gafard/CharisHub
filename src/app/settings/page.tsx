import StudyAppShell from '../../components/StudyAppShell';
import StudyUserPanel from '../../components/StudyUserPanel';
import { TrendingUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <StudyAppShell>
      <section className="mx-auto max-w-6xl space-y-6">
        {/* DASHBOARD LINK */}
        <Link 
          href="/dashboard" 
          className="group relative block overflow-hidden rounded-[32px] border border-amber-200/50 bg-gradient-to-br from-white/80 to-amber-50/30 p-6 shadow-sm ring-1 ring-amber-100/20 transition-all hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 shadow-inner">
                <TrendingUp size={26} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/70">Croissance Spirituelle</div>
                <h3 className="mt-0.5 text-xl font-black tracking-tight text-foreground">Mon Intimité</h3>
                <p className="mt-1 text-sm text-[#141b37]/50 max-lg:hidden">
                  Retrouve tes statistiques de prière, tes pépites et ton historique d'étude en un coup d'œil.
                </p>
                <p className="mt-1 text-xs text-[#141b37]/50 lg:hidden line-clamp-1">
                  Tes statistiques, pépites et historique d'étude.
                </p>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100/50 text-amber-600 transition-transform group-hover:translate-x-1">
              <ArrowRight size={20} />
            </div>
          </div>
        </Link>

        {/* PANEL */}
        <StudyUserPanel />
      </section>
    </StudyAppShell>
  );
}
