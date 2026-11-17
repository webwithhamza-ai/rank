import { NextResponse } from 'next/server';
import { appMode, env, isDbConfigured } from '@/lib/env';
import { runWatcherCycle } from '@/lib/watcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron-triggered watcher cycle, for deployments (Vercel) that cannot run a
 * long-lived worker. Schedule it every minute; it is safe to overlap because
 * crediting is idempotent.
 */
async function handle(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL is not set' }, { status: 503 });
  }
  if (appMode() === 'mock') {
    return NextResponse.json({ error: 'Nothing to watch in MOCK mode' }, { status: 400 });
  }

  const secret = env().CRON_SECRET;
  if (secret) {
    const header = request.headers.get('authorization');
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
  }

  const results = await runWatcherCycle();
  return NextResponse.json({ results });
}

export const GET = handle;
export const POST = handle;
