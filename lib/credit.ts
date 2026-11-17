import { and, desc, eq } from 'drizzle-orm';
import { db, accounts, checkouts, payments } from '@/db';
import { baseUnitsToCents } from '@/lib/money';
import { MIN_PAYMENT_CENTS } from '@/lib/ranking';
import { tokenByAddress } from '@/config/chains';

export interface IncomingTransfer {
  chainId: number;
  txHash: string;
  logIndex: number;
  tokenAddress: string;
  fromAddress?: string | null;
  /** The deposit address the money landed on. */
  toAddress: string;
  amountBaseUnits: bigint;
  decimals: number;
  blockNumber?: number | null;
  /** True once the transfer has the chain's required confirmations. */
  confirmed: boolean;
  isMock?: boolean;
}

export interface CreditResult {
  paymentId: string;
  status: 'detected' | 'confirmed' | 'flagged' | 'under_minimum';
  credited: boolean;
  amountCents: number;
  accountId: string | null;
  /** Null when nothing changed because the log was already processed. */
  newTotalCents: number | null;
}

/**
 * The one and only path that turns an incoming transfer into rank. Real
 * on-chain payments and MOCK-mode simulated payments both go through here, so
 * the simulated flow exercises exactly the production code.
 *
 * Idempotency comes from the unique index on (chain_id, tx_hash, log_index)
 * combined with compare-and-set updates, so a log can never be credited twice
 * even if two watchers see it at the same moment.
 */
export async function creditTransfer(input: IncomingTransfer): Promise<CreditResult> {
  const database = db();
  const amountCents = baseUnitsToCents(input.amountBaseUnits, input.decimals);
  const depositAddress = input.toAddress.toLowerCase();
  const token = tokenByAddress(input.chainId, input.tokenAddress);

  // The deposit address identifies the payer. We keep watching expired
  // checkouts, so a late payment still finds its owner.
  const checkout = await database.query.checkouts.findFirst({
    where: eq(checkouts.depositAddress, depositAddress),
    orderBy: [desc(checkouts.createdAt)],
  });

  const supported = Boolean(token);
  const accountId = checkout?.accountId ?? null;

  let status: CreditResult['status'];
  if (!supported || !accountId) {
    // Unknown token, or money sent to an address we never handed out.
    status = 'flagged';
  } else if (!input.confirmed) {
    status = 'detected';
  } else if (amountCents < MIN_PAYMENT_CENTS) {
    status = 'under_minimum';
  } else {
    status = 'confirmed';
  }

  return database.transaction(async (tx) => {
    const inserted = await tx
      .insert(payments)
      .values({
        accountId,
        checkoutId: checkout?.id ?? null,
        chainId: input.chainId,
        tokenAddress: input.tokenAddress.toLowerCase(),
        tokenSymbol: token?.symbol ?? null,
        txHash: input.txHash.toLowerCase(),
        logIndex: input.logIndex,
        fromAddress: input.fromAddress?.toLowerCase() ?? null,
        toAddress: depositAddress,
        amountBaseUnits: input.amountBaseUnits.toString(),
        amountCents,
        status,
        blockNumber: input.blockNumber ?? null,
        confirmedAt: status === 'confirmed' || status === 'under_minimum' ? new Date() : null,
        note: supported ? null : `Unsupported token ${input.tokenAddress} on chain ${input.chainId}`,
        isMock: input.isMock ?? false,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      const row = inserted[0];
      const newTotal =
        status === 'confirmed' && accountId ? await applyCredit(tx, accountId, amountCents) : null;
      if (status === 'confirmed' && checkout) {
        await tx.update(checkouts).set({ status: 'confirmed' }).where(eq(checkouts.id, checkout.id));
      } else if (status === 'detected' && checkout && checkout.status === 'waiting') {
        await tx.update(checkouts).set({ status: 'detected' }).where(eq(checkouts.id, checkout.id));
      }
      return {
        paymentId: row.id,
        status,
        credited: status === 'confirmed' && accountId !== null,
        amountCents,
        accountId,
        newTotalCents: newTotal,
      };
    }

    // The log already exists. The only legal transition is detected -> final,
    // and the compare-and-set below guarantees exactly one caller performs it.
    if (!input.confirmed) {
      return {
        paymentId: '',
        status: 'detected',
        credited: false,
        amountCents,
        accountId,
        newTotalCents: null,
      };
    }

    const promoted = await tx
      .update(payments)
      .set({ status, confirmedAt: new Date(), blockNumber: input.blockNumber ?? null })
      .where(
        and(
          eq(payments.chainId, input.chainId),
          eq(payments.txHash, input.txHash.toLowerCase()),
          eq(payments.logIndex, input.logIndex),
          eq(payments.status, 'detected'),
        ),
      )
      .returning();

    if (promoted.length === 0) {
      return {
        paymentId: '',
        status,
        credited: false,
        amountCents,
        accountId,
        newTotalCents: null,
      };
    }

    const newTotal =
      status === 'confirmed' && accountId ? await applyCredit(tx, accountId, amountCents) : null;
    if (status === 'confirmed' && checkout) {
      await tx.update(checkouts).set({ status: 'confirmed' }).where(eq(checkouts.id, checkout.id));
    }

    return {
      paymentId: promoted[0].id,
      status,
      credited: status === 'confirmed' && accountId !== null,
      amountCents,
      accountId,
      newTotalCents: newTotal,
    };
  });
}

type Tx = Parameters<Parameters<ReturnType<typeof db>['transaction']>[0]>[0];

/** Raise the total and stamp the moment the new score was reached. */
async function applyCredit(tx: Tx, accountId: string, amountCents: number): Promise<number> {
  const current = await tx.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!current) return 0;
  const newTotal = current.totalCents + amountCents;
  await tx
    .update(accounts)
    .set({ totalCents: newTotal, scoreReachedAt: new Date() })
    .where(eq(accounts.id, accountId));
  return newTotal;
}

/** Admin action: reverse a credited payment and record the refund tx. */
export async function markRefunded(paymentId: string, refundTxHash: string): Promise<void> {
  const database = db();
  await database.transaction(async (tx) => {
    const payment = await tx.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!payment) throw new Error('Payment not found');
    if (payment.status === 'refunded') return;

    if (payment.status === 'confirmed' && payment.accountId) {
      const account = await tx.query.accounts.findFirst({ where: eq(accounts.id, payment.accountId) });
      if (account) {
        await tx
          .update(accounts)
          .set({
            totalCents: Math.max(0, account.totalCents - payment.amountCents),
            scoreReachedAt: new Date(),
          })
          .where(eq(accounts.id, account.id));
      }
    }

    await tx
      .update(payments)
      .set({ status: 'refunded', refundTxHash })
      .where(eq(payments.id, paymentId));
  });
}
