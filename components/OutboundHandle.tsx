'use client';

export function OutboundHandle({
  accountId,
  handle,
  className,
}: {
  accountId: string;
  handle: string;
  className?: string;
}) {
  const track = () => {
    // Fire-and-forget: a failed count must never block the outbound click.
    void fetch('/api/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId }),
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <a
      href={`https://x.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={track}
      className={className ?? 'hover:text-fg'}
    >
      @{handle}
    </a>
  );
}
