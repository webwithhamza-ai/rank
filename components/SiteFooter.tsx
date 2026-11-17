import Link from 'next/link';
import { DISCLAIMER, SITE_NAME } from '@/lib/site';

const LINKS = [
  { href: '/', label: 'All-time' },
  { href: '/today', label: 'Today' },
  { href: '/claim', label: 'Claim' },
  { href: '/about', label: 'About' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-sm font-semibold">{SITE_NAME}</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Footer">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-muted hover:text-fg">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
