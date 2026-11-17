import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    xUserId: text('x_user_id').notNull(),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    avatarColor: text('avatar_color'),
    followerCount: integer('follower_count'),
    category: text('category').notNull().default('Other'),
    tagline: text('tagline'),
    link: text('link'),
    totalCents: integer('total_cents').notNull().default(0),
    scoreReachedAt: timestamp('score_reached_at', { withTimezone: true }).notNull().defaultNow(),
    hidden: boolean('hidden').notNull().default(false),
    isMock: boolean('is_mock').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    xUserIdUnique: uniqueIndex('accounts_x_user_id_unique').on(t.xUserId),
    handleIdx: index('accounts_handle_idx').on(t.handle),
    boardIdx: index('accounts_board_idx').on(t.totalCents, t.scoreReachedAt),
  }),
);

export const checkouts = pgTable(
  'checkouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    depositAddress: text('deposit_address').notNull(),
    derivationIndex: integer('derivation_index').notNull(),
    chainId: integer('chain_id').notNull(),
    tokenSymbol: text('token_symbol').notNull(),
    tokenAddress: text('token_address').notNull(),
    expectedCents: integer('expected_cents').notNull(),
    // waiting | detected | confirmed | expired
    status: text('status').notNull().default('waiting'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    derivationIndexUnique: uniqueIndex('checkouts_derivation_index_unique').on(t.derivationIndex),
    depositAddressIdx: index('checkouts_deposit_address_idx').on(t.depositAddress),
    accountIdx: index('checkouts_account_idx').on(t.accountId),
  }),
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    checkoutId: uuid('checkout_id').references(() => checkouts.id, { onDelete: 'set null' }),
    chainId: integer('chain_id').notNull(),
    tokenAddress: text('token_address').notNull(),
    tokenSymbol: text('token_symbol'),
    txHash: text('tx_hash').notNull(),
    logIndex: integer('log_index').notNull(),
    fromAddress: text('from_address'),
    toAddress: text('to_address'),
    amountBaseUnits: text('amount_base_units').notNull(),
    amountCents: integer('amount_cents').notNull(),
    // detected | confirmed | flagged | under_minimum | refunded
    status: text('status').notNull().default('detected'),
    blockNumber: bigint('block_number', { mode: 'number' }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    refundTxHash: text('refund_tx_hash'),
    note: text('note'),
    isMock: boolean('is_mock').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // The idempotency guarantee: a log can only ever be credited once.
    onchainUnique: uniqueIndex('payments_chain_tx_log_unique').on(t.chainId, t.txHash, t.logIndex),
    accountIdx: index('payments_account_idx').on(t.accountId),
    confirmedIdx: index('payments_confirmed_idx').on(t.status, t.confirmedAt),
  }),
);

export const watcherState = pgTable('watcher_state', {
  chainId: integer('chain_id').primaryKey(),
  lastProcessedBlock: bigint('last_processed_block', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clicks = pgTable(
  'clicks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    ipHash: text('ip_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountIdx: index('clicks_account_idx').on(t.accountId),
    dedupeIdx: index('clicks_dedupe_idx').on(t.accountId, t.ipHash, t.createdAt),
  }),
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    reporterIpHash: text('reporter_ip_hash').notNull(),
    resolved: boolean('resolved').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountIdx: index('reports_account_idx').on(t.accountId),
  }),
);

export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ipHash: text('ip_hash').notNull(),
    day: text('day').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniquePerDay: uniqueIndex('visits_ip_day_unique').on(t.ipHash, t.day),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Checkout = typeof checkouts.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Report = typeof reports.$inferSelect;
