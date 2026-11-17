import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, reports } from '@/db';
import { ipHashFromHeaders } from '@/lib/ip';
import { rateLimit } from '@/lib/rate-limit';
import { isDbConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  accountId: z.string().uuid(),
  reason: z.string().trim().min(4).max(500),
});

export async function POST(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

  const ipHash = ipHashFromHeaders(request.headers);
  const limit = rateLimit(`report:${ipHash}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many reports' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  await db().insert(reports).values({
    accountId: parsed.data.accountId,
    reason: parsed.data.reason,
    reporterIpHash: ipHash,
  });

  return NextResponse.json({ ok: true });
}
