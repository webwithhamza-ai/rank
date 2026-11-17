export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || '[YOUR_SITE_NAME]';
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
export const PUBLIC_APP_MODE = (process.env.NEXT_PUBLIC_APP_MODE || 'mock') as
  | 'mock'
  | 'testnet'
  | 'mainnet';

export const DISCLAIMER =
  'Rankings are paid placements, not endorsements. Do your own research. Payments are final unless stated otherwise.';
