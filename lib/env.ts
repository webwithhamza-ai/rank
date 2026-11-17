import { z } from 'zod';

const optionalAddress = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a 0x-prefixed 20-byte address')
  .optional()
  .or(z.literal('').transform(() => undefined));

const intFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().int().nonnegative());

const baseSchema = z.object({
  APP_MODE: z.enum(['mock', 'testnet', 'mainnet']).default('mock'),
  AUTH_MODE: z.enum(['mock', 'x']).default('mock'),

  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  AUTH_TWITTER_ID: z.string().optional(),
  AUTH_TWITTER_SECRET: z.string().optional(),
  ADMIN_X_IDS: z.string().default(''),
  IP_HASH_SALT: z.string().default('dev-salt'),

  DEPOSIT_XPUB: z.string().optional(),
  TREASURY_ADDRESS: optionalAddress,

  BASE_CHAIN_ID: intFromEnv(8453),
  BASE_RPC_URL: z.string().default('https://mainnet.base.org'),
  BASE_EXPLORER_URL: z.string().default('https://basescan.org'),
  BASE_USDC_ADDRESS: optionalAddress,
  BASE_USDG_ADDRESS: optionalAddress,
  BASE_CONFIRMATIONS: intFromEnv(3),

  RHC_CHAIN_ID: intFromEnv(4663),
  RHC_RPC_URL: z.string().default('https://rpc.mainnet.chain.robinhood.com'),
  RHC_EXPLORER_URL: z.string().default('https://robinhoodchain.blockscout.com'),
  RHC_USDG_ADDRESS: optionalAddress,
  RHC_USDC_ADDRESS: optionalAddress,
  RHC_CONFIRMATIONS: intFromEnv(3),

  WATCHER_BATCH_BLOCKS: intFromEnv(2000),
  WATCHER_POLL_MS: intFromEnv(12000),
  CRON_SECRET: z.string().optional(),

  CHECKOUT_TTL_MINUTES: intFromEnv(30),
  DEPOSIT_WATCH_DAYS: intFromEnv(7),

  NEXT_PUBLIC_SITE_NAME: z.string().default('[YOUR_SITE_NAME]'),
  NEXT_PUBLIC_BASE_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof baseSchema>;

function parseEnv(): Env {
  const parsed = baseSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  const env = parsed.data;

  // Mode guards. MAINNET must never run on mock auth or half-filled config.
  if (env.APP_MODE === 'mainnet') {
    const missing: string[] = [];
    if (env.AUTH_MODE !== 'x') missing.push('AUTH_MODE must be "x" in mainnet mode');
    if (!env.DATABASE_URL) missing.push('DATABASE_URL');
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 16) missing.push('AUTH_SECRET (>= 16 chars)');
    if (!env.AUTH_TWITTER_ID) missing.push('AUTH_TWITTER_ID');
    if (!env.AUTH_TWITTER_SECRET) missing.push('AUTH_TWITTER_SECRET');
    if (!env.DEPOSIT_XPUB) missing.push('DEPOSIT_XPUB');
    if (!env.ADMIN_X_IDS) missing.push('ADMIN_X_IDS');
    if (env.IP_HASH_SALT === 'dev-salt') missing.push('IP_HASH_SALT (must not be the default)');
    if (!env.BASE_USDC_ADDRESS && !env.BASE_USDG_ADDRESS && !env.RHC_USDG_ADDRESS && !env.RHC_USDC_ADDRESS) {
      missing.push('at least one token address');
    }
    if (missing.length > 0) {
      throw new Error(
        `APP_MODE=mainnet refuses to start. Fix these first:\n${missing.map((m) => `  - ${m}`).join('\n')}`,
      );
    }
  }

  return env;
}

let cached: Env | undefined;

export function env(): Env {
  if (!cached) cached = parseEnv();
  return cached;
}

export function appMode(): Env['APP_MODE'] {
  return env().APP_MODE;
}

export function isDbConfigured(): boolean {
  return Boolean(env().DATABASE_URL);
}

export function adminXIds(): string[] {
  return env()
    .ADMIN_X_IDS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
