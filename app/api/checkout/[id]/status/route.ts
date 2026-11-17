import { NextResponse } from 'next/server';
import { getCheckout, getCheckoutPayments } from '@/lib/checkout';
import { getBoardRows } from '@/lib/board';
import { txUrl } from '@/config/chains';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const checkout = await getCheckout(id);
  if (!checkout) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const paid = await getCheckoutPayments(checkout.id);
  const credited = paid
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amountCents, 0);

  const status = paid.some((p) => p.status === 'confirmed')
    ? 'confirmed'
    : paid.length > 0
      ? 'detected'
      : checkout.expiresAt.getTime() < Date.now()
        ? 'expired'
        : 'waiting';

  let rank: number | null = null;
  let todayRank: number | null = null;
  if (status === 'confirmed') {
    const [allTime, today] = await Promise.all([
      getBoardRows('alltime', 'ALL'),
      getBoardRows('today', 'ALL'),
    ]);
    rank = allTime.find((row) => row.id === checkout.accountId)?.rank ?? null;
    todayRank = today.find((row) => row.id === checkout.accountId)?.rank ?? null;
  }

  return NextResponse.json(
    {
      status,
      creditedCents: credited,
      rank,
      todayRank,
      expiresAt: checkout.expiresAt.toISOString(),
      payments: paid.map((p) => ({
        txHash: p.txHash,
        amountCents: p.amountCents,
        status: p.status,
        explorerUrl: txUrl(p.chainId, p.txHash),
      })),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
