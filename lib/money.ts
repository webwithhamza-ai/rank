/** Money helpers. Cents are integers everywhere; floats never touch a total. */

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rest = abs % 100;
  const whole = dollars.toLocaleString('en-US');
  return rest === 0 ? `${sign}$${whole}` : `${sign}$${whole}.${String(rest).padStart(2, '0')}`;
}

export function formatCentsExact(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
}

/** Parse user input like "25", "25.50", "$25" into integer cents. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToDollarsString(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * Token base units -> cents, using the decimals read from the contract.
 * Truncates sub-cent dust rather than rounding up, so we never credit money
 * that did not arrive.
 */
export function baseUnitsToCents(amount: bigint, decimals: number): number {
  if (decimals <= 2) return Number(amount * BigInt(10 ** (2 - decimals)));
  const divisor = 10n ** BigInt(decimals - 2);
  return Number(amount / divisor);
}

export function centsToBaseUnits(cents: number, decimals: number): bigint {
  if (decimals <= 2) return BigInt(cents) / BigInt(10 ** (2 - decimals));
  return BigInt(cents) * 10n ** BigInt(decimals - 2);
}
