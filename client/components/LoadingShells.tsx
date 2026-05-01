import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

/** Shell full-screen enquanto carrega sessão ou bundle. */
export function FullSessionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('min-h-screen bg-navy-950 flex flex-col md:flex-row', className)}>
      <aside className="hidden md:flex w-72 shrink-0 border-r border-navy-800 p-6 flex-col gap-4">
        <Skeleton className="h-9 w-36 bg-navy-800/90 rounded-lg" />
        <div className="space-y-2 pt-4">
          <Skeleton className="h-11 w-full rounded-xl bg-navy-800/70" />
          <Skeleton className="h-11 w-full rounded-xl bg-navy-800/70" />
          <Skeleton className="h-11 w-full rounded-xl bg-navy-800/70" />
          <Skeleton className="h-11 w-full rounded-xl bg-navy-800/70" />
        </div>
      </aside>
      <div className="flex-1 bg-navy-50 min-h-screen p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-52 w-full rounded-2xl max-w-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Suspense ao trocar sub-rota dentro do grupo. */
export function LazyRouteSkeleton() {
  return (
    <div className="space-y-4 py-1 animate-in fade-in duration-200">
      <Skeleton className="h-8 w-48 max-w-[70%]" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  );
}

/** Overlay durante refetch do bundle (área principal autenticada). */
export function DataSyncOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 rounded-lg bg-white/75 backdrop-blur-[3px] p-6 border border-navy-100/50 shadow-inner">
      <div className="flex w-full max-w-md gap-2">
        <Skeleton className="h-1.5 flex-1 rounded-full bg-brand-200/80" />
        <Skeleton className="h-1.5 flex-1 rounded-full bg-brand-200/80" />
        <Skeleton className="h-1.5 flex-1 rounded-full bg-brand-200/80" />
      </div>
      <Skeleton className="h-28 w-full max-w-md rounded-2xl" />
      <Skeleton className="h-3 w-28 rounded-full bg-navy-300/80" />
    </div>
  );
}
