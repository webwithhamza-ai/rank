import { PUBLIC_APP_MODE } from '@/lib/site';

const copy: Record<string, string> = {
  mock: 'Mock mode — fake logins, simulated payments, seeded data. Nothing here is real.',
  testnet: 'Testnet mode — real on-chain verification on test networks. Tokens have no value.',
};

export function ModeBanner() {
  const text = copy[PUBLIC_APP_MODE];
  if (!text) return null;
  return (
    <div className="bg-[var(--primary-soft)] text-primary">
      <p className="mx-auto max-w-6xl px-4 py-1.5 text-center text-xs font-medium sm:px-6">{text}</p>
    </div>
  );
}
