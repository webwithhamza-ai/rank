import './load-env';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWalletClient, http, defineChain, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import solc from 'solc';
import { chains } from '../config/chains';
import { appMode } from '../lib/env';

/**
 * Deploys Test USDC and Test USDG to both configured testnets and writes the
 * addresses back into .env.local, so TESTNET mode works without hunting for
 * faucet tokens that may not exist.
 *
 *   DEPLOYER_PRIVATE_KEY=0x… pnpm deploy:mocks
 *
 * Get gas first:
 *   Base Sepolia      https://docs.base.org/chain/network-faucets
 *   Robinhood testnet https://faucet.testnet.chain.robinhood.com
 */

const ENV_KEYS: Record<'base' | 'robinhood', { USDC: string; USDG: string }> = {
  base: { USDC: 'BASE_USDC_ADDRESS', USDG: 'BASE_USDG_ADDRESS' },
  robinhood: { USDC: 'RHC_USDC_ADDRESS', USDG: 'RHC_USDG_ADDRESS' },
};

function compile() {
  const source = readFileSync(resolve('contracts/MockStablecoin.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'MockStablecoin.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((e: { formattedMessage: string }) => e.formattedMessage).join('\n'));
  }

  const contract = output.contracts['MockStablecoin.sol'].MockStablecoin;
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}` as `0x${string}`,
  };
}

function writeEnvLocal(updates: Record<string, string>) {
  const path = resolve('.env.local');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  let next = existing;

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    next = pattern.test(next) ? next.replace(pattern, line) : `${next.replace(/\n*$/, '\n')}${line}\n`;
  }

  writeFileSync(path, next);
  console.log(`\nWrote ${Object.keys(updates).length} addresses to .env.local`);
}

async function main() {
  if (appMode() === 'mainnet') {
    console.error('Refusing to deploy mock tokens with APP_MODE=mainnet.');
    process.exit(1);
  }

  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) {
    console.error('Set DEPLOYER_PRIVATE_KEY to a funded testnet key first.');
    process.exit(1);
  }

  const account = privateKeyToAccount(key as `0x${string}`);
  const { abi, bytecode } = compile();
  console.log(`Deployer: ${account.address}\n`);

  const updates: Record<string, string> = {};

  for (const chain of chains()) {
    const viemChain = defineChain({
      id: chain.id,
      name: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcUrls: { default: { http: [chain.rpcUrl] } },
    });
    const publicClient = createPublicClient({ chain: viemChain, transport: http(chain.rpcUrl) });
    const walletClient = createWalletClient({ account, chain: viemChain, transport: http(chain.rpcUrl) });

    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`── ${chain.name} (${chain.id}) · balance ${balance} wei`);
    if (balance === 0n) {
      console.warn('   No gas on this chain, skipping. Use the faucet first.');
      continue;
    }

    for (const [symbol, name] of [
      ['USDC', 'Test USDC'],
      ['USDG', 'Test USDG'],
    ] as const) {
      const hash = await walletClient.deployContract({
        abi,
        bytecode,
        args: [name, `t${symbol}`],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const address = receipt.contractAddress;
      if (!address) throw new Error(`Deployment of ${name} produced no address`);

      console.log(`   ${name.padEnd(10)} ${address}`);
      updates[ENV_KEYS[chain.key][symbol]] = address;
    }
  }

  if (Object.keys(updates).length === 0) {
    console.log('\nNothing deployed.');
    return;
  }

  writeEnvLocal(updates);
  console.log('Restart the dev server and the watcher to pick up the new addresses.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
