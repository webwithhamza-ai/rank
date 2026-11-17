import Link from 'next/link';
import { auth } from '@/lib/auth';
import { SITE_NAME } from '@/lib/site';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ButtonLink } from '@/components/ui/Button';
import { LiveStatsLine } from '@/components/LiveStatsLine';
import { isDbConfigured } from '@/lib/env';

async function safeSession() {
  if (!isDbConfigured()) return null;
  try {
    return await auth();
  } catch {
    return null;
  }
}

export async function SiteHeader() {
  const session = await safeSession();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-sm bg-primary text-[13px] text-primary-fg">
            #
          </span>
          {SITE_NAME}
        </Link>

        <LiveStatsLine />

        <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="Main">
          <Link href="/today" className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-subtle hover:text-fg">
            Today
          </Link>
          <Link href="/about" className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-subtle hover:text-fg">
            About
          </Link>
          {session?.user?.isAdmin ? (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-subtle hover:text-fg"
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <ThemeToggle />
          {session?.user?.handle ? (
            <Link
              href={`/u/${session.user.handle}`}
              className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-subtle hover:text-fg sm:block"
            >
              @{session.user.handle}
            </Link>
          ) : null}
          <ButtonLink href="/claim" size="sm">
            Claim rank
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
