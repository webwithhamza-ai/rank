import { describe, expect, it } from 'vitest';
import { isAddress } from 'viem';
import { DEV_MNEMONIC, deriveAddressFromXpub, isValidXpub, xpubFromMnemonic } from '@/lib/wallet';
import { buildEip681Uri } from '@/lib/payment-uri';

describe('deposit address derivation', () => {
  const xpub = xpubFromMnemonic(DEV_MNEMONIC);

  it('produces a usable extended public key', () => {
    expect(isValidXpub(xpub)).toBe(true);
    expect(isValidXpub('not-an-xpub')).toBe(false);
  });

  it('derives checksummed EVM addresses', () => {
    const address = deriveAddressFromXpub(xpub, 0);
    expect(isAddress(address)).toBe(true);
  });

  it('matches the well-known first address of the standard test mnemonic', () => {
    // m/44'/60'/0'/0/0 of "test test … junk" — the account every EVM dev tool
    // prints first, so a wrong derivation path shows up immediately.
    expect(deriveAddressFromXpub(xpub, 0)).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(deriveAddressFromXpub(xpub, 1)).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  });

  it('gives every index its own address', () => {
    const addresses = new Set([0, 1, 2, 3, 4].map((i) => deriveAddressFromXpub(xpub, i)));
    expect(addresses.size).toBe(5);
  });

  it('is deterministic', () => {
    expect(deriveAddressFromXpub(xpub, 7)).toBe(deriveAddressFromXpub(xpub, 7));
  });

  it('refuses nonsense indices', () => {
    expect(() => deriveAddressFromXpub(xpub, -1)).toThrow();
    expect(() => deriveAddressFromXpub(xpub, 1.5)).toThrow();
  });
});

describe('EIP-681 payment URI', () => {
  it('encodes chain, token, recipient and amount', () => {
    const uri = buildEip681Uri({
      tokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      chainId: 8453,
      depositAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      amountBaseUnits: 25_000_000n,
    });

    expect(uri).toBe(
      'ethereum:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913@8453/transfer' +
        '?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266&uint256=25000000',
    );
  });
});
