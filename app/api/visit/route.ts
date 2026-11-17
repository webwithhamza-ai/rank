import { NextResponse } from 'next/server';
import { ipHashFromHeaders } from '@/lib/ip';
import { recordVisit } from '@/lib/stats';
import { isDbConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ ok: true });
  await recordVisit(ipHashFromHeaders(request.headers));
  return NextResponse.json({ ok: true });
}
