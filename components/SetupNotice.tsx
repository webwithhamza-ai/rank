import { Card } from '@/components/ui/Card';

/**
 * Rendered instead of a board when DATABASE_URL is missing, so a fresh deploy
 * explains itself rather than throwing a 500.
 */
export function SetupNotice({ error }: { error?: string }) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Database not connected</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Set <code className="rounded-sm bg-subtle px-1 py-0.5 font-mono text-[13px]">DATABASE_URL</code>{' '}
        and run the migrations to bring the board up.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-md bg-subtle p-3 font-mono text-xs text-muted">
        {`docker compose up -d\npnpm db:migrate\npnpm seed`}
      </pre>
      {error ? (
        <p className="mt-3 rounded-md bg-subtle p-3 font-mono text-xs text-muted">{error}</p>
      ) : null}
    </Card>
  );
}
