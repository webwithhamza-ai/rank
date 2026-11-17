# Security

This app moves real money. The design below exists so that the worst case — a
fully compromised server — still cannot drain a single deposit.

## The server never holds a private key

Deposit addresses come from a hierarchical deterministic (BIP-32) wallet.

- The server environment holds **`DEPOSIT_XPUB`**, an extended *public* key at
  the account path `m/44'/60'/0'`.
- From that key, and only that key, the server derives one address per checkout
  at `m/44'/60'/0'/0/{index}`.
- An xpub can derive addresses. It cannot sign transactions. Anyone who steals
  it learns which addresses belong to the site and nothing else.
- The **mnemonic never touches the server** — not the env vars, not the
  database, not the logs, not the repository.

Base and Robinhood Chain are both EVM chains, so one derived address receives on
either. That is why the watcher checks every supported chain for every address.

## Where the mnemonic lives

Generate the wallet on your own machine:

```bash
pnpm wallet:generate
```

It prints the mnemonic once and the xpub to paste into `DEPOSIT_XPUB`.

- Use a **fresh wallet created for this project only**. Never reuse a personal
  or team wallet.
- Write the mnemonic down offline: paper in a safe, a hardware wallet, or an
  offline password manager.
- Do not store it in `.env`, `.env.local`, a password-shared note, a screenshot,
  a chat message, or a cloud drive.
- `.gitignore` already blocks `seed.txt`, `mnemonic.txt`, `*.mnemonic` and
  `wallet-backup*`, but the real protection is not creating those files.

## Sweeping funds

`scripts/sweep.ts` runs **only on your machine**. It:

1. Reads the mnemonic from a local file (`--mnemonic-file`) or the prompt.
2. Reads the used derivation indices from the database.
3. Checks every deposit address on every configured chain and token.
4. Sends a small gas top-up from a gas wallet at `m/44'/60'/0'/1/0` — deposit
   addresses hold no native currency of their own.
5. Transfers the full token balance to `TREASURY_ADDRESS`.

Always dry-run first:

```bash
pnpm sweep -- --dry-run
```

Fund the gas wallet with a little ETH on each chain before a live sweep. The
treasury address should be a wallet you control directly — ideally a hardware
wallet or a multisig, not the same seed.

## If the server is compromised

What an attacker gains: the database, the xpub, session secrets, and the ability
to serve whatever they want on the site.

What they cannot do: spend deposits. There is no key to steal.

Response, in order:

1. **Rotate `AUTH_SECRET`.** This invalidates every session, including any the
   attacker minted.
2. **Sweep all deposit addresses** to the treasury from your own machine, before
   anything else about the infrastructure changes.
3. **Rotate the deposit wallet.** Generate a fresh mnemonic, set the new
   `DEPOSIT_XPUB`, and reset `checkouts.derivation_index` allocation by letting
   new checkouts start from the next index. Old addresses stay watched so
   in-flight payments still land, but no new ones are handed out from the old
   wallet.
4. **Rotate `IP_HASH_SALT`** if visitor privacy matters to you. Old hashes become
   uncorrelatable with new ones.
5. **Audit `payments`** for rows created outside the watcher. Every legitimate
   credited payment has an on-chain transaction hash that anyone can verify on a
   block explorer. Anything that does not resolve on chain is fabricated.
6. Rotate the database credentials and any RPC API keys.

The public verifiability of payments is the backstop: the on-chain record is the
source of truth, and the database can be reconciled against it.

## Other properties worth knowing

- **Payments cannot be double credited.** A unique index on
  `(chain_id, tx_hash, log_index)` plus compare-and-set status transitions mean a
  log credits exactly once, even if two watchers run at the same time.
- **Confirmations are per chain and configurable** (`BASE_CONFIRMATIONS`,
  `RHC_CONFIRMATIONS`, default 3). Nothing is credited above the safe head.
- **Token decimals are read from the contract**, never assumed, so a
  non-standard token cannot inflate a credit by orders of magnitude.
- **No wallet connection anywhere.** The site never asks a user to connect a
  wallet or sign a message, so a compromised frontend has nothing to phish. Users
  should treat any prompt to connect a wallet on this site as an attack.
- **Raw IP addresses are never stored** — only a salted SHA-256 prefix, used for
  click dedupe and rate limits.
- **Admin access** is an allowlist of X user IDs in `ADMIN_X_IDS`. There is no
  password to guess and no admin account to phish separately from X itself.
- **Mainnet refuses to boot** with mock auth, a default IP salt, or missing
  credentials — see the `APP_MODE=mainnet` guard in `lib/env.ts`.

## Reporting a vulnerability

Open a private security advisory on the repository, or contact the maintainer
directly. Please do not open a public issue for anything that affects funds.
