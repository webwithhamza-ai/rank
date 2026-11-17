import { createHash } from 'node:crypto';
import { env } from '@/lib/env';

/** Raw IPs are never stored — only a salted hash, for dedupe and abuse limits. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${env().IP_HASH_SALT}:${ip}`).digest('hex').slice(0, 32);
}

export function ipFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? '0.0.0.0';
}

export function ipHashFromHeaders(headers: Headers): string {
  return hashIp(ipFromHeaders(headers));
}
