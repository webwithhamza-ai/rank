'use client';

import Link from 'next/link';
import { CATEGORIES, type Category } from '@/lib/ranking';
import { cn } from '@/lib/cn';
import type { BoardKindDto } from '@/lib/board-dto';

export function CategoryFilter({
  kind,
  active,
}: {
  kind: BoardKindDto;
  active: Category | 'ALL';
}) {
  const base = kind === 'today' ? '/today' : '/';
  const options: Array<Category | 'ALL'> = ['ALL', ...CATEGORIES];

  return (
    <div
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      role="group"
      aria-label="Filter by category"
    >
      {options.map((option) => {
        const isActive = option === active;
        const href = option === 'ALL' ? base : `${base}?category=${option}`;
        return (
          <Link
            key={option}
            href={href}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-line text-muted hover:border-[var(--primary)]/40 hover:text-fg',
            )}
          >
            {option === 'ALL' ? 'All' : option}
          </Link>
        );
      })}
    </div>
  );
}

export function BoardToggle({ kind }: { kind: BoardKindDto }) {
  const tabs = [
    { href: '/', label: 'All-time', key: 'alltime' },
    { href: '/today', label: 'Today', key: 'today' },
  ] as const;

  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={kind === tab.key ? 'true' : undefined}
          className={cn(
            'rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors',
            kind === tab.key ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
