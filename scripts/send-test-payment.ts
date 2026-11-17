import './load-env';
import { createWalletClient, defineChain, http, createPublicClient, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { chainById, tokenOn, type TokenSymbol } from '../config/chains';
import { ERC20_ABI } from '../lib/rpc';
import { parseDollarsToCents, centsToBaseUnits } from '../lib/money';
import { appMode } from '../lib/env';

/**
 * Mints test stablecoins and sends them to a deposit address, so the whole
 * payment flow can be exercised from the terminal.
 *
 *   DEPLOYER_PRIVATE_KEY=0x… pnpm send:test -- \
 *     --to 0xDEPOSIT --amount 25 --chain 84532 --token USDC
 */

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  if (appMode() === 'mainnet') {
    console.error('Refusing to run against mainnet.');
    process.exit(1);
  }

  const to = arg('to');
  const amount = arg('amount') ?? '25';
  const chainId = Number(arg('chain') ?? process.env.BASE_CHAIN_ID ?? 84532);
  const symbol = (arg('token') ?? 'USDC') as TokenSymbol;
  const key = process.env.DEPLOYER_PRIVATE_KEY;

  if (!to || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
    console.error('Pass a deposit address with --to 0x…');
    process.exit(1);
  }
  if (!key) {
    console.error('Set DEPLOYER_PRIVATE_KEY to a funded testnet key.');
    process.exit(1);
  }

  const chain = chainById(chainId);
  const token = tokenOn(chainId, symbol);
  if (!chain || !token) {
    console.error(`${symbol} is not configured on chain ${chainId}. Run pnpm deploy:mocks first.`);
    process.exit(1);
  }

  const cents = parseDollarsToCents(amount);
  if (cents === null) {
    console.error(`Could not read "${amount}" as a dollar amount.`);
    process.exit(1);
  }

  const viemChain = defineChain({
    id: chain.id,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: { default: { http: [chain.rpcUrl] } },
  });
  const account = privateKeyToAccount(key as `0x${string}`);
  const publicClient = createPublicClient({ chain: viemChain, transport: http(chain.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: viemChain, transport: http(chain.rpcUrl) });

  const decimals = Number(
    await publicClient.readContract({ address: token.address, abi: ERC20_ABI, functionName: 'decimals' }),
  );
  const value = centsToBaseUnits(cents, decimals);

  console.log(`Sending ${formatUnits(value, decimals)} ${symbol} on ${chain.name} to ${to}`);

  const mintHash = await walletClient.writeContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'mint',
    args: [account.address, value],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`  minted  ${mintHash}`);

  const transferHash = await walletClient.writeContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to as `0x${string}`, value],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });
  console.log(`  sent    ${transferHash}`);
  console.log(`  block   ${receipt.blockNumber}`);
  console.log(`\nExplorer: ${chain.explorerUrl}/tx/${transferHash}`);
  console.log('The watcher will credit it once it has enough confirmations.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
