/**
 * Pure ranking logic. No database, no network, no framework imports — every
 * function here is a deterministic function of its arguments so the whole
 * module is unit-testable in isolation.
 *
 * Money is always integer cents. Never floats.
 */

export const CATEGORIES = ['KOL', 'NFT', 'Memecoin', 'Builder', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

/** Minimum credited payment: $1. Anything below is recorded but not credited. */
export const MIN_PAYMENT_CENTS = 100;

export interface RankableEntry {
  id: string;
  scoreCents: number;
  /**
   * When this entry's score last changed, as epoch milliseconds. Ties are
   * broken in favour of whoever reached the score first.
   */
  scoreReachedAt: number;
  category: Category;
  hidden?: boolean;
}

export interface Ranked<T extends RankableEntry> {
  rank: number;
  entry: T;
}

/**
 * Sort order: score descending, then earliest to reach that score, then id so
 * the result is stable even for synthetic data with identical timestamps.
 */
export function compareEntries(a: RankableEntry, b: RankableEntry): number {
  if (a.scoreCents !== b.scoreCents) return b.scoreCents - a.scoreCents;
  if (a.scoreReachedAt !== b.scoreReachedAt) return a.scoreReachedAt - b.scoreReachedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Entries that actually belong on a board: visible, with credited money. */
export function isListable(entry: RankableEntry): boolean {
  return !entry.hidden && entry.scoreCents >= MIN_PAYMENT_CENTS;
}

export function filterByCategory<T extends RankableEntry>(
  entries: readonly T[],
  category: Category | 'ALL',
): T[] {
  return category === 'ALL' ? [...entries] : entries.filter((e) => e.category === category);
}

/**
 * Rank a board. Ranks are dense and unique (1, 2, 3, …) because the tie-break
 * gives every entry a strict order.
 */
export function rankEntries<T extends RankableEntry>(entries: readonly T[]): Ranked<T>[] {
  return entries
    .filter(isListable)
    .slice()
    .sort(compareEntries)
    .map((entry, index) => ({ rank: index + 1, entry }));
}

/** Rank a board narrowed to one category — ranks restart at 1 inside the filter. */
export function rankEntriesInCategory<T extends RankableEntry>(
  entries: readonly T[],
  category: Category | 'ALL',
): Ranked<T>[] {
  return rankEntries(filterByCategory(entries, category));
}

export function findRank<T extends RankableEntry>(ranked: readonly Ranked<T>[], id: string): number | null {
  const hit = ranked.find((r) => r.entry.id === id);
  return hit ? hit.rank : null;
}

/**
 * Where would `id` land if its total became `newScoreCents` right now?
 *
 * A score change resets `scoreReachedAt` to now, so on a tie the mover sits
 * below everyone who was already there — which is what makes "pay exactly the
 * leader's total" not enough to take #1.
 */
export function projectedRank<T extends RankableEntry>(
  entries: readonly T[],
  id: string,
  newScoreCents: number,
  now: number = Date.now(),
): number {
  const others = entries.filter((e) => e.id !== id);
  const existing = entries.find((e) => e.id === id);
  const moved: RankableEntry = {
    id,
    scoreCents: newScoreCents,
    scoreReachedAt: now,
    category: existing?.category ?? 'Other',
    hidden: false,
  };
  const ranked = rankEntries<RankableEntry>([...others, moved]);
  return findRank(ranked, id) ?? ranked.length + 1;
}

export function roundUpToDollar(cents: number): number {
  if (cents <= 0) return 0;
  return Math.ceil(cents / 100) * 100;
}

/**
 * Smallest payment that puts you strictly ahead of an entry whose total is
 * `targetTotalCents`, given your current total.
 *
 * Beating a total needs one more cent, but payments are quoted in whole
 * dollars and the floor is $1 — so $100 leader vs $0 you costs $101, and a $90
 * account needs $11 to pass a $100 leader.
 */
export function costToOvertakeCents(targetTotalCents: number, myTotalCents: number): number {
  const rawDelta = targetTotalCents - myTotalCents + 1;
  return Math.max(MIN_PAYMENT_CENTS, roundUpToDollar(rawDelta));
}

/**
 * What it costs to hold `targetRank` on this board. The entry currently at
 * that rank (ignoring you) is the one you have to pass.
 */
export function costToReachRankCents<T extends RankableEntry>(
  entries: readonly T[],
  id: string,
  targetRank: number,
  myTotalCents: number,
): number {
  const board = rankEntries(entries.filter((e) => e.id !== id));
  const occupant = board[targetRank - 1];
  if (!occupant) return MIN_PAYMENT_CENTS;
  return costToOvertakeCents(occupant.entry.scoreCents, myTotalCents);
}

export interface RankTargets {
  takeFirst: number;
  takeThird: number;
  enterTopTen: number;
}

export function rankTargets<T extends RankableEntry>(
  entries: readonly T[],
  id: string,
  myTotalCents: number,
): RankTargets {
  return {
    takeFirst: costToReachRankCents(entries, id, 1, myTotalCents),
    takeThird: costToReachRankCents(entries, id, 3, myTotalCents),
    enterTopTen: costToReachRankCents(entries, id, 10, myTotalCents),
  };
}

/** UTC day boundaries for the Today board. Resets at 00:00 UTC. */
export function utcDayStart(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export function utcDayEnd(at: Date = new Date()): Date {
  const start = utcDayStart(at);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function msUntilUtcReset(at: Date = new Date()): number {
  return utcDayEnd(at).getTime() - at.getTime();
}
