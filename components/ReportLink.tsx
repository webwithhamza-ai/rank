'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Label, Textarea } from '@/components/ui/Input';

export function ReportLink({ accountId, handle }: { accountId: string; handle: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async () => {
    setState('sending');
    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId, reason }),
    });
    setState(res.ok ? 'sent' : 'error');
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hover:text-fg">
        Report
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Report @${handle}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md animate-rise rounded-xl border border-line bg-surface p-5 text-left shadow-pop">
            <h2 className="text-base font-semibold">Report @{handle}</h2>
            {state === 'sent' ? (
              <p className="mt-3 rounded-md bg-success/10 p-3 text-sm text-success">
                Thanks. An admin will review this listing.
              </p>
            ) : (
              <>
                <div className="mt-4">
                  <Label htmlFor="report-reason">What is wrong with this listing?</Label>
                  <Textarea
                    id="report-reason"
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Impersonation, scam, stolen artwork…"
                  />
                </div>
                {state === 'error' ? (
                  <p className="mt-2 text-xs text-primary">
                    Could not send that report. Try again in a minute.
                  </p>
                ) : null}
              </>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
              {state !== 'sent' ? (
                <Button
                  size="sm"
                  disabled={reason.trim().length < 4 || state === 'sending'}
                  onClick={submit}
                >
                  {state === 'sending' ? 'Sending…' : 'Send report'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
