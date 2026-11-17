import { describe, expect, it } from 'vitest';
import {
  baseUnitsToCents,
  centsToBaseUnits,
  centsToDollarsString,
  formatCents,
  formatCentsExact,
  parseDollarsToCents,
} from '@/lib/money';

describe('formatting', () => {
  it('drops trailing cents when they are zero', () => {
    expect(formatCents(10_000)).toBe('$100');
    expect(formatCents(10_050)).toBe('$100.50');
    expect(formatCents(1_234_567)).toBe('$12,345.67');
    expect(formatCentsExact(10_000)).toBe('$100.00');
  });

  it('round-trips through the dollar string used in inputs', () => {
    expect(centsToDollarsString(2500)).toBe('25');
    expect(centsToDollarsString(2550)).toBe('25.50');
    expect(parseDollarsToCents(centsToDollarsString(2550))).toBe(2550);
  });
});

describe('parsing user input', () => {
  it('accepts the shapes people actually type', () => {
    expect(parseDollarsToCents('25')).toBe(2500);
    expect(parseDollarsToCents('$25')).toBe(2500);
    expect(parseDollarsToCents('1,000')).toBe(100_000);
    expect(parseDollarsToCents('25.5')).toBe(2550);
    expect(parseDollarsToCents('0.99')).toBe(99);
  });

  it('rejects anything ambiguous', () => {
    expect(parseDollarsToCents('')).toBeNull();
    expect(parseDollarsToCents('abc')).toBeNull();
    expect(parseDollarsToCents('25.555')).toBeNull();
    expect(parseDollarsToCents('-5')).toBeNull();
  });
});

describe('token base units', () => {
  it('converts using the decimals read from the contract', () => {
    // 6-decimal stablecoin
    expect(baseUnitsToCents(25_000_000n, 6)).toBe(2500);
    expect(centsToBaseUnits(2500, 6)).toBe(25_000_000n);

    // 18-decimal token
    expect(baseUnitsToCents(10n ** 18n, 18)).toBe(100);
    expect(centsToBaseUnits(100, 18)).toBe(10n ** 18n);
  });

  it('truncates sub-cent dust instead of rounding money into existence', () => {
    expect(baseUnitsToCents(25_009_999n, 6)).toBe(2500);
  });
});
