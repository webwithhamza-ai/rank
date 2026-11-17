import './load-env';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createWalletClient, defineChain, formatEther, formatUnits, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { activeChains } from '../config/chains';
import { publicClientFor, ERC20_ABI } from '../lib/rpc';
import { ACCOUNT_PATH, derivePrivateKeyFromMnemonic } from '../lib/wallet';
import { env } from '../lib/env';

/**
 * LOCAL ONLY. Moves stablecoins out of deposit addresses into the treasury.
 *
 * This script needs the mnemonic, which is exactly why it never runs on the
 * server. Keep it on your own machine, read the seed from an offline file or
 * the prompt, and never add it to any .env that gets deployed.
 *
 *   pnpm sweep -- --dry-run
 *   pnpm sweep -- --mnemonic-file ./secret/seed.txt
 *
 * Deposit addresses hold no ETH, so each one is topped up with a small gas
 * amount from a gas wallet derived at m/44'/60'/0'/1/0 — fund that address
 * with ETH on each chain before sweeping.
 */

const GAS_WALLET_PATH = `${ACCOUNT_PATH}/1/0`;
const GAS_TOP_UP = parseEther('0.00005');

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const dryRun = process.argv.includes('--dry-run');

async function readMnemonic(): Promise<string> {
  const file = arg('mnemonic-file') ?? process.env.SWEEP_MNEMONIC_FILE;
  if (file) return readFileSync(file, 'utf8').trim();

  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question('Mnemonic (typed input is visible — use --mnemonic-file to avoid that): ');
  rl.close();
  return answer.trim();
}

function gasWalletKey(mnemonic: string): `0x${string}` {
  const root = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic));
  const node = root.derive(GAS_WALLET_PATH);
  if (!node.privateKey) throw new Error('Could not derive the gas wallet');
  return `0x${Buffer.from(node.privateKey).toString('hex')}`;
}

async function main() {
  const treasury = env().TREASURY_ADDRESS;
  if (!treasury) {
    console.error('TREASURY_ADDRESS is not set.');
    process.exit(1);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set — the script reads derivation indices from it.');
    process.exit(1);
  }

  const mnemonic = await readMnemonic();
  const gasAccount = privateKeyToAccount(gasWalletKey(mnemonic));

  console.log(`\nTreasury:   ${treasury}`);
  console.log(`Gas wallet: ${gasAccount.address}  (${GAS_WALLET_PATH})`);
  console.log(dryRun ? 'Mode:       DRY RUN — nothing will be broadcast\n' : 'Mode:       LIVE\n');

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql, { schema });
  const rows = await db.select({ index: schema.checkouts.derivationIndex }).from(schema.checkouts);
  const indices = [...new Set(rows.map((r) => r.index))].sort((a, b) => a - b);
  await sql.end();

  if (indices.length === 0) {
    console.log('No deposit addresses have been handed out yet.');
    return;
  }
  console.log(`Checking ${indices.length} deposit addresses across ${activeChains().length} chains…\n`);

  for (const chain of activeChains()) {
    const publicClient = publicClientFor(chain.id);
    const viemChain = defineChain({
      id: chain.id,
      name: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: { default: { http: [chain.rpcUrl] } },
    });
    const walletClient = createWalletClient({
      account: gasAccount,
      chain: viemChain,
      transport: http(chain.rpcUrl),
    });

    const gasBalance = await publicClient.getBalance({ address: gasAccount.address });
    console.log(`── ${chain.name} · gas wallet holds ${formatEther(gasBalance)} ETH`);

    for (const index of indices) {
      const key = derivePrivateKeyFromMnemonic(mnemonic, index);
      const account = privateKeyToAccount(key);

      for (const token of chain.tokens) {
        const balance = (await publicClient.readContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [account.address],
        })) as bigint;

        if (balance === 0n) continue;

        const decimals = (await publicClient.readContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'decimals',
        })) as number;

        console.log(
          `   idx ${index} ${account.address} holds ${formatUnits(balance, Number(decimals))} ${token.symbol}`,
        );

        if (dryRun) continue;

        // Deposit addresses never hold native currency, so fund the gas first.
        const nativeBalance = await publicClient.getBalance({ address: account.address });
        if (nativeBalance < GAS_TOP_UP) {
          const fundHash = await walletClient.sendTransaction({
            chain: viemChain,
            to: account.address,
            value: GAS_TOP_UP,
          });
          console.log(`     gas top-up ${fundHash}`);
          await publicClient.waitForTransactionReceipt({ hash: fundHash });
        }

        const sweepClient = createWalletClient({
          account,
          chain: viemChain,
          transport: http(chain.rpcUrl),
        });
        const hash = await sweepClient.writeContract({
          address: token.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [treasury as `0x${string}`, balance],
        });
        console.log(`     swept -> ${hash}`);
        await publicClient.waitForTransactionReceipt({ hash });
      }
    }
  }

  console.log('\nDone.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
