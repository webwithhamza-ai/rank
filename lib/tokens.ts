import { appMode } from '@/lib/env';
import { supportedRails, type TokenConfig } from '@/config/chains';
import { ERC20_ABI, publicClientFor } from '@/lib/rpc';

/**
 * Token decimals are read from the contract and cached. They are never
 * hardcoded — USDC is 6 on most chains but that is a convention, not a rule,
 * and getting it wrong would credit amounts off by orders of magnitude.
 */
const decimalsCache = new Map<string, number>();

function key(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

/** Mock mode has no chain to ask, so assume the usual stablecoin shape. */
const MOCK_DECIMALS = 6;

export async function tokenDecimals(chainId: number, token: TokenConfig): Promise<number> {
  const cacheKey = key(chainId, token.address);
  const cached = decimalsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  if (appMode() === 'mock') {
    decimalsCache.set(cacheKey, MOCK_DECIMALS);
    return MOCK_DECIMALS;
  }

  const client = publicClientFor(chainId);
  const decimals = await client.readContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });
  const value = Number(decimals);
  decimalsCache.set(cacheKey, value);
  return value;
}

export function cachedDecimals(chainId: number, address: string): number | undefined {
  return decimalsCache.get(key(chainId, address));
}

/** Warm the cache for every supported rail. Called once at watcher startup. */
export async function primeDecimals(): Promise<void> {
  await Promise.all(
    supportedRails().map(async ({ chain, token }) => {
      try {
        const d = await tokenDecimals(chain.id, token);
        token.decimals = d;
      } catch (error) {
        console.error(`[tokens] could not read decimals for ${token.symbol} on ${chain.name}`, error);
      }
    }),
  );
}
