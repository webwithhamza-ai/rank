import { parseAbiItem } from 'viem';
import { eq } from 'drizzle-orm';
import { db, watcherState } from '@/db';
import { env } from '@/lib/env';
import { activeChains, tokenByAddress } from '@/config/chains';
import { publicClientFor } from '@/lib/rpc';
import { tokenDecimals } from '@/lib/tokens';
import { creditTransfer } from '@/lib/credit';
import { activeDepositAddresses, expireStaleCheckouts } from '@/lib/checkout';

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

/**
 * Unsupported tokens are recorded for manual refund, not credited, so their
 * decimals do not matter. Assuming 18 avoids an RPC round trip for every junk
 * token someone might airdrop at a deposit address.
 */
const UNSUPPORTED_TOKEN_DECIMALS = 18;

export interface ChainCycleResult {
  chainId: number;
  chainName: string;
  scannedFrom: number;
  scannedTo: number;
  confirmed: number;
  detected: number;
  skipped?: string;
}

async function lastProcessedBlock(chainId: number, head: bigint): Promise<bigint> {
  const rows = await db().select().from(watcherState).where(eq(watcherState.chainId, chainId));
  if (rows.length > 0) return BigInt(rows[0].lastProcessedBlock);

  // First run: start at the current head rather than replaying chain history.
  const start = head > 0n ? head - 1n : 0n;
  await db().insert(watcherState).values({ chainId, lastProcessedBlock: Number(start) });
  return start;
}

async function saveProcessedBlock(chainId: number, block: bigint): Promise<void> {
  await db()
    .update(watcherState)
    .set({ lastProcessedBlock: Number(block), updatedAt: new Date() })
    .where(eq(watcherState.chainId, chainId));
}

async function handleLogs(
  chainId: number,
  logs: Array<{
    address: string;
    args: { from?: string; to?: string; value?: bigint };
    transactionHash: string | null;
    logIndex: number | null;
    blockNumber: bigint | null;
  }>,
  confirmed: boolean,
): Promise<number> {
  let handled = 0;

  for (const log of logs) {
    if (!log.transactionHash || log.logIndex === null || log.args.value === undefined) continue;
    const token = tokenByAddress(chainId, log.address);
    const decimals = token
      ? await tokenDecimals(chainId, token)
      : UNSUPPORTED_TOKEN_DECIMALS;

    const result = await creditTransfer({
      chainId,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      tokenAddress: log.address,
      fromAddress: log.args.from ?? null,
      toAddress: log.args.to ?? '',
      amountBaseUnits: log.args.value,
      decimals,
      blockNumber: log.blockNumber === null ? null : Number(log.blockNumber),
      confirmed,
    });

    if (result.paymentId) handled += 1;
  }

  return handled;
}

async function runChain(chainId: number, chainName: string): Promise<ChainCycleResult> {
  const addresses = await activeDepositAddresses();
  if (addresses.length === 0) {
    return {
      chainId,
      chainName,
      scannedFrom: 0,
      scannedTo: 0,
      confirmed: 0,
      detected: 0,
      skipped: 'no active deposit addresses',
    };
  }

  const client = publicClientFor(chainId);
  const head = await client.getBlockNumber();
  const chain = activeChains().find((c) => c.id === chainId);
  const confirmations = BigInt(chain?.confirmations ?? env().BASE_CONFIRMATIONS);
  const safeHead = head > confirmations ? head - confirmations : 0n;

  const last = await lastProcessedBlock(chainId, head);
  const batch = BigInt(env().WATCHER_BATCH_BLOCKS);

  let confirmed = 0;
  let from = last + 1n;
  let to = last;

  // Confirmed range: everything at or below the safe head is final enough.
  while (from <= safeHead) {
    to = from + batch - 1n > safeHead ? safeHead : from + batch - 1n;
    const logs = await client.getLogs({
      event: TRANSFER_EVENT,
      args: { to: addresses as `0x${string}`[] },
      fromBlock: from,
      toBlock: to,
    });
    confirmed += await handleLogs(chainId, logs, true);
    await saveProcessedBlock(chainId, to);
    from = to + 1n;
  }

  // Unconfirmed tip: surfaces "detected" in the UI without advancing state,
  // so these blocks get scanned again once they are deep enough.
  let detected = 0;
  if (head > safeHead) {
    const logs = await client.getLogs({
      event: TRANSFER_EVENT,
      args: { to: addresses as `0x${string}`[] },
      fromBlock: safeHead + 1n,
      toBlock: head,
    });
    detected += await handleLogs(chainId, logs, false);
  }

  return {
    chainId,
    chainName,
    scannedFrom: Number(last + 1n),
    scannedTo: Number(to > last ? to : last),
    confirmed,
    detected,
  };
}

export async function runWatcherCycle(): Promise<ChainCycleResult[]> {
  await expireStaleCheckouts();

  const results: ChainCycleResult[] = [];
  for (const chain of activeChains()) {
    try {
      results.push(await runChain(chain.id, chain.name));
    } catch (error) {
      results.push({
        chainId: chain.id,
        chainName: chain.name,
        scannedFrom: 0,
        scannedTo: 0,
        confirmed: 0,
        detected: 0,
        skipped: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
