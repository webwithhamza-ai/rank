'use client';

import { useState, useTransition } from 'react';
import { refundPayment } from '@/app/admin/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function RefundForm({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Refund
      </Button>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await refundPayment(formData);
          setMessage(result.error ?? 'Marked as refunded.');
        })
      }
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="paymentId" value={paymentId} />
      <Input
        name="refundTxHash"
        placeholder="Refund tx hash"
        className="h-9 w-56 py-0 text-xs"
        aria-label="Refund transaction hash"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Mark refunded'}
      </Button>
      {message ? <span className="text-xs text-muted">{message}</span> : null}
    </form>
  );
}
