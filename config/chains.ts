import { env } from '@/lib/env';

/**
 * Every chain id, RPC URL and token address lives here and comes from env vars.
 * Nothing on-chain is hardcoded in application code.
 *
 * BEFORE MAINNET, verify each address against the official source:
 *   USDC  -> Circle:   https://developers.circle.com/stablecoins/usdc-contract-addresses
 *   USDG  -> Paxos / Global Dollar docs
 *   Robinhood Chain (ids, RPCs, explorers, canonical tokens)
 *         -> https://docs.robinhood.com/chain
 *
 * Known network parameters (still verify):
 *   Base mainnet        8453
 *   Base Sepolia        84532
 *   Robinhood mainnet   4663   rpc.mainnet.chain.robinhood.com
 *   Robinhood testnet   46630  rpc.testnet.chain.robinhood.com
 *
 * Public RPCs are rate limited — set a paid RPC URL in production.
 */

export type TokenSymbol = 'USDC' | 'USDG';

export interface TokenConfig {
  symbol: TokenSymbol;
  address: `0x${string}`;
  /** Read from the contract at startup and cached. Never hardcoded. */
  decimals?: number;
}

export interface ChainConfig {
  id: number;
  key: 'base' | 'robinhood';
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  confirmations: number;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  tokens: TokenConfig[];
}

function token(symbol: TokenSymbol, address: string | undefined): TokenConfig[] {
  // A blank address means "this token does not exist on this chain" — the
  // rail is then hidden from the UI rather than shown as a broken option.
  return address ? [{ symbol, address: address.toLowerCase() as `0x${string}` }] : [];
}

let cachedChains: ChainConfig[] | undefined;

export function chains(): ChainConfig[] {
  if (cachedChains) return cachedChains;
  const e = env();

  cachedChains = [
    {
      id: e.BASE_CHAIN_ID,
      key: 'base',
      name: e.BASE_CHAIN_ID === 84532 ? 'Base Sepolia' : 'Base',
      rpcUrl: e.BASE_RPC_URL,
      explorerUrl: e.BASE_EXPLORER_URL.replace(/\/$/, ''),
      confirmations: e.BASE_CONFIRMATIONS,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      tokens: [...token('USDC', e.BASE_USDC_ADDRESS), ...token('USDG', e.BASE_USDG_ADDRESS)],
    },
    {
      id: e.RHC_CHAIN_ID,
      key: 'robinhood',
      name: e.RHC_CHAIN_ID === 46630 ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
      rpcUrl: e.RHC_RPC_URL,
      explorerUrl: e.RHC_EXPLORER_URL.replace(/\/$/, ''),
      confirmations: e.RHC_CONFIRMATIONS,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      tokens: [...token('USDG', e.RHC_USDG_ADDRESS), ...token('USDC', e.RHC_USDC_ADDRESS)],
    },
  ];

  return cachedChains;
}

/** Only chains that have at least one configured token are offered at checkout. */
export function activeChains(): ChainConfig[] {
  return chains().filter((c) => c.tokens.length > 0);
}

export function chainById(id: number): ChainConfig | undefined {
  return chains().find((c) => c.id === id);
}

export function tokenOn(chainId: number, symbol: TokenSymbol): TokenConfig | undefined {
  return chainById(chainId)?.tokens.find((t) => t.symbol === symbol);
}

export function tokenByAddress(chainId: number, address: string): TokenConfig | undefined {
  const lower = address.toLowerCase();
  return chainById(chainId)?.tokens.find((t) => t.address === lower);
}

/** Every (chain, token) pair the app accepts. Used by the watcher and the UI. */
export function supportedRails(): Array<{ chain: ChainConfig; token: TokenConfig }> {
  return activeChains().flatMap((chain) => chain.tokens.map((token) => ({ chain, token })));
}

export function txUrl(chainId: number, txHash: string): string {
  const chain = chainById(chainId);
  return chain ? `${chain.explorerUrl}/tx/${txHash}` : '#';
}

export function addressUrl(chainId: number, address: string): string {
  const chain = chainById(chainId);
  return chain ? `${chain.explorerUrl}/address/${address}` : '#';
}
