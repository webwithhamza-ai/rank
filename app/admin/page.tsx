import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq, inArray } from 'drizzle-orm';
import { db, accounts, checkouts, payments, reports } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { isDbConfigured } from '@/lib/env';
import { getSiteStats } from '@/lib/stats';
import { formatCents } from '@/lib/money';
import { txUrl } from '@/config/chains';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { SetupNotice } from '@/components/SetupNotice';
import { RefundForm } from '@/components/RefundForm';
import { toggleHidden, resolveReport } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admin' };

const NEEDS_ATTENTION = ['flagged', 'under_minimum'] as const;

export default async function AdminPage() {
  if (!isDbConfigured()) return <SetupNotice />;

  const session = await requireAdmin();
  if (!session) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Admin only</h1>
        <p className="mt-2 text-sm text-muted">
          Your X user id is not in{' '}
          <code className="rounded-sm bg-subtle px-1 font-mono text-[13px]">ADMIN_X_IDS</code>.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-muted hover:text-fg">
          ← Back
        </Link>
      </Card>
    );
  }

  const database = db();
  const [stats, allAccounts, attention, recentPayments, openCheckouts, openReports] =
    await Promise.all([
      getSiteStats(),
      database.select().from(accounts).orderBy(desc(accounts.totalCents)).limit(200),
      database
        .select()
        .from(payments)
        .where(inArray(payments.status, [...NEEDS_ATTENTION]))
        .orderBy(desc(payments.createdAt))
        .limit(100),
      database.select().from(payments).orderBy(desc(payments.createdAt)).limit(50),
      database.select().from(checkouts).orderBy(desc(checkouts.createdAt)).limit(50),
      database
        .select()
        .from(reports)
        .where(eq(reports.resolved, false))
        .orderBy(desc(reports.createdAt))
        .limit(50),
    ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>

      <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Revenue" value={formatCents(stats.totalRevenueCents)} highlight />
        <Stat label="Today" value={formatCents(stats.todayRevenueCents)} />
        <Stat label="Listings" value={String(stats.listings)} />
        <Stat label="Payments" value={String(stats.payments)} />
      </Card>

      <Section title={`Needs attention (${attention.length})`}>
        {attention.length === 0 ? (
          <Empty>Nothing flagged or under minimum.</Empty>
        ) : (
          <ul className="space-y-2">
            {attention.map((payment) => (
              <li key={payment.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-center gap-3 text-[13px]">
                    <Tag tone="primary">{payment.status.replace('_', ' ')}</Tag>
                    <span className="font-bold tabular-nums">
                      {formatCents(payment.amountCents)}
                    </span>
                    <a
                      href={txUrl(payment.chainId, payment.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-muted underline underline-offset-2 hover:text-fg"
                    >
                      {payment.txHash.slice(0, 20)}…
                    </a>
                    <span className="text-muted">from {payment.fromAddress ?? 'unknown'}</span>
                  </div>
                  {payment.note ? (
                    <p className="mt-1.5 text-xs text-muted">{payment.note}</p>
                  ) : null}
                  <div className="mt-3">
                    <RefundForm paymentId={payment.id} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Reports (${openReports.length})`}>
        {openReports.length === 0 ? (
          <Empty>No open reports.</Empty>
        ) : (
          <ul className="space-y-2">
            {openReports.map((report) => (
              <li key={report.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4 text-[13px]">
                  <p className="min-w-0 flex-1">{report.reason}</p>
                  <span className="text-muted">
                    {new Date(report.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                  </span>
                  <form action={resolveReport}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <Button type="submit" size="sm" variant="success">
                      Resolve
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Listings">
        <ul className="space-y-1.5">
          {allAccounts.map((account) => (
            <li key={account.id}>
              <Card className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                <Link href={`/u/${account.handle}`} className="font-medium hover:text-primary">
                  @{account.handle}
                </Link>
                {account.isMock ? <Tag>DEV</Tag> : null}
                {account.hidden ? <Tag tone="primary">Hidden</Tag> : null}
                <span className="text-muted">{account.category}</span>
                <span className="ml-auto font-bold tabular-nums">
                  {formatCents(account.totalCents)}
                </span>
                <form action={toggleHidden}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <Button type="submit" size="sm" variant={account.hidden ? 'success' : 'secondary'}>
                    {account.hidden ? 'Unhide' : 'Hide'}
                  </Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Recent payments">
        <ul className="space-y-1.5">
          {recentPayments.map((payment) => (
            <li key={payment.id}>
              <Card className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                <Tag tone={payment.status === 'confirmed' ? 'success' : 'subtle'}>
                  {payment.status}
                </Tag>
                <span className="font-semibold tabular-nums">
                  {formatCents(payment.amountCents)}
                </span>
                <a
                  href={txUrl(payment.chainId, payment.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-muted underline underline-offset-2 hover:text-fg"
                >
                  {payment.txHash.slice(0, 18)}…
                </a>
                <span className="ml-auto text-muted">
                  {payment.confirmedAt
                    ? new Date(payment.confirmedAt).toISOString().slice(0, 16).replace('T', ' ')
                    : 'pending'}
                </span>
                {payment.status === 'confirmed' ? <RefundForm paymentId={payment.id} /> : null}
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Recent checkouts">
        <ul className="space-y-1.5">
          {openCheckouts.map((checkout) => (
            <li key={checkout.id}>
              <Card className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                <Tag>{checkout.status}</Tag>
                <span className="font-semibold tabular-nums">
                  {formatCents(checkout.expectedCents)}
                </span>
                <span className="text-muted">
                  {checkout.tokenSymbol} · chain {checkout.chainId} · idx {checkout.derivationIndex}
                </span>
                <span className="ml-auto break-all font-mono text-[11px] text-muted">
                  {checkout.depositAddress}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{children}</p>
    </Card>
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
      <dd className={`text-xl font-bold tabular-nums ${highlight ? 'text-primary' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
