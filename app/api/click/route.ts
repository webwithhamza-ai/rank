import { NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, clicks } from '@/db';
import { ipHashFromHeaders } from '@/lib/ip';
import { rateLimit } from '@/lib/rate-limit';
import { isDbConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ accountId: z.string().uuid() });

/** One click per account per IP per hour — enough to blunt refresh-spamming. */
const DEDUPE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ ok: true });

  const ipHash = ipHashFromHeaders(request.headers);
  const limit = rateLimit(`click:${ipHash}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: 'Too many clicks' }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const [existing] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(clicks)
    .where(
      and(
        eq(clicks.accountId, parsed.data.accountId),
        eq(clicks.ipHash, ipHash),
        gte(clicks.createdAt, since),
      ),
    );

  if ((existing?.count ?? 0) === 0) {
    await db().insert(clicks).values({ accountId: parsed.data.accountId, ipHash });
  }

  return NextResponse.json({ ok: true });
}
