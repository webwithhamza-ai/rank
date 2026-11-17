import './load-env';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { CATEGORIES, type Category } from '../lib/ranking';

const HANDLE_PARTS_A = [
  'degen', 'gm', 'onchain', 'based', 'wagmi', 'mint', 'rug', 'alpha', 'ser', 'anon',
  'pixel', 'jpeg', 'liquid', 'moon', 'sol', 'eth', 'frog', 'cope', 'bag', 'whale',
];
const HANDLE_PARTS_B = [
  'hunter', 'maxi', 'lord', 'pilled', 'farmer', 'chad', 'wizard', 'cat', 'ape', 'guy',
  'oracle', 'dev', 'pepe', 'bot', 'king', 'queen', 'fren', 'goblin', 'shark', 'ghost',
];
const TAGLINES = [
  'Calling the top since 2021. Still here.',
  'Shipping every single day, no exceptions.',
  '10,000 hand-drawn nobodies on the blockchain.',
  'The only ticker that matters.',
  'Research-first. Threads twice a week.',
  'Building infrastructure nobody asked for.',
  'Early to everything, right about some of it.',
  'We do not do refunds, we do conviction.',
  'On-chain analytics without the nonsense.',
  'Mint is live. Floor is a state of mind.',
  null,
];
const COLORS = ['#FFE500', '#FF4FA3', '#2B59FF', '#00C46A', '#F5F1E8'];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Skewed low so the board looks like a real one: a few whales, a long tail. */
function randomPaymentCents(): number {
  const roll = Math.random();
  if (roll > 0.96) return randomInt(50, 400) * 100;
  if (roll > 0.82) return randomInt(15, 60) * 100;
  if (roll > 0.45) return randomInt(3, 20) * 100;
  return randomInt(1, 5) * 100;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });

  console.log('Clearing seeded data…');
  await sql`truncate table clicks, reports, payments, checkouts, visits restart identity cascade`;
  await sql`delete from accounts where is_mock = true`;

  const used = new Set<string>();
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  console.log('Creating 60 accounts…');
  for (let i = 0; i < 60; i += 1) {
    let handle = `${pick(HANDLE_PARTS_A)}${pick(HANDLE_PARTS_B)}`;
    while (used.has(handle)) handle = `${pick(HANDLE_PARTS_A)}${pick(HANDLE_PARTS_B)}${randomInt(1, 99)}`;
    used.add(handle);

    const category = pick(CATEGORIES) as Category;
    const createdAt = new Date(now - randomInt(1, 14) * DAY);

    const [account] = await db
      .insert(schema.accounts)
      .values({
        xUserId: `mock:${handle}`,
        handle,
        displayName: handle.replace(/^\w/, (c) => c.toUpperCase()),
        avatarColor: pick(COLORS),
        followerCount: randomInt(200, 250_000),
        category,
        tagline: pick(TAGLINES),
        link: Math.random() > 0.6 ? `https://${handle}.xyz` : null,
        totalCents: 0,
        scoreReachedAt: createdAt,
        isMock: true,
        createdAt,
      })
      .returning();

    // Spread payments across the last 14 days, with a decent share landing
    // today so the Today board is populated too.
    const paymentCount = randomInt(1, 6);
    let total = 0;
    let lastAt = createdAt;

    for (let p = 0; p < paymentCount; p += 1) {
      const cents = randomPaymentCents();
      const landsToday = Math.random() > 0.55;
      const confirmedAt = landsToday
        ? new Date(now - randomInt(0, Math.max(1, Math.floor((now - startOfUtcDay(now)) / 60000))) * 60_000)
        : new Date(now - randomInt(1, 13) * DAY - randomInt(0, 23) * 60 * 60 * 1000);

      await db.insert(schema.payments).values({
        accountId: account.id,
        chainId: 8453,
        tokenAddress: `0x${randomBytes(20).toString('hex')}`,
        tokenSymbol: Math.random() > 0.5 ? 'USDC' : 'USDG',
        txHash: `0x${randomBytes(32).toString('hex')}`,
        logIndex: 0,
        fromAddress: `0x${randomBytes(20).toString('hex')}`,
        toAddress: `0x${randomBytes(20).toString('hex')}`,
        amountBaseUnits: String(BigInt(cents) * 10_000n),
        amountCents: cents,
        status: 'confirmed',
        blockNumber: randomInt(1_000_000, 20_000_000),
        confirmedAt,
        isMock: true,
        createdAt: confirmedAt,
      });

      total += cents;
      if (confirmedAt > lastAt) lastAt = confirmedAt;
    }

    await db
      .update(schema.accounts)
      .set({ totalCents: total, scoreReachedAt: lastAt })
      .where(eq(schema.accounts.id, account.id));

    // A plausible click history so the board is not all zeroes.
    const clickCount = randomInt(0, 40);
    for (let c = 0; c < clickCount; c += 1) {
      await db.insert(schema.clicks).values({
        accountId: account.id,
        ipHash: randomBytes(16).toString('hex'),
        createdAt: new Date(now - randomInt(0, 14) * DAY),
      });
    }
  }

  for (let v = 0; v < 400; v += 1) {
    await db
      .insert(schema.visits)
      .values({
        ipHash: randomBytes(16).toString('hex'),
        day: new Date(now - randomInt(0, 14) * DAY).toISOString().slice(0, 10),
      })
      .onConflictDoNothing();
  }

  await sql.end();
  console.log('Seeded 60 accounts with payments, clicks and visits.');
  console.log('Sign in at /login with any handle to try the checkout flow.');
}

function startOfUtcDay(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
