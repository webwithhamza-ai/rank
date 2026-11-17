'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { CopyButton } from '@/components/CopyButton';
import { cn } from '@/lib/cn';
import { formatCents, parseDollarsToCents, centsToDollarsString } from '@/lib/money';
import { SITE_NAME } from '@/lib/site';

type Status = 'waiting' | 'detected' | 'confirmed' | 'expired';

interface StatusResponse {
  status: Status;
  creditedCents: number;
  rank: number | null;
  todayRank: number | null;
  payments: Array<{ txHash: string; amountCents: number; status: string; explorerUrl: string }>;
}

interface CheckoutViewProps {
  checkoutId: string;
  depositAddress: string;
  chainName: string;
  tokenSymbol: string;
  expectedCents: number;
  expiresAt: string;
  uri: string;
  qrSvg: string;
  isMockMode: boolean;
}

const statusCopy: Record<Status, string> = {
  waiting: 'Waiting for payment',
  detected: 'Payment seen — waiting for confirmations',
  confirmed: 'Confirmed',
  expired: 'Window closed',
};

export function CheckoutView(props: CheckoutViewProps) {
  const [state, setState] = useState<StatusResponse>({
    status: 'waiting',
    creditedCents: 0,
    rank: null,
    todayRank: null,
    payments: [],
  });
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/checkout/${props.checkoutId}/status`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (!cancelled) setState(data);
      } catch {
        // Keep the last known state; the next tick will catch up.
      }
    };
    poll();
    const timer = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [props.checkoutId]);

  useEffect(() => {
    const target = new Date(props.expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [props.expiresAt]);

  if (state.status === 'confirmed') return <SuccessView {...props} state={state} />;

  const minutes = remaining === null ? null : Math.floor(remaining / 60000);
  const seconds = remaining === null ? null : Math.floor((remaining % 60000) / 1000);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Scan and pay</h1>
        <p className="mt-2 text-sm text-muted">
          Send{' '}
          <span className="font-semibold text-fg">
            {props.tokenSymbol} on {props.chainName}
          </span>{' '}
          only. Anything else has to be refunded by hand.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
        <Card className="p-5">
          <div
            className="mx-auto w-full max-w-[280px] rounded-md bg-white p-3 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: props.qrSvg }}
            aria-label={`QR code to pay ${formatCents(props.expectedCents)} in ${props.tokenSymbol}`}
            role="img"
          />

          <a
            href={props.uri}
            className="mt-4 block rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-primary-fg sm:hidden"
          >
            Open in wallet app
          </a>

          <div className="mt-5 space-y-3">
            <div>
              <Label>Amount</Label>
              <div className="flex gap-2">
                <p className="flex-1 rounded-md border border-line px-3.5 py-2.5 text-lg font-bold tabular-nums">
                  {formatCents(props.expectedCents)}
                </p>
                <CopyButton value={centsToDollarsString(props.expectedCents)} />
              </div>
            </div>

            <div>
              <Label>Deposit address</Label>
              <div className="flex gap-2">
                <p className="min-w-0 flex-1 overflow-x-auto rounded-md border border-line px-3.5 py-2.5 font-mono text-[13px]">
                  {props.depositAddress}
                </p>
                <CopyButton value={props.depositAddress} />
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  state.status === 'detected' ? 'animate-pulse-dot bg-primary' : 'bg-muted',
                )}
                aria-hidden="true"
              />
              <p className="text-[13px] font-semibold">{statusCopy[state.status]}</p>
            </div>
            <ol className="mt-3 space-y-1.5 text-[13px] text-muted">
              <Step done label="Checkout created" />
              <Step done={state.status !== 'waiting'} label="Payment detected" />
              <Step done={false} label="Confirmed on chain" />
            </ol>
          </Card>

          <Card className="p-4">
            <p className="text-[13px] text-muted">Window closes in</p>
            <p className="font-mono text-2xl font-medium tabular-nums">
              {minutes === null
                ? '--:--'
                : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Late payments still count — we watch this address for 7 days.
            </p>
          </Card>

          <Card accent="subtle" shadow="none" className="p-4">
            <ul className="space-y-1.5 text-xs leading-relaxed text-muted">
              <li>We credit what actually arrives, not what was quoted.</li>
              <li>Send more than quoted and the larger amount counts.</li>
              <li>Payments under $1 are recorded but not credited.</li>
              <li>This address is yours alone — do not reuse it later.</li>
            </ul>
          </Card>

          {props.isMockMode ? (
            <SimulatePanel checkoutId={props.checkoutId} expectedCents={props.expectedCents} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          'grid h-4 w-4 place-items-center rounded-full text-[9px]',
          done ? 'bg-success text-white' : 'border border-line',
        )}
        aria-hidden="true"
      >
        {done ? '✓' : ''}
      </span>
      <span className={done ? 'text-fg' : undefined}>{label}</span>
    </li>
  );
}

function SuccessView({ state, ...props }: CheckoutViewProps & { state: StatusResponse }) {
  const shareText = encodeURIComponent(
    `I just paid ${formatCents(state.creditedCents)} to sit at #${state.rank} on ${SITE_NAME}. Come outbid me.`,
  );

  return (
    <div className="mx-auto max-w-lg">
      <Card accent="primary" shadow="raised" className="animate-rise p-8 text-center">
        <p className="text-[13px] font-medium text-success">Confirmed on chain</p>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight">You are #{state.rank}</h1>
        <p className="mt-2 text-sm text-muted">
          {formatCents(state.creditedCents)} credited
          {state.todayRank ? ` · #${state.todayRank} today` : ''}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink
            href={`https://x.com/intent/tweet?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on X
          </ButtonLink>
          <ButtonLink href="/" variant="secondary">
            See the board
          </ButtonLink>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <p className="text-[13px] font-semibold">Transactions</p>
        <ul className="mt-2 space-y-1.5">
          {state.payments.map((payment) => (
            <li key={payment.txHash} className="flex items-center justify-between gap-3 text-[13px]">
              <a
                href={payment.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-muted underline underline-offset-2 hover:text-fg"
              >
                {payment.txHash.slice(0, 20)}…
              </a>
              <span className="font-semibold tabular-nums">{formatCents(payment.amountCents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Paid on {props.chainName} in {props.tokenSymbol}. Anyone can verify these on the explorer.
        </p>
      </Card>
    </div>
  );
}

function SimulatePanel({ checkoutId, expectedCents }: { checkoutId: string; expectedCents: number }) {
  const [amount, setAmount] = useState(centsToDollarsString(expectedCents));
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const call = async (action: 'detect' | 'confirm') => {
    const cents = parseDollarsToCents(amount);
    if (cents === null) return;
    setBusy(true);
    const res = await fetch(`/api/checkout/${checkoutId}/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountCents: cents, action, txHash: txHash ?? undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      txHash?: string;
      status?: string;
      error?: string;
    };
    if (data.txHash) setTxHash(data.txHash);
    setLog((previous) => [
      `${action} → ${data.error ?? data.status ?? res.status}`,
      ...previous.slice(0, 3),
    ]);
    setBusy(false);
  };

  return (
    <Card accent="subtle" shadow="none" className="border-dashed p-4">
      <p className="text-[13px] font-semibold">Dev only — simulate a payment</p>
      <p className="mt-1 text-xs text-muted">
        Runs through the same crediting code a real transfer does.
      </p>
      <div className="mt-3">
        <Label htmlFor="sim-amount">Amount received (USD)</Label>
        <Input
          id="sim-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => call('detect')}>
          1. Detect
        </Button>
        <Button size="sm" variant="success" disabled={busy} onClick={() => call('confirm')}>
          2. Confirm
        </Button>
      </div>
      {log.length > 0 ? (
        <ul className="mt-3 space-y-0.5 font-mono text-[11px] text-muted">
          {log.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
