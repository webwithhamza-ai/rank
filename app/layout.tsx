import type { Metadata } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { SITE_NAME } from '@/lib/site';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ModeBanner } from '@/components/ModeBanner';
import { VisitBeacon } from '@/components/VisitBeacon';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — claim a rank on the leaderboard`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    'A leaderboard for X accounts where rank is bought, not earned. Pay in stablecoins, climb the board.',
};

/**
 * Light is the default look; the toggle stores an explicit choice. Applied
 * before first paint so the page never flashes the wrong background.
 */
const themeScript = `
(function(){
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <ModeBanner />
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">{children}</main>
        <SiteFooter />
        <VisitBeacon />
      </body>
    </html>
  );
}
