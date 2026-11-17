import type { Metadata } from 'next';
import { Countdown } from '@/components/Countdown';
import { Hero } from '@/components/Hero';
import { Leaderboard } from '@/components/Leaderboard';
import { SetupNotice } from '@/components/SetupNotice';
import { getBoardRows } from '@/lib/board';
import { isDbConfigured } from '@/lib/env';
import { isCategory, type Category } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Today',
  description: 'Today’s board. Resets every day at 00:00 UTC.',
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category: Category | 'ALL' = isCategory(params.category) ? params.category : 'ALL';

  if (!isDbConfigured()) return <SetupNotice />;

  try {
    const [rows, allTimeRows] = await Promise.all([
      getBoardRows('today', category),
      getBoardRows('alltime', 'ALL'),
    ]);

    return (
      <div>
        <Hero
          leaderCents={rows[0]?.scoreCents ?? null}
          title="Take today's #1 for"
          subtitle="Only payments confirmed since 00:00 UTC count here. At midnight it resets and the day starts again."
          aside={<Countdown />}
        />
        <Leaderboard
          kind="today"
          category={category}
          initialRows={rows}
          sidebarRows={allTimeRows}
          sidebarTitle="All-time ranking"
          sidebarHref="/"
        />
      </div>
    );
  } catch (error) {
    return <SetupNotice error={error instanceof Error ? error.message : String(error)} />;
  }
}
