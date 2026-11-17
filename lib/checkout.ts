import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, checkouts, payments } from '@/db';
import { env, appMode } from '@/lib/env';
import { deriveAddressFromXpub, devXpub } from '@/lib/wallet';
import { tokenOn, type TokenSymbol } from '@/config/chains';
import { tokenDecimals } from '@/lib/tokens';
import { centsToBaseUnits } from '@/lib/money';
import { buildEip681Uri } from '@/lib/payment-uri';

function xpub(): string {
  const configured = env().DEPOSIT_XPUB;
  if (configured) return configured;
  if (appMode() === 'mock') return devXpub();
  throw new Error('DEPOSIT_XPUB is not set');
}

export interface CreateCheckoutInput {
  accountId: string;
  chainId: number;
  tokenSymbol: TokenSymbol;
  amountCents: number;
}

export async function createCheckout(input: CreateCheckoutInput) {
  const token = tokenOn(input.chainId, input.tokenSymbol);
  if (!token) throw new Error(`${input.tokenSymbol} is not available on chain ${input.chainId}`);

  const database = db();
  const ttlMinutes = env().CHECKOUT_TTL_MINUTES;
  const key = xpub();

  // Indices are handed out one at a time; the unique index is the real
  // guarantee, so a lost race just retries with the next number.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [row] = await database
      .select({ max: sql<number>`coalesce(max(${checkouts.derivationIndex}), -1)::int` })
      .from(checkouts);
    const index = (row?.max ?? -1) + 1 + attempt;
    const depositAddress = deriveAddressFromXpub(key, index);

    try {
      const [created] = await database
        .insert(checkouts)
        .values({
          accountId: input.accountId,
          depositAddress: depositAddress.toLowerCase(),
          derivationIndex: index,
          chainId: input.chainId,
          tokenSymbol: input.tokenSymbol,
          tokenAddress: token.address,
          expectedCents: input.amountCents,
          status: 'waiting',
          expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        })
        .returning();
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('derivation_index')) throw error;
    }
  }

  throw new Error('Could not allocate a deposit address, please retry');
}

export async function getCheckout(id: string) {
  const rows = await db().select().from(checkouts).where(eq(checkouts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCheckoutPayments(checkoutId: string) {
  return db()
    .select()
    .from(payments)
    .where(eq(payments.checkoutId, checkoutId))
    .orderBy(desc(payments.createdAt));
}

export interface CheckoutPresentation {
  uri: string;
  amountBaseUnits: string;
  decimals: number;
}

export async function presentCheckout(checkout: {
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  depositAddress: string;
  expectedCents: number;
}): Promise<CheckoutPresentation> {
  const token = tokenOn(checkout.chainId, checkout.tokenSymbol as TokenSymbol);
  const decimals = token ? await tokenDecimals(checkout.chainId, token) : 6;
  const amountBaseUnits = centsToBaseUnits(checkout.expectedCents, decimals);
  return {
    uri: buildEip681Uri({
      tokenAddress: checkout.tokenAddress,
      chainId: checkout.chainId,
      depositAddress: checkout.depositAddress,
      amountBaseUnits,
    }),
    amountBaseUnits: amountBaseUnits.toString(),
    decimals,
  };
}

/**
 * Deposit addresses the watcher should still scan. Expired checkouts stay in
 * the set for DEPOSIT_WATCH_DAYS so late payments are still credited.
 */
export async function activeDepositAddresses(): Promise<string[]> {
  const cutoff = new Date(Date.now() - env().DEPOSIT_WATCH_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db()
    .selectDistinct({ address: checkouts.depositAddress })
    .from(checkouts)
    .where(gte(checkouts.createdAt, cutoff));
  return rows.map((r) => r.address as `0x${string}`);
}

export async function expireStaleCheckouts(): Promise<number> {
  const result = await db()
    .update(checkouts)
    .set({ status: 'expired' })
    .where(and(eq(checkouts.status, 'waiting'), sql`${checkouts.expiresAt} < now()`))
    .returning({ id: checkouts.id });
  return result.length;
}
