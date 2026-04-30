'use client';

/**
 * BibleReaderSkeleton — Shimmer loading state for the Bible reader.
 * 
 * Displays a premium skeleton screen while Bible data is loading,
 * preventing the jarring blank screen flash.
 */

export default function BibleReaderSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-pulse">
      {/* Toolbar skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 rounded-xl bg-foreground/5" />
          <div className="h-8 w-8 rounded-xl bg-foreground/5" />
          <div className="h-8 w-8 rounded-xl bg-foreground/5" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 rounded-xl bg-foreground/5" />
          <div className="h-8 w-8 rounded-full bg-foreground/5" />
        </div>
      </div>

      {/* Book/Chapter selector skeleton */}
      <div className="mb-8 flex items-center justify-center gap-4">
        <div className="h-10 w-36 rounded-2xl bg-foreground/5" />
        <div className="h-6 w-px bg-foreground/5" />
        <div className="h-10 w-24 rounded-2xl bg-foreground/5" />
      </div>

      {/* Verse lines skeleton */}
      <div className="space-y-5">
        {Array.from({ length: 18 }).map((_, i) => {
          // Vary widths for natural text feel
          const widths = ['w-full', 'w-[95%]', 'w-[88%]', 'w-[92%]', 'w-[78%]', 'w-full', 'w-[85%]', 'w-[90%]', 'w-[70%]'];
          const width = widths[i % widths.length];
          
          return (
            <div key={i} className="flex items-start gap-3">
              {/* Verse number */}
              <div
                className="h-5 w-5 shrink-0 rounded-md bg-foreground/[0.04] mt-0.5"
                style={{ animationDelay: `${i * 50}ms` }}
              />
              {/* Verse text line */}
              <div
                className={`h-5 ${width} rounded-md bg-foreground/[0.04]`}
                style={{ animationDelay: `${i * 50}ms` }}
              />
            </div>
          );
        })}
      </div>

      {/* Bottom toolbar skeleton */}
      <div className="mt-10 flex justify-center">
        <div className="h-12 w-72 rounded-2xl bg-foreground/5" />
      </div>
    </div>
  );
}
