'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context or denied) — the value stays
      // visible on screen so it can still be selected by hand.
    }
  };

  return (
    <Button
      type="button"
      onClick={copy}
      variant={copied ? 'success' : 'secondary'}
      className="shrink-0"
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}
