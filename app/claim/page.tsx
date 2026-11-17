import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, accounts } from '@/db';
import { getBoardEntries } from '@/lib/board';
import { supportedRails } from '@/config/chains';
import { isDbConfigured, appMode } from '@/lib/env';
import { SetupNotice } from '@/components/SetupNotice';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { ClaimForm } from '@/components/ClaimForm';
import { DISCLAIMER } from '@/lib/site';
import type { RankableEntry } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Claim a rank',
  description: 'Pick an amount, scan the QR code, take your place on the board.',
};

function strip<T extends RankableEntry>(entries: T[]): RankableEntry[] {
  return entries.map((e) => ({
    id: e.id,
    scoreCents: e.scoreCents,
    scoreReachedAt: e.scoreReachedAt,
    category: e.category,
    hidden: e.hidden,
  }));
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ outbid?: string }>;
}) {
  if (!isDbConfigured()) return <SetupNotice />;

  const { outbid } = await searchParams;
  const session = await auth();

  if (!session?.user?.accountId) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">Sign in to claim</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Only X accounts can be listed, so the board is tied to your X login. We read your handle,
          name and avatar — nothing else, and we never post.
        </p>
        <ButtonLink href="/login" size="lg" className="mt-6">
          {appMode() === 'mock' ? 'Mock X login' : 'Continue with X'}
        </ButtonLink>
        <p className="mt-8 text-xs leading-relaxed text-muted">{DISCLAIMER}</p>
      </div>
    );
  }

  const [account] = await db()
    .select()
    .from(accounts)
    .where(eq(accounts.id, session.user.accountId))
    .limit(1);

  const [allTime, today] = await Promise.all([
    getBoardEntries('alltime'),
    getBoardEntries('today'),
  ]);

  const outbidHandle = outbid?.replace(/^@/, '').toLowerCase();
  const outbidTarget = outbidHandle
    ? allTime.find((entry) => entry.handle.toLowerCase() === outbidHandle) ?? null
    : null;

  const rails = supportedRails().map(({ chain, token }) => ({
    chainId: chain.id,
    chainName: chain.name,
    tokenSymbol: token.symbol,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Claim your rank</h1>
          <p className="mt-1 text-sm text-muted">
            Anything from $1 up. Your rank is the sum of everything you have ever paid.
          </p>
        </div>
        <Link href={`/u/${account?.handle}`} className="text-sm text-muted hover:text-fg">
          Signed in as <span className="font-semibold text-fg">@{account?.handle}</span>
        </Link>
      </header>

      <ClaimForm
        accountId={account.id}
        currentTotalCents={account.totalCents}
        currentCategory={account.category}
        currentTagline={account.tagline}
        currentLink={account.link}
        allTimeEntries={strip(allTime)}
        todayEntries={strip(today)}
        rails={rails}
        outbid={
          outbidTarget
            ? { handle: outbidTarget.handle, totalCents: outbidTarget.scoreCents }
            : null
        }
      />

      <Card accent="subtle" shadow="none" className="p-4">
        <p className="text-xs leading-relaxed text-muted">{DISCLAIMER}</p>
      </Card>
    </div>
  );
}
