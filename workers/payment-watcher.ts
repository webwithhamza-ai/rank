import '../scripts/load-env';
import { env, appMode } from '../lib/env';
import { activeChains } from '../config/chains';
import { primeDecimals } from '../lib/tokens';
import { runWatcherCycle } from '../lib/watcher';

/**
 * Long-running payment watcher.
 *
 * Deploy this separately from the web app (Railway, Render, Fly). Vercel's
 * serverless functions cannot hold a polling loop open — for that deployment
 * shape, hit /api/cron/watch on a schedule instead.
 */
async function main() {
  if (appMode() === 'mock') {
    console.error('APP_MODE=mock — there is no chain to watch. Use the simulate panel instead.');
    process.exit(1);
  }

  const chains = activeChains();
  if (chains.length === 0) {
    console.error('No chains have a configured token address. Check your env file.');
    process.exit(1);
  }

  console.log(`[watcher] mode=${appMode()}`);
  for (const chain of chains) {
    console.log(
      `[watcher] ${chain.name} (${chain.id}) · ${chain.confirmations} confirmations · ` +
        chain.tokens.map((t) => t.symbol).join(', '),
    );
  }

  await primeDecimals();
  for (const chain of chains) {
    for (const token of chain.tokens) {
      console.log(`[watcher] ${token.symbol} on ${chain.name}: ${token.decimals ?? '?'} decimals`);
    }
  }

  let running = true;
  const stop = () => {
    running = false;
    console.log('\n[watcher] shutting down after the current cycle');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  const interval = env().WATCHER_POLL_MS;

  while (running) {
    const started = Date.now();
    try {
      const results = await runWatcherCycle();
      for (const result of results) {
        if (result.skipped) {
          console.warn(`[watcher] ${result.chainName}: ${result.skipped}`);
        } else if (result.confirmed > 0 || result.detected > 0) {
          console.log(
            `[watcher] ${result.chainName}: blocks ${result.scannedFrom}-${result.scannedTo} · ` +
              `${result.confirmed} confirmed, ${result.detected} detected`,
          );
        }
      }
    } catch (error) {
      console.error('[watcher] cycle failed', error);
    }

    const elapsed = Date.now() - started;
    if (running && elapsed < interval) {
      await new Promise((resolve) => setTimeout(resolve, interval - elapsed));
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
