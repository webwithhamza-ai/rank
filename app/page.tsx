import { Hero } from '@/components/Hero';
import { Leaderboard } from '@/components/Leaderboard';
import { SetupNotice } from '@/components/SetupNotice';
import { getBoardRows } from '@/lib/board';
import { isDbConfigured } from '@/lib/env';
import { isCategory, type Category } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category: Category | 'ALL' = isCategory(params.category) ? params.category : 'ALL';

  if (!isDbConfigured()) {
    return (
      <div className="space-y-8">
        <Hero
          leaderCents={null}
          title="Claim #1 for"
          subtitle="No ads. No algorithm. Rank is the sum of what you paid."
        />
        <SetupNotice />
      </div>
    );
  }

  try {
    const [rows, todayRows] = await Promise.all([
      getBoardRows('alltime', category),
      getBoardRows('today', 'ALL'),
    ]);

    return (
      <div>
        <Hero
          leaderCents={rows[0]?.scoreCents ?? null}
          title="Claim #1 for"
          subtitle="A leaderboard for X accounts where position is bought, not earned. Scan a QR code, pay in stablecoins, climb."
        />
        <Leaderboard
          kind="alltime"
          category={category}
          initialRows={rows}
          sidebarRows={todayRows}
          sidebarTitle="Today's ranking"
          sidebarHref="/today"
        />
      </div>
    );
  } catch (error) {
    return <SetupNotice error={error instanceof Error ? error.message : String(error)} />;
  }
}
