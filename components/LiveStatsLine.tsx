'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Stats {
  visitors: number;
  listings: number;
}

/** Replaces the old scrolling ticker: one quiet line instead of moving text. */
export function LiveStatsLine() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Stats;
        if (!cancelled) setStats(data);
      } catch {
        // Decorative only — a failed poll leaves the last values in place.
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!stats) return null;

  return (
    <p className="hidden items-center gap-2 text-[13px] text-muted md:flex">
      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-success" aria-hidden="true" />
      {stats.listings.toLocaleString('en-US')} listed
      <span aria-hidden="true">·</span>
      {stats.visitors.toLocaleString('en-US')} visitors
      <Link href="/about" className="underline underline-offset-2 hover:text-fg">
        stats
      </Link>
    </p>
  );
}
