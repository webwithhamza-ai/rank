import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, accounts, clicks, payments } from '@/db';
import {
  rankEntriesInCategory,
  utcDayStart,
  type Category,
  type Ranked,
  type RankableEntry,
} from '@/lib/ranking';
import type { BoardRow } from '@/lib/board-dto';

export interface BoardEntry extends RankableEntry {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  tagline: string | null;
  link: string | null;
  clicks: number;
  isMock: boolean;
  /** All-time total, carried on the Today board too so profiles can show both. */
  allTimeCents: number;
}

export type BoardKind = 'alltime' | 'today';

async function clickCounts(accountIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (accountIds.length === 0) return map;
  const rows = await db()
    .select({ accountId: clicks.accountId, count: sql<number>`count(*)::int` })
    .from(clicks)
    .where(inArray(clicks.accountId, accountIds))
    .groupBy(clicks.accountId);
  for (const row of rows) map.set(row.accountId, row.count);
  return map;
}

export async function getBoardEntries(kind: BoardKind): Promise<BoardEntry[]> {
  const database = db();
  const allAccounts = await database.select().from(accounts).where(eq(accounts.hidden, false));

  const byId = new Map(allAccounts.map((a) => [a.id, a]));
  const counts = await clickCounts(allAccounts.map((a) => a.id));

  const toEntry = (
    account: (typeof allAccounts)[number],
    scoreCents: number,
    scoreReachedAt: Date,
  ): BoardEntry => ({
    id: account.id,
    scoreCents,
    scoreReachedAt: scoreReachedAt.getTime(),
    category: account.category as Category,
    hidden: account.hidden,
    handle: account.handle,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    avatarColor: account.avatarColor,
    tagline: account.tagline,
    link: account.link,
    clicks: counts.get(account.id) ?? 0,
    isMock: account.isMock,
    allTimeCents: account.totalCents,
  });

  if (kind === 'alltime') {
    return allAccounts.map((a) => toEntry(a, a.totalCents, a.scoreReachedAt));
  }

  const dayStart = utcDayStart();
  const todayRows = await database
    .select({
      accountId: payments.accountId,
      total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      last: sql<Date>`max(${payments.confirmedAt})`,
    })
    .from(payments)
    .where(and(eq(payments.status, 'confirmed'), gte(payments.confirmedAt, dayStart)))
    .groupBy(payments.accountId);

  const result: BoardEntry[] = [];
  for (const row of todayRows) {
    if (!row.accountId) continue;
    const account = byId.get(row.accountId);
    if (!account) continue;
    result.push(toEntry(account, row.total, new Date(row.last)));
  }
  return result;
}

export async function getBoard(
  kind: BoardKind,
  category: Category | 'ALL',
): Promise<Ranked<BoardEntry>[]> {
  const entries = await getBoardEntries(kind);
  return rankEntriesInCategory(entries, category);
}

export function toBoardRows(ranked: Ranked<BoardEntry>[]): BoardRow[] {
  return ranked.map(({ rank, entry }) => ({
    rank,
    id: entry.id,
    handle: entry.handle,
    displayName: entry.displayName,
    avatarUrl: entry.avatarUrl,
    avatarColor: entry.avatarColor,
    category: entry.category,
    tagline: entry.tagline,
    link: entry.link,
    scoreCents: entry.scoreCents,
    clicks: entry.clicks,
    isMock: entry.isMock,
  }));
}

export async function getBoardRows(kind: BoardKind, category: Category | 'ALL'): Promise<BoardRow[]> {
  return toBoardRows(await getBoard(kind, category));
}

export async function getAccountByHandle(handle: string) {
  const rows = await db()
    .select()
    .from(accounts)
    .where(sql`lower(${accounts.handle}) = lower(${handle})`)
    .limit(1);
  return rows[0] ?? null;
}

export async function getAccountPayments(accountId: string) {
  return db()
    .select()
    .from(payments)
    .where(and(eq(payments.accountId, accountId), inArray(payments.status, ['confirmed', 'refunded'])))
    .orderBy(desc(payments.confirmedAt))
    .limit(100);
}

export interface TickerItem {
  handle: string;
  amountCents: number;
  at: string;
}

export async function getRecentPayments(limit = 12): Promise<TickerItem[]> {
  const rows = await db()
    .select({
      handle: accounts.handle,
      amountCents: payments.amountCents,
      at: payments.confirmedAt,
    })
    .from(payments)
    .innerJoin(accounts, eq(payments.accountId, accounts.id))
    .where(and(eq(payments.status, 'confirmed'), eq(accounts.hidden, false)))
    .orderBy(desc(payments.confirmedAt))
    .limit(limit);

  return rows.map((r) => ({
    handle: r.handle,
    amountCents: r.amountCents,
    at: (r.at ?? new Date()).toISOString(),
  }));
}
