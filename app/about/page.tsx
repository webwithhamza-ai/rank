import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { getSiteStats } from '@/lib/stats';
import { isDbConfigured } from '@/lib/env';
import { supportedRails } from '@/config/chains';
import { formatCents } from '@/lib/money';
import { DISCLAIMER, SITE_NAME } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About',
  description: 'How the board works, the rules, and the disclaimer.',
};

const STEPS = [
  {
    title: 'Sign in with X',
    body: 'Your listing is your X account. We read your handle, name and avatar. We never post and never ask you to connect a wallet.',
  },
  {
    title: 'Pick an amount',
    body: 'Anything from $1 up. The calculator shows exactly where that amount lands you before you pay a cent.',
  },
  {
    title: 'Scan the QR code',
    body: 'You get a deposit address that belongs to your checkout alone, plus a QR code any wallet app can read. Send the stablecoin.',
  },
  {
    title: 'Your rank updates',
    body: 'Once the transfer has enough confirmations on chain, your total goes up and the board moves. Every payment links to a block explorer.',
  },
];

const RULES = [
  'Rank is the sum of every confirmed payment on your account. Nothing else moves it.',
  'The minimum credited payment is $1. Anything below that is recorded but not credited.',
  'Ties go to whoever reached the score first.',
  'The Today board counts only payments confirmed since 00:00 UTC and resets at midnight UTC.',
  'We credit what actually arrives, not what was quoted. Send more, get more.',
  'Late payments still count — we keep watching a deposit address for 7 days after it expires.',
  'Send an unsupported token or use an unsupported chain and it will not be credited automatically; it gets flagged for a manual refund.',
  'Hidden listings keep their payments but leave the boards.',
];

export default async function AboutPage() {
  const stats = isDbConfigured() ? await getSiteStats().catch(() => null) : null;
  const rails = supportedRails();

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="pt-4 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">How it works</h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          {SITE_NAME} has no algorithm and no editorial. Position on the board is the sum of what an
          account has paid. That is the whole product.
        </p>
      </header>

      <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
        <Stat label="Visitors" value={(stats?.visitors ?? 0).toLocaleString('en-US')} />
        <Stat label="Listings" value={(stats?.listings ?? 0).toLocaleString('en-US')} />
        <Stat label="Payments" value={(stats?.payments ?? 0).toLocaleString('en-US')} />
        <Stat label="Clicks out" value={(stats?.totalClicks ?? 0).toLocaleString('en-US')} />
        <Stat label="Revenue" value={formatCents(stats?.totalRevenueCents ?? 0)} highlight />
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Four steps</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <Card key={step.title} className="p-5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--primary-soft)] text-[12px] font-semibold text-primary">
                {index + 1}
              </span>
              <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">The rules</h2>
        <Card className="divide-y divide-[var(--border)]">
          {RULES.map((rule) => (
            <p key={rule} className="px-5 py-3 text-[13px] leading-relaxed text-muted">
              {rule}
            </p>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">What we accept</h2>
        {rails.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-muted">No payment rails are configured yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rails.map(({ chain, token }) => (
              <Card key={`${chain.id}-${token.symbol}`} className="p-4">
                <p className="text-[15px] font-semibold">
                  {token.symbol} <span className="font-normal text-muted">on {chain.name}</span>
                </p>
                <p className="mt-1.5 break-all font-mono text-[11px] text-muted">{token.address}</p>
              </Card>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          1 USDC = 1 USDG = $1. Token decimals are read from each contract, never assumed.
        </p>
      </section>

      <Card accent="primary" className="p-6">
        <h2 className="text-base font-semibold">Disclaimer</h2>
        <p className="mt-2 text-[13px] leading-relaxed">{DISCLAIMER}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          A high rank means an account paid for it. It says nothing about whether a project is real,
          safe, or worth your money. Every listing has a Report link if something looks wrong.
        </p>
        <ButtonLink href="/claim" className="mt-5">
          Claim a rank anyway
        </ButtonLink>
      </Card>
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
      <dd className={`text-lg font-bold tabular-nums ${highlight ? 'text-primary' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
