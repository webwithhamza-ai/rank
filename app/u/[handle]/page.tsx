import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isDbConfigured } from '@/lib/env';
import { getAccountByHandle, getAccountPayments, getBoardRows } from '@/lib/board';
import { txUrl } from '@/config/chains';
import { formatCents } from '@/lib/money';
import { costToOvertakeCents, isCategory, type Category } from '@/lib/ranking';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/ui/Card';
import { CategoryTag, Tag } from '@/components/ui/Tag';
import { ButtonLink } from '@/components/ui/Button';
import { OutboundHandle } from '@/components/OutboundHandle';
import { ReportLink } from '@/components/ReportLink';
import { SetupNotice } from '@/components/SetupNotice';
import { ProfileEditor } from '@/components/ProfileEditor';
import { SignOutButton } from '@/components/SignOutButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  if (!isDbConfigured()) return <SetupNotice />;

  const { handle } = await params;
  const account = await getAccountByHandle(decodeURIComponent(handle));
  if (!account) notFound();

  const [session, allTime, today, history] = await Promise.all([
    auth(),
    getBoardRows('alltime', 'ALL'),
    getBoardRows('today', 'ALL'),
    getAccountPayments(account.id),
  ]);

  const allTimeRow = allTime.find((row) => row.id === account.id);
  const todayRow = today.find((row) => row.id === account.id);
  const isOwner = session?.user?.accountId === account.id;
  const category: Category = isCategory(account.category) ? account.category : 'Other';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar
            handle={account.handle}
            displayName={account.displayName}
            avatarUrl={account.avatarUrl}
            avatarColor={account.avatarColor}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">{account.displayName}</h1>
              {account.isMock ? <Tag>DEV</Tag> : null}
              {account.hidden ? <Tag tone="primary">Hidden</Tag> : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              <OutboundHandle
                accountId={account.id}
                handle={account.handle}
                className="underline underline-offset-2 hover:text-fg"
              />
              <CategoryTag category={category} />
              {account.link ? (
                <a
                  href={account.link}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="hover:text-fg"
                >
                  {account.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                </a>
              ) : null}
              <ReportLink accountId={account.id} handle={account.handle} />
            </div>
            {account.tagline ? (
              <p className="mt-3 text-sm leading-relaxed">{account.tagline}</p>
            ) : null}
          </div>

          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
            <ButtonLink href={`/claim?outbid=${account.handle}`}>Outbid them</ButtonLink>
            <p className="text-xs text-muted">
              {formatCents(costToOvertakeCents(account.totalCents, 0))} takes their place
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <Stat label="All-time rank" value={allTimeRow ? `#${allTimeRow.rank}` : '—'} highlight />
          <Stat label="Today rank" value={todayRow ? `#${todayRow.rank}` : '—'} />
          <Stat label="Total paid" value={formatCents(account.totalCents)} />
          <Stat
            label="Clicks out"
            value={(allTimeRow?.clicks ?? 0).toLocaleString('en-US')}
          />
        </dl>
      </Card>

      {isOwner ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Your listing</h2>
          <ProfileEditor
            category={category}
            tagline={account.tagline ?? ''}
            link={account.link ?? ''}
          />
          <div className="mt-2">
            <SignOutButton />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Payment history</h2>
        {history.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-muted">No confirmed payments yet.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {history.map((payment) => (
              <li key={payment.id}>
                <Card className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                  <span className="text-[15px] font-bold tabular-nums">
                    {formatCents(payment.amountCents)}
                  </span>
                  <Tag tone={payment.status === 'refunded' ? 'primary' : 'success'}>
                    {payment.status}
                  </Tag>
                  <span className="text-muted">
                    {payment.confirmedAt
                      ? new Date(payment.confirmedAt).toISOString().replace('T', ' ').slice(0, 16)
                      : '—'}{' '}
                    UTC
                  </span>
                  <span className="text-muted">{payment.tokenSymbol ?? 'TOKEN'}</span>
                  <a
                    href={txUrl(payment.chainId, payment.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-muted underline underline-offset-2 hover:text-fg"
                  >
                    Verify on explorer
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/" className="inline-block text-sm text-muted hover:text-fg">
        ← Back to the board
      </Link>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd
        className={`text-xl font-bold tabular-nums ${highlight ? 'text-primary' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
