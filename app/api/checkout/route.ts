import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, accounts } from '@/db';
import { auth } from '@/lib/auth';
import { createCheckout } from '@/lib/checkout';
import { tokenOn } from '@/config/chains';
import { rateLimit } from '@/lib/rate-limit';
import { ipHashFromHeaders } from '@/lib/ip';
import { CATEGORIES, MIN_PAYMENT_CENTS } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  amountCents: z.number().int().min(MIN_PAYMENT_CENTS).max(100_000_000),
  chainId: z.number().int().positive(),
  tokenSymbol: z.enum(['USDC', 'USDG']),
  category: z.enum(CATEGORIES),
  tagline: z.string().trim().max(80).optional(),
  link: z.string().trim().url().max(200).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: 'Sign in with X first' }, { status: 401 });
  }

  const ipHash = ipHashFromHeaders(request.headers);
  const limit = rateLimit(`checkout:${session.user.accountId}:${ipHash}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many checkouts. Wait a few minutes.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Bad request' }, { status: 400 });
  }
  const body = parsed.data;

  if (!tokenOn(body.chainId, body.tokenSymbol)) {
    return NextResponse.json({ error: 'That chain and token combination is not available' }, { status: 400 });
  }

  await db()
    .update(accounts)
    .set({
      category: body.category,
      tagline: body.tagline?.slice(0, 80) || null,
      link: body.link || null,
    })
    .where(eq(accounts.id, session.user.accountId));

  try {
    const checkout = await createCheckout({
      accountId: session.user.accountId,
      chainId: body.chainId,
      tokenSymbol: body.tokenSymbol,
      amountCents: body.amountCents,
    });
    return NextResponse.json({ id: checkout.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not create checkout' },
      { status: 500 },
    );
  }
}
