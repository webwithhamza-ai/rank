import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { secp256k1 } from '@noble/curves/secp256k1';
import { getAddress, keccak256 } from 'viem';

/**
 * Deposit address derivation.
 *
 * The server holds only an extended PUBLIC key. It can compute addresses but
 * cannot sign for them — a compromised server cannot move a single cent.
 * The mnemonic lives offline and is used only by scripts/sweep.ts. See SECURITY.md.
 *
 * Account path: m/44'/60'/0'   (DEPOSIT_XPUB is the xpub at this node)
 * Address path: m/44'/60'/0'/0/{index}
 *
 * Base and Robinhood Chain are both EVM chains, so one derived address
 * receives on either.
 */

export const ACCOUNT_PATH = "m/44'/60'/0'";

/**
 * Public, universally-known test mnemonic. Used only so MOCK mode works with
 * zero setup. Never use it for real funds.
 */
export const DEV_MNEMONIC = 'test test test test test test test test test test test junk';

function publicKeyToEvmAddress(compressedPublicKey: Uint8Array): `0x${string}` {
  const point = secp256k1.ProjectivePoint.fromHex(compressedPublicKey);
  const uncompressed = point.toRawBytes(false); // 65 bytes: 0x04 || X || Y
  const hash = keccak256(uncompressed.slice(1));
  return getAddress(`0x${hash.slice(-40)}`);
}

export function xpubFromMnemonic(mnemonic: string, passphrase = ''): string {
  const seed = mnemonicToSeedSync(mnemonic.trim(), passphrase);
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(ACCOUNT_PATH);
  return account.publicExtendedKey;
}

let devXpubCache: string | undefined;

export function devXpub(): string {
  if (!devXpubCache) devXpubCache = xpubFromMnemonic(DEV_MNEMONIC);
  return devXpubCache;
}

export function deriveAddressFromXpub(xpub: string, index: number): `0x${string}` {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Derivation index must be a non-negative integer, got ${index}`);
  }
  const account = HDKey.fromExtendedKey(xpub.trim());
  const child = account.deriveChild(0).deriveChild(index);
  if (!child.publicKey) throw new Error('Derived node has no public key');
  return publicKeyToEvmAddress(child.publicKey);
}

/** Local-only: derive the private key for a deposit address, for sweeping. */
export function derivePrivateKeyFromMnemonic(
  mnemonic: string,
  index: number,
  passphrase = '',
): `0x${string}` {
  const seed = mnemonicToSeedSync(mnemonic.trim(), passphrase);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`${ACCOUNT_PATH}/0/${index}`);
  if (!child.privateKey) throw new Error('Derived node has no private key');
  return `0x${Buffer.from(child.privateKey).toString('hex')}`;
}

export function isValidXpub(xpub: string): boolean {
  try {
    HDKey.fromExtendedKey(xpub.trim());
    return true;
  } catch {
    return false;
  }
}
