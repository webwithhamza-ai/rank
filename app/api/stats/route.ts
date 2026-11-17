import { NextResponse } from 'next/server';
import { getSiteStats } from '@/lib/stats';
import { isDbConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ visitors: 0, listings: 0 });
  const stats = await getSiteStats();
  return NextResponse.json(stats, { headers: { 'cache-control': 'no-store' } });
}
