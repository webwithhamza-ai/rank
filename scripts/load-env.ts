import { config } from 'dotenv';

/**
 * Next.js reads .env.local automatically; standalone scripts do not. Loading
 * both here keeps `pnpm seed` and `pnpm watcher` working off the same file the
 * dev server uses. Earlier paths win.
 */
config({ path: ['.env.local', '.env'] });
