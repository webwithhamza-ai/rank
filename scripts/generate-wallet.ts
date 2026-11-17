import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { ACCOUNT_PATH, deriveAddressFromXpub, xpubFromMnemonic } from '../lib/wallet';

/**
 * LOCAL ONLY. Never run this on a server.
 *
 * Creates a fresh wallet dedicated to this project, prints the xpub to paste
 * into DEPOSIT_XPUB, and shows the mnemonic once so you can write it down.
 */
function main() {
  const mnemonic = generateMnemonic(wordlist, 256);
  const xpub = xpubFromMnemonic(mnemonic);

  const rule = '='.repeat(72);
  console.log(`\n${rule}`);
  console.log('  NEW DEPOSIT WALLET — WRITE THE MNEMONIC DOWN, THEN CLEAR THIS SCREEN');
  console.log(rule);

  console.log('\nMNEMONIC (offline only — never paste this into a server, .env or chat):\n');
  console.log(`  ${mnemonic}\n`);

  console.log('DEPOSIT_XPUB (safe to put in the server environment):\n');
  console.log(`  ${xpub}\n`);

  console.log(`Account path: ${ACCOUNT_PATH}`);
  console.log('First three deposit addresses (sanity check):');
  for (let i = 0; i < 3; i += 1) {
    console.log(`  ${ACCOUNT_PATH}/0/${i}  ${deriveAddressFromXpub(xpub, i)}`);
  }

  console.log(`\n${rule}`);
  console.log('  1. Use a FRESH wallet for this project only. Never reuse a personal wallet.');
  console.log('  2. Store the mnemonic offline (paper or a hardware/password manager).');
  console.log('  3. The server gets DEPOSIT_XPUB only. It can watch, never spend.');
  console.log('  4. Sweep funds with scripts/sweep.ts from your own machine.');
  console.log(`${rule}\n`);
}

main();
