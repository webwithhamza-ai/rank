'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ListingCard } from '@/components/ListingCard';
import { BoardToggle, CategoryFilter } from '@/components/CategoryFilter';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { formatCents } from '@/lib/money';
import type { BoardRow, BoardKindDto } from '@/lib/board-dto';
import type { Category } from '@/lib/ranking';

interface LeaderboardProps {
  kind: BoardKindDto;
  category: Category | 'ALL';
  initialRows: BoardRow[];
  sidebarRows: BoardRow[];
  sidebarTitle: string;
  sidebarHref: string;
}

const PAGE_SIZE = 25;

export function Leaderboard({
  kind,
  category,
  initialRows,
  sidebarRows,
  sidebarTitle,
  sidebarHref,
}: LeaderboardProps) {
  const [rows, setRows] = useState(initialRows);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const previous = useRef(new Map(initialRows.map((r) => [r.id, r.rank])));

  useEffect(() => {
    setRows(initialRows);
    setVisible(PAGE_SIZE);
    previous.current = new Map(initialRows.map((r) => [r.id, r.rank]));
  }, [initialRows]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/board?kind=${kind}&category=${category}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { rows: BoardRow[] };
        if (cancelled) return;

        const changed = new Set<string>();
        for (const row of data.rows) {
          const before = previous.current.get(row.id);
          if (before !== undefined && before !== row.rank) changed.add(row.id);
        }
        previous.current = new Map(data.rows.map((r) => [r.id, r.rank]));
        setRows(data.rows);

        if (changed.size > 0) {
          setFlashing(changed);
          setTimeout(() => !cancelled && setFlashing(new Set()), 1000);
        }
      } catch {
        // Transient network failure: keep showing the last good board.
      }
    };

    const timer = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [kind, category]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BoardToggle kind={kind} />
        <CategoryFilter kind={kind} active={category} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {rows.length === 0 ? (
            <Card className="px-6 py-14 text-center">
              <h2 className="text-lg font-semibold">Nobody here yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                This board is empty. The first dollar takes #1.
              </p>
              <ButtonLink href="/claim" className="mt-5">
                Take #1
              </ButtonLink>
            </Card>
          ) : (
            <>
              <ul className="space-y-2">
                {rows.slice(0, visible).map((row) => (
                  <li key={row.id}>
                    <ListingCard row={row} flash={flashing.has(row.id)} />
                  </li>
                ))}
              </ul>

              {visible < rows.length ? (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="mt-4 w-full rounded-lg border border-line py-2.5 text-sm font-medium text-muted transition-colors hover:border-[var(--primary)]/40 hover:text-fg"
                >
                  Show more ({rows.length - visible} left)
                </button>
              ) : null}
            </>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{sidebarTitle}</h2>
                <Link href={sidebarHref} className="text-[12px] text-muted hover:text-fg">
                  See all
                </Link>
              </div>

              {sidebarRows.length === 0 ? (
                <p className="py-4 text-[13px] text-muted">Nothing yet today.</p>
              ) : (
                <ul className="space-y-2.5">
                  {sidebarRows.slice(0, 6).map((row) => (
                    <li key={row.id} className="flex items-center gap-2.5">
                      <span className="w-6 shrink-0 text-[12px] font-medium tabular-nums text-muted">
                        #{row.rank}
                      </span>
                      <Avatar
                        handle={row.handle}
                        displayName={row.displayName}
                        avatarUrl={row.avatarUrl}
                        avatarColor={row.avatarColor}
                        size={26}
                      />
                      <Link
                        href={`/u/${row.handle}`}
                        className="min-w-0 flex-1 truncate text-[13px] hover:text-primary"
                      >
                        {row.displayName}
                      </Link>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                        {formatCents(row.scoreCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
