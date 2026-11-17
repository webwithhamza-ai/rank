'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Hint, Input, Label, Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { formatCents, parseDollarsToCents, centsToDollarsString } from '@/lib/money';
import {
  CATEGORIES,
  MIN_PAYMENT_CENTS,
  costToOvertakeCents,
  findRank,
  projectedRank,
  rankEntries,
  rankTargets,
  type Category,
  type RankableEntry,
} from '@/lib/ranking';

interface Rail {
  chainId: number;
  chainName: string;
  tokenSymbol: 'USDC' | 'USDG';
}

interface ClaimFormProps {
  accountId: string;
  currentTotalCents: number;
  currentCategory: string;
  currentTagline: string | null;
  currentLink: string | null;
  allTimeEntries: RankableEntry[];
  todayEntries: RankableEntry[];
  rails: Rail[];
  outbid: { handle: string; totalCents: number } | null;
}

export function ClaimForm({
  accountId,
  currentTotalCents,
  currentCategory,
  currentTagline,
  currentLink,
  allTimeEntries,
  todayEntries,
  rails,
  outbid,
}: ClaimFormProps) {
  const todayTotalCents = todayEntries.find((e) => e.id === accountId)?.scoreCents ?? 0;

  const initialAmount = outbid
    ? centsToDollarsString(costToOvertakeCents(outbid.totalCents, currentTotalCents))
    : '25';

  const [amount, setAmount] = useState(initialAmount);
  const [category, setCategory] = useState<Category>(
    (CATEGORIES as readonly string[]).includes(currentCategory)
      ? (currentCategory as Category)
      : 'Other',
  );
  const [tagline, setTagline] = useState(currentTagline ?? '');
  const [link, setLink] = useState(currentLink ?? '');
  const [railIndex, setRailIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const amountCents = parseDollarsToCents(amount);
  const valid = amountCents !== null && amountCents >= MIN_PAYMENT_CENTS;

  const preview = useMemo(() => {
    const currentAllTime = findRank(rankEntries(allTimeEntries), accountId);
    const currentToday = findRank(rankEntries(todayEntries), accountId);
    const targets = rankTargets(allTimeEntries, accountId, currentTotalCents);

    if (!valid || amountCents === null) {
      return { currentAllTime, currentToday, targets, nextAllTime: null, nextToday: null };
    }

    return {
      currentAllTime,
      currentToday,
      targets,
      nextAllTime: projectedRank(allTimeEntries, accountId, currentTotalCents + amountCents),
      nextToday: projectedRank(todayEntries, accountId, todayTotalCents + amountCents),
    };
  }, [
    accountId,
    allTimeEntries,
    todayEntries,
    amountCents,
    currentTotalCents,
    todayTotalCents,
    valid,
  ]);

  const submit = async () => {
    if (!valid || amountCents === null) return;
    setSubmitting(true);
    setError(null);
    const rail = rails[railIndex];
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amountCents,
        chainId: rail.chainId,
        tokenSymbol: rail.tokenSymbol,
        category,
        tagline: tagline.trim() || undefined,
        link: link.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok || !data.id) {
      setError(data.error ?? 'Could not start checkout');
      setSubmitting(false);
      return;
    }
    router.push(`/checkout/${data.id}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {outbid ? (
          <Card accent="primary" className="px-4 py-3">
            <p className="text-sm">
              <span className="font-semibold">Outbidding @{outbid.handle}.</span> They are on{' '}
              {formatCents(outbid.totalCents)} —{' '}
              {formatCents(costToOvertakeCents(outbid.totalCents, currentTotalCents))} puts you
              above them.
            </p>
          </Card>
        ) : null}

        <Card className="p-5">
          <Step n={1} title="Category" />
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                aria-pressed={category === option}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                  category === option
                    ? 'border-primary bg-primary text-primary-fg'
                    : 'border-line text-muted hover:text-fg',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <Step n={2} title="Amount" />
          <div className="mt-3">
            <Label htmlFor="amount">How much (USD, minimum $1)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted">
                $
              </span>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="pl-8 text-lg font-semibold"
                aria-describedby="amount-help"
              />
            </div>
            <Hint>
              <span id="amount-help">
                {amountCents === null
                  ? 'Enter a number like 25 or 25.50.'
                  : amountCents < MIN_PAYMENT_CENTS
                    ? 'Below $1 is recorded but not credited to your rank.'
                    : `You are paying ${formatCents(amountCents)}.`}
              </span>
            </Hint>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Shortcut label="Take #1" cents={preview.targets.takeFirst} onPick={setAmount} />
            <Shortcut label="Take #3" cents={preview.targets.takeThird} onPick={setAmount} />
            <Shortcut label="Top 10" cents={preview.targets.enterTopTen} onPick={setAmount} />
          </div>
        </Card>

        <Card className="p-5">
          <Step n={3} title="Your listing" />
          <div className="mt-3 space-y-4">
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                maxLength={80}
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="Building the thing everyone will copy"
              />
              <Hint>{80 - tagline.length} characters left</Hint>
            </div>
            <div>
              <Label htmlFor="link">Project link (optional)</Label>
              <Input
                id="link"
                type="url"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <Step n={4} title="Pay with" />
          {rails.length === 0 ? (
            <p className="mt-3 text-sm text-primary">
              No payment rails are configured. Set at least one token address in the environment.
            </p>
          ) : (
            <div className="mt-3">
              <Label htmlFor="rail">Chain and token</Label>
              <Select
                id="rail"
                value={railIndex}
                onChange={(event) => setRailIndex(Number(event.target.value))}
              >
                {rails.map((rail, index) => (
                  <option key={`${rail.chainId}-${rail.tokenSymbol}`} value={index}>
                    {rail.tokenSymbol} on {rail.chainName}
                  </option>
                ))}
              </Select>
              <Hint>
                You get a QR code and an address. No wallet connection — we never ask you to
                connect one.
              </Hint>
            </div>
          )}
        </Card>

        {error ? <p className="text-sm text-primary">{error}</p> : null}

        <Button
          size="lg"
          className="w-full"
          disabled={!valid || submitting || rails.length === 0}
          onClick={submit}
        >
          {submitting ? 'Creating checkout…' : `Continue — ${valid ? formatCents(amountCents!) : '—'}`}
        </Button>
      </div>

      <aside>
        <div className="space-y-3 lg:sticky lg:top-20">
          <Card accent="primary" className="p-5 text-center">
            <p className="text-[13px] text-muted">After this payment</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-primary">
              {preview.nextAllTime ? `#${preview.nextAllTime}` : '—'}
            </p>
            <p className="text-[13px] text-muted">all-time</p>
            <p className="mt-3 border-t border-[var(--primary)]/20 pt-3 text-xl font-bold">
              {preview.nextToday ? `#${preview.nextToday}` : '—'}
            </p>
            <p className="text-[13px] text-muted">today</p>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-[13px] font-semibold">Where you are now</p>
            <dl className="space-y-1.5 text-[13px]">
              <Row
                label="All-time rank"
                value={preview.currentAllTime ? `#${preview.currentAllTime}` : 'Unlisted'}
              />
              <Row label="All-time total" value={formatCents(currentTotalCents)} />
              <Row
                label="Today rank"
                value={preview.currentToday ? `#${preview.currentToday}` : 'Unlisted'}
              />
              <Row label="Today total" value={formatCents(todayTotalCents)} />
            </dl>
          </Card>
        </div>
      </aside>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-subtle text-[12px] font-semibold text-muted">
        {n}
      </span>
      <h2 className="text-[15px] font-semibold">{title}</h2>
    </div>
  );
}

function Shortcut({
  label,
  cents,
  onPick,
}: {
  label: string;
  cents: number;
  onPick: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(centsToDollarsString(cents))}
      className="rounded-md border border-line px-3 py-2 text-left transition-colors hover:border-primary"
    >
      <span className="block text-[12px] text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{formatCents(cents)}</span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
