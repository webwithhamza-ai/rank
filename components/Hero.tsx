import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { formatCents } from '@/lib/money';
import { MIN_PAYMENT_CENTS, costToOvertakeCents } from '@/lib/ranking';

interface HeroProps {
  leaderCents: number | null;
  title: string;
  subtitle: string;
  aside?: React.ReactNode;
}

/**
 * The headline is the offer: what #1 costs right now. It is derived from the
 * live board, so it always quotes a price someone can actually pay.
 */
export function Hero({ leaderCents, title, subtitle, aside }: HeroProps) {
  const priceForFirst =
    leaderCents === null ? MIN_PAYMENT_CENTS : costToOvertakeCents(leaderCents, 0);

  return (
    <section className="py-8 text-center sm:py-12">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[40px]">
        {title}{' '}
        <span className="whitespace-nowrap text-primary">{formatCents(priceForFirst)}</span>
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{subtitle}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/claim" size="lg">
          Claim rank
        </ButtonLink>
        <Link
          href="/about"
          className="text-sm text-muted underline underline-offset-4 hover:text-fg"
        >
          How it works
        </Link>
      </div>

      {aside ? <div className="mt-6 flex justify-center">{aside}</div> : null}
    </section>
  );
}
