CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"x_user_id" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"avatar_color" text,
	"follower_count" integer,
	"category" text DEFAULT 'Other' NOT NULL,
	"tagline" text,
	"link" text,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"score_reached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"is_mock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"deposit_address" text NOT NULL,
	"derivation_index" integer NOT NULL,
	"chain_id" integer NOT NULL,
	"token_symbol" text NOT NULL,
	"token_address" text NOT NULL,
	"expected_cents" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"checkout_id" uuid,
	"chain_id" integer NOT NULL,
	"token_address" text NOT NULL,
	"token_symbol" text,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"from_address" text,
	"to_address" text,
	"amount_base_units" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'detected' NOT NULL,
	"block_number" bigint,
	"confirmed_at" timestamp with time zone,
	"refund_tx_hash" text,
	"note" text,
	"is_mock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"reporter_ip_hash" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watcher_state" (
	"chain_id" integer PRIMARY KEY NOT NULL,
	"last_processed_block" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_checkout_id_checkouts_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_x_user_id_unique" ON "accounts" USING btree ("x_user_id");--> statement-breakpoint
CREATE INDEX "accounts_handle_idx" ON "accounts" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "accounts_board_idx" ON "accounts" USING btree ("total_cents","score_reached_at");--> statement-breakpoint
CREATE UNIQUE INDEX "checkouts_derivation_index_unique" ON "checkouts" USING btree ("derivation_index");--> statement-breakpoint
CREATE INDEX "checkouts_deposit_address_idx" ON "checkouts" USING btree ("deposit_address");--> statement-breakpoint
CREATE INDEX "checkouts_account_idx" ON "checkouts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "clicks_account_idx" ON "clicks" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "clicks_dedupe_idx" ON "clicks" USING btree ("account_id","ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_chain_tx_log_unique" ON "payments" USING btree ("chain_id","tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "payments_account_idx" ON "payments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "payments_confirmed_idx" ON "payments" USING btree ("status","confirmed_at");--> statement-breakpoint
CREATE INDEX "reports_account_idx" ON "reports" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "visits_ip_day_unique" ON "visits" USING btree ("ip_hash","day");