import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { appMode } from '@/lib/env';
import { getCheckout } from '@/lib/checkout';
import { creditTransfer } from '@/lib/credit';
import { tokenOn, type TokenSymbol } from '@/config/chains';
import { tokenDecimals } from '@/lib/tokens';
import { centsToBaseUnits } from '@/lib/money';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  amountCents: z.number().int().min(1).max(100_000_000),
  action: z.enum(['detect', 'confirm']),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
});

/**
 * MOCK-mode only. Feeds a fabricated transfer through creditTransfer — the
 * exact same crediting path a real on-chain payment takes.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (appMode() !== 'mock') {
    return NextResponse.json({ error: 'Simulation is disabled outside MOCK mode' }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.accountId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const { id } = await context.params;
  const checkout = await getCheckout(id);
  if (!checkout) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (checkout.accountId !== session.user.accountId) {
    return NextResponse.json({ error: 'Not your checkout' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const token = tokenOn(checkout.chainId, checkout.tokenSymbol as TokenSymbol);
  const decimals = token ? await tokenDecimals(checkout.chainId, token) : 6;
  const txHash = parsed.data.txHash ?? `0x${randomBytes(32).toString('hex')}`;

  const result = await creditTransfer({
    chainId: checkout.chainId,
    txHash,
    logIndex: 0,
    tokenAddress: checkout.tokenAddress,
    fromAddress: `0x${randomBytes(20).toString('hex')}`,
    toAddress: checkout.depositAddress,
    amountBaseUnits: centsToBaseUnits(parsed.data.amountCents, decimals),
    decimals,
    blockNumber: Math.floor(Date.now() / 1000),
    confirmed: parsed.data.action === 'confirm',
    isMock: true,
  });

  return NextResponse.json({ ...result, txHash });
}
