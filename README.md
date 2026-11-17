# [YOUR_SITE_NAME]

A public leaderboard for X accounts where rank is bought, not earned.

Users sign in with X, pick an amount, and pay in stablecoins by scanning a QR
code from any wallet app. Rank is the sum of everything an account has paid.
There is no algorithm, no editorial, and **no wallet connection anywhere on the
site**.

- **All-time board** at `/` — cumulative totals, forever.
- **Today board** at `/today` — payments confirmed since 00:00 UTC, resets daily.
- Minimum credited payment: **$1**. Ties go to whoever got there first.
- Payments are verified on chain before a rank moves, and every payment links to
  a block explorer.

---

## Table of contents

- [Quick start (MOCK mode)](#quick-start-mock-mode)
- [The three modes](#the-three-modes)
- [MOCK mode](#mock-mode)
- [TESTNET mode](#testnet-mode)
- [MAINNET mode](#mainnet-mode)
- [How payments work](#how-payments-work)
- [Project layout](#project-layout)
- [Commands](#commands)
- [Deployment](#deployment)
- [Security](#security)

---

## Quick start (MOCK mode)

Needs Node 20+, pnpm, and Docker (or any Postgres you can point at).

```bash
pnpm install
cp .env.example .env.local
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm seed
pnpm dev
```

Open http://localhost:3000. The default `.env.example` is already set to MOCK
mode, so nothing external is required — no X app, no RPC key, no real money.

To try the full flow:

1. Go to `/login` and type any handle, e.g. `testuser1`.
2. Go to `/claim`, pick an amount, watch the rank calculator update as you type.
3. Create the checkout. You get a real QR code and a real derived deposit
   address.
4. Use the pink **Simulate a payment** panel on that page to run a payment
   through the exact same crediting code a real transfer uses.

To see the admin panel, sign in with the handle `admin` (the default
`ADMIN_X_IDS=mock:admin` allowlists it) and open `/admin`.

---

## The three modes

`APP_MODE` decides how much of the stack is real. A banner shows the mode
whenever it is not `mainnet`.

| | `mock` | `testnet` | `mainnet` |
|---|---|---|---|
| X login | fake, type any handle | fake or real | real OAuth 2.0 |
| Payments | simulated in the browser | real, on test networks | real, on Base + Robinhood Chain |
| Chain access | none needed | testnet RPC | production RPC (use a paid one) |
| External setup | none | faucet + deploy mock tokens | X app, RPC, deposit wallet |

`AUTH_MODE` is separate so you can keep mock logins while testing real payments:
`mock` gives the dev login page, `x` uses real X OAuth. Mainnet refuses to start
unless `AUTH_MODE=x`.

---

## MOCK mode

The default. Everything runs locally with no external services.

```env
APP_MODE=mock
NEXT_PUBLIC_APP_MODE=mock
AUTH_MODE=mock
DATABASE_URL=postgres://postgres:postgres@localhost:5432/paytorank
```

**Mock X login** — `/login` takes a handle, a display name and an avatar colour,
and creates a session identical in shape to a real one. Mock accounts carry a
`DEV` badge everywhere they appear.

**Mock payments** — checkout shows the real QR code and a real derived deposit
address (from a publicly known test mnemonic), plus a panel that fires
`detected` and then `confirmed` with a fabricated transaction hash. Those calls
land in `lib/credit.ts`, the same function the on-chain watcher calls. If
crediting is wrong in mock mode, it is wrong in production too.

**Seed data** — `pnpm seed` creates 60 accounts across every category with
payment histories spread over the last 14 days, weighted so a good share lands
today. Both boards look like real boards immediately.

```bash
pnpm seed    # safe to re-run; it clears mock data first
```

---

## TESTNET mode

Real on-chain verification against **Base Sepolia** (84532) and **Robinhood
Chain testnet** (46630).

### 1. Get gas

| Network | Faucet |
|---|---|
| Base Sepolia | https://docs.base.org/chain/network-faucets |
| Robinhood Chain testnet | https://faucet.testnet.chain.robinhood.com |

You need a funded key in `DEPLOYER_PRIVATE_KEY` for the next step. Use a throwaway
key — it is only ever used on testnets.

### 2. Deploy test stablecoins

Real test USDC/USDG may not exist on these networks, so deploy your own:

```bash
DEPLOYER_PRIVATE_KEY=0x… pnpm deploy:mocks
```

This compiles `contracts/MockStablecoin.sol` (a 6-decimal ERC-20 with a public
`mint`), deploys "Test USDC" and "Test USDG" to both testnets, and writes the
four addresses into `.env.local`.

### 3. Point the app at the testnets

```env
APP_MODE=testnet
NEXT_PUBLIC_APP_MODE=testnet
AUTH_MODE=mock           # keep fake logins while testing payments

BASE_CHAIN_ID=84532
BASE_RPC_URL=https://sepolia.base.org
BASE_EXPLORER_URL=https://sepolia.basescan.org

RHC_CHAIN_ID=46630
RHC_RPC_URL=https://rpc.testnet.chain.robinhood.com
RHC_EXPLORER_URL=https://explorer.testnet.chain.robinhood.com
```

### 4. Run the watcher

```bash
pnpm watcher
```

It polls `getLogs` for ERC-20 `Transfer` events landing on any active deposit
address, waits for the configured confirmations, then credits.

### 5. Send a test payment

Create a checkout in the UI, copy the deposit address, then:

```bash
DEPLOYER_PRIVATE_KEY=0x… pnpm send:test -- \
  --to 0xYOUR_DEPOSIT_ADDRESS --amount 25 --chain 84532 --token USDC
```

The script mints and transfers, prints the explorer link, and the checkout page
moves `waiting → detected → confirmed` on its own.

Worth testing while you are here:

- **Wrong rail** — pay USDG when the checkout asked for USDC. It still credits;
  both are supported.
- **Wrong amount** — send $15 for an $11 checkout. It credits $15.
- **Late payment** — let the 30-minute window expire, then pay. It still credits;
  deposit addresses stay watched for `DEPOSIT_WATCH_DAYS` (default 7).
- **Under minimum** — send $0.50. It is recorded, not credited, and appears in
  `/admin` under "needs attention".
- **Replay** — restart the watcher. Nothing is credited twice; the unique index
  on `(chain_id, tx_hash, log_index)` sees to that.

---

## MAINNET mode

```env
APP_MODE=mainnet
NEXT_PUBLIC_APP_MODE=mainnet
AUTH_MODE=x
```

The app validates its environment with zod at boot and **refuses to start** if
`AUTH_MODE` is `mock`, the IP salt is still the default, or any of
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`,
`DEPOSIT_XPUB`, `ADMIN_X_IDS` or a token address is missing.

### 1. X OAuth app

Create an app at https://developer.x.com with OAuth 2.0 enabled.

- Callback URL: `https://your-domain/api/auth/callback/twitter`
- Scopes: `users.read`, `tweet.read`, `offline.access`
- Put the client id and secret in `AUTH_TWITTER_ID` / `AUTH_TWITTER_SECRET`.

### 2. Deposit wallet

```bash
pnpm wallet:generate
```

Run this **on your own machine**. It prints a fresh mnemonic once and the xpub
to paste into `DEPOSIT_XPUB`. Store the mnemonic offline. The server only ever
gets the xpub and therefore can never spend. Read [SECURITY.md](./SECURITY.md)
before going live.

### 3. Verify every contract address

`config/chains.ts` reads everything from env vars — nothing on-chain is
hardcoded. Fill these in yourself after checking the official sources:

| Variable | Verify against |
|---|---|
| `BASE_USDC_ADDRESS` | [Circle's USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) |
| `BASE_USDG_ADDRESS` | Paxos / Global Dollar docs. **Leave blank if USDG is not on Base** and the option disappears from the UI. |
| `RHC_USDG_ADDRESS` | [docs.robinhood.com/chain](https://docs.robinhood.com/chain) |
| `RHC_USDC_ADDRESS` | Same. **Leave blank if USDC is not on the chain.** |

Known network parameters (verify these too):

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Base mainnet | 8453 | `https://mainnet.base.org` | `https://basescan.org` |
| Base Sepolia | 84532 | `https://sepolia.base.org` | `https://sepolia.basescan.org` |
| Robinhood Chain | 4663 | `https://rpc.mainnet.chain.robinhood.com` | `https://robinhoodchain.blockscout.com` |
| Robinhood testnet | 46630 | `https://rpc.testnet.chain.robinhood.com` | `https://explorer.testnet.chain.robinhood.com` |

Public RPCs are rate limited. Use a paid endpoint in production or the watcher
will fall behind.

### 4. Sweep

```bash
pnpm sweep -- --dry-run     # always look first
pnpm sweep -- --mnemonic-file ./secret/seed.txt
```

Local only. Tops up gas on each deposit address that holds tokens, then moves
the balance to `TREASURY_ADDRESS`.

---

## How payments work

No wallet connection. Ever. The site never asks a user to connect a wallet, so
there is nothing for a compromised frontend to phish.

1. **One deposit address per checkout.** Derived from `DEPOSIT_XPUB` at
   `m/44'/60'/0'/0/{index}`, with the index stored in the database. Base and
   Robinhood Chain are both EVM chains, so one address receives on either.
2. **The QR code is an [EIP-681](https://eips.ethereum.org/EIPS/eip-681) URI**:
   `ethereum:<token>@<chainId>/transfer?address=<deposit>&uint256=<baseUnits>`.
   Wallet apps open pre-filled with the right chain, token, recipient and amount.
   The address and amount are also shown with copy buttons, and on mobile the URI
   is a tappable deep link.
3. **The watcher** (`workers/payment-watcher.ts` → `lib/watcher.ts`) polls
   `getLogs` per chain in batches, tracking the last processed block in
   `watcher_state`. Logs at or below the safe head (`head − confirmations`) are
   credited; logs above it are recorded as `detected` so the UI can show progress.
4. **Crediting is idempotent.** Unique index on `(chain_id, tx_hash, log_index)`,
   plus compare-and-set status transitions, so a log credits exactly once.
5. **We credit what arrives**, not what was quoted. Overpay and the larger amount
   counts. Pay a different supported token or chain than you selected and it
   still counts. Unsupported tokens are flagged for a manual refund in `/admin`.
6. **Token decimals are read from the contract** and cached. Never hardcoded.
7. Money is stored as **integer cents**. No floats touch a total.

### Ranking

All of it lives in `lib/ranking.ts` — a pure module with no database or network
imports, fully covered by `tests/ranking.test.ts`.

- Score = sum of confirmed payments.
- Sorted by score descending; ties broken by `score_reached_at` ascending, so
  whoever reached the score first stays ahead.
- To take a rank you must **pass** its occupant, and quotes round up to whole
  dollars: a $100 leader costs $101 from scratch, or $11 if you are on $90.
- Filters recompute ranks inside the filtered set.

---

## Project layout

```
app/                  Next.js App Router pages and route handlers
  page.tsx            All-time board
  today/              Today board
  claim/              Login gate, category, amount, rank calculator
  checkout/[id]/      QR checkout with live status
  u/[handle]/         Profile, payment history, listing editor
  about/              How it works, rules, live stats, disclaimer
  admin/              Allowlisted admin panel
  api/                Board, ticker, checkout, click, report, cron
components/           Design system + feature components
  ui/                 Card, Button, Input, Tag
config/chains.ts      Every chain id, RPC and token address (from env)
db/                   Drizzle schema and lazy client
lib/
  ranking.ts          Pure ranking logic (unit tested)
  credit.ts           The single crediting path for all payments
  watcher.ts          Chain scanning cycle
  checkout.ts         Deposit address allocation, EIP-681 presentation
  wallet.ts           xpub derivation
  env.ts              zod validation + mode guards
workers/              Long-running payment watcher
scripts/              seed, migrate, wallet:generate, sweep, deploy:mocks, send:test
contracts/            MockStablecoin.sol for testnets
tests/                Vitest unit tests
e2e/                  Playwright test of the mock checkout flow
```

---

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm test` | Unit tests (ranking, money, wallet, EIP-681) |
| `pnpm e2e` | Playwright end-to-end checkout test |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm db:generate` | Generate a migration from the schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm seed` | 60 fake accounts with payment history |
| `pnpm watcher` | Run the payment watcher |
| `pnpm wallet:generate` | **Local only.** New mnemonic + xpub |
| `pnpm sweep` | **Local only.** Move deposits to the treasury |
| `pnpm deploy:mocks` | Deploy test stablecoins to both testnets |
| `pnpm send:test` | Mint and send a test payment |

---

## Deployment

### Web app — Vercel

Push the repository and import it. Set every variable from `.env.example` in the
Vercel project settings. Use a hosted Postgres — Neon or Supabase both work; add
`?sslmode=require` to the connection string.

Run migrations once against the production database:

```bash
DATABASE_URL="postgres://…" pnpm db:migrate
```

Set `NEXT_PUBLIC_BASE_URL` to the deployed origin, and register
`https://your-domain/api/auth/callback/twitter` as the X callback URL.

### Watcher — a separate long-running process

Vercel's serverless functions cannot hold a polling loop open. Two options:

**A. A worker on Railway / Render / Fly** (preferred). Same repository, same env
vars, start command:

```bash
pnpm watcher
```

**B. Cron-triggered route.** `POST /api/cron/watch` runs exactly one watcher
cycle. Protect it with `CRON_SECRET` (sent as `Authorization: Bearer <secret>`)
and schedule it every minute. Overlapping runs are safe — crediting is
idempotent. Add to `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/watch", "schedule": "* * * * *" }] }
```

Cron is the weaker option: a one-minute floor on detection latency and a 60-second
execution cap. Use the worker if you can.

### Before you take real money

- [ ] Every token address verified against its official source
- [ ] `DEPOSIT_XPUB` from a fresh wallet, mnemonic stored offline
- [ ] `TREASURY_ADDRESS` set and `pnpm sweep -- --dry-run` checked
- [ ] Paid RPC endpoints configured
- [ ] `AUTH_SECRET` and `IP_HASH_SALT` are long random values, not the defaults
- [ ] `ADMIN_X_IDS` contains your real numeric X user id
- [ ] Watcher running and visibly keeping up
- [ ] [SECURITY.md](./SECURITY.md) read end to end

---

## Security

The server holds only an extended public key. It can derive deposit addresses
and can never spend from them. The mnemonic stays offline and is used only by
the local sweep script.

Read [SECURITY.md](./SECURITY.md) for the full model, including what to do if the
server is compromised.

---

## Disclaimer

Rankings are paid placements, not endorsements. Do your own research. Payments
are final unless stated otherwise.
