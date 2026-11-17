import { and, eq, gte, sql } from 'drizzle-orm';
import { db, accounts, clicks, payments, visits } from '@/db';
import { utcDayStart } from '@/lib/ranking';

export interface SiteStats {
  listings: number;
  totalRevenueCents: number;
  todayRevenueCents: number;
  totalClicks: number;
  visitors: number;
  payments: number;
}

export async function getSiteStats(): Promise<SiteStats> {
  const database = db();
  const [listing] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(accounts)
    .where(and(eq(accounts.hidden, false), gte(accounts.totalCents, 100)));

  const [revenue] = await database
    .select({
      total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(eq(payments.status, 'confirmed'));

  const [today] = await database
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
    .from(payments)
    .where(and(eq(payments.status, 'confirmed'), gte(payments.confirmedAt, utcDayStart())));

  const [clickTotal] = await database.select({ count: sql<number>`count(*)::int` }).from(clicks);
  const [visitorTotal] = await database
    .select({ count: sql<number>`count(distinct ${visits.ipHash})::int` })
    .from(visits);

  return {
    listings: listing?.count ?? 0,
    totalRevenueCents: revenue?.total ?? 0,
    todayRevenueCents: today?.total ?? 0,
    totalClicks: clickTotal?.count ?? 0,
    visitors: visitorTotal?.count ?? 0,
    payments: revenue?.count ?? 0,
  };
}

export async function recordVisit(ipHash: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await db().insert(visits).values({ ipHash, day }).onConflictDoNothing();
}
