'use client';

import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { CategoryTag, Tag } from '@/components/ui/Tag';
import { OutboundHandle } from '@/components/OutboundHandle';
import { ReportLink } from '@/components/ReportLink';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { BoardRow } from '@/lib/board-dto';

interface ListingCardProps {
  row: BoardRow;
  flash?: boolean;
}

/**
 * One uniform row per listing. The top three are tinted rather than resized,
 * so the board stays scannable all the way down.
 */
export function ListingCard({ row, flash = false }: ListingCardProps) {
  const isPodium = row.rank <= 3;

  return (
    <article
      className={cn(
        'group relative flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors sm:gap-4 sm:px-4',
        isPodium
          ? 'border-[var(--primary)]/20 bg-[var(--primary-soft)]/60'
          : 'border-line bg-surface',
        'hover:border-[var(--primary)]/40',
        flash && 'animate-flash',
      )}
    >
      <span
        className={cn(
          'w-8 shrink-0 text-center text-sm font-semibold tabular-nums sm:w-10 sm:text-base',
          isPodium ? 'text-primary' : 'text-muted',
        )}
        aria-label={`Rank ${row.rank}`}
      >
        #{row.rank}
      </span>

      <Avatar
        handle={row.handle}
        displayName={row.displayName}
        avatarUrl={row.avatarUrl}
        avatarColor={row.avatarColor}
        size={44}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/u/${row.handle}`}
            className="truncate text-[15px] font-semibold hover:text-primary"
          >
            {row.displayName}
          </Link>
          {row.isMock ? <Tag>DEV</Tag> : null}
        </div>

        {row.tagline ? (
          <p className="clamp-1 mt-0.5 text-[13px] leading-5 text-muted">{row.tagline}</p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          <CategoryTag category={row.category} />
          <OutboundHandle accountId={row.id} handle={row.handle} />
          <span>{row.clicks.toLocaleString('en-US')} clicks</span>
          {row.link ? (
            <a
              href={row.link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="hidden hover:text-fg sm:inline"
            >
              {row.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 28)}
            </a>
          ) : null}
          <span className="hidden sm:inline">
            <ReportLink accountId={row.id} handle={row.handle} />
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[15px] font-bold tabular-nums sm:text-base">
          {formatCents(row.scoreCents)}
        </span>
        <Link
          href={`/claim?outbid=${row.handle}`}
          className="rounded-sm border border-line px-2 py-0.5 text-[12px] text-muted transition-colors hover:border-primary hover:text-primary"
        >
          Outbid
        </Link>
      </div>
    </article>
  );
}
