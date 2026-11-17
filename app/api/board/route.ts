import { NextResponse } from 'next/server';
import { getBoardRows } from '@/lib/board';
import { isDbConfigured } from '@/lib/env';
import { isCategory, type Category } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isDbConfigured()) return NextResponse.json({ rows: [] });

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') === 'today' ? 'today' : 'alltime';
  const rawCategory = url.searchParams.get('category');
  const category: Category | 'ALL' = isCategory(rawCategory) ? rawCategory : 'ALL';

  const rows = await getBoardRows(kind, category);
  return NextResponse.json({ rows }, { headers: { 'cache-control': 'no-store' } });
}
