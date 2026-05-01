CREATE TABLE "achievements" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" text NOT NULL,
	"group_id" text,
	"badge" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"awarded_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text,
	"match_id" text,
	"parent_id" text,
	"author_player_id" text,
	"content" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_bookings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" text NOT NULL,
	"group_id" text,
	"booked_by" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"total_price" real,
	"status" text DEFAULT 'pending',
	"payment_method" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_reviews" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" text NOT NULL,
	"player_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" text NOT NULL,
	CONSTRAINT "field_reviews_rating_check" CHECK (rating >= 1 AND rating <= 5)
);
--> statement-breakpoint
CREATE TABLE "field_slots" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"price" real,
	"is_booked" integer DEFAULT 0,
	"booked_by_group_id" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text,
	"owner_id" text,
	"venue_id" text,
	"type" text,
	"name" text NOT NULL,
	"location" text,
	"contact_name" text,
	"contact_phone" text,
	"hourly_rate" real,
	"coordinates_lat" real,
	"coordinates_lng" real,
	"description" text,
	"photos" text,
	"city" text,
	"is_active" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "group_players" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"player_id" text NOT NULL,
	"role" text,
	"nickname" text,
	"position" text,
	"rating" real DEFAULT 5,
	"matches_played" integer DEFAULT 0,
	"is_monthly_subscriber" integer DEFAULT 0,
	"monthly_start_month" text,
	"is_guest" integer DEFAULT 0,
	"joined_at" text
);
--> statement-breakpoint
CREATE TABLE "group_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text NOT NULL,
	"player_id" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending',
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text NOT NULL,
	"admins" text,
	"name" text NOT NULL,
	"sport" text,
	"invite_code" text,
	"created_at" text,
	"members" text,
	"pending_requests" text,
	"payment_mode" text,
	"fixed_amount" real,
	"monthly_fee" real,
	"city" text,
	"logo" text
);
--> statement-breakpoint
CREATE TABLE "match_votes" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" text,
	"voter_id" text NOT NULL,
	"voted_for_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text,
	"date" text,
	"time" text,
	"field_id" text,
	"confirmed_player_ids" text,
	"paid_player_ids" text,
	"team_a" text,
	"team_b" text,
	"score_a" integer,
	"score_b" integer,
	"finished" integer,
	"mvp_id" text,
	"arrived_player_ids" text,
	"sub_matches" text,
	"mvp_votes" text,
	"is_canceled" integer DEFAULT 0,
	"player_points" text
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"birth_date" text,
	"avatar" text,
	"favorite_team" text,
	"role" text DEFAULT 'user',
	"primary_group_id" text,
	"usuario" boolean DEFAULT false,
	"created_at" text,
	CONSTRAINT "players_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "position_functions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "position_functions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys_p256dh" text NOT NULL,
	"keys_auth" text NOT NULL,
	"created_at" text,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" text,
	"description" text,
	"amount" real,
	"type" text,
	"date" text,
	"category" text,
	"related_match_id" text,
	"related_player_id" text,
	"paid_player_ids" text
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"contact_name" text,
	"contact_phone" text,
	"coordinates_lat" real,
	"coordinates_lng" real,
	"description" text,
	"photos" text,
	"is_active" integer DEFAULT 1,
	"created_at" text
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_player_id_players_id_fk" FOREIGN KEY ("author_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_bookings" ADD CONSTRAINT "field_bookings_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_bookings" ADD CONSTRAINT "field_bookings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_bookings" ADD CONSTRAINT "field_bookings_booked_by_players_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_reviews" ADD CONSTRAINT "field_reviews_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_reviews" ADD CONSTRAINT "field_reviews_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_slots" ADD CONSTRAINT "field_slots_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_slots" ADD CONSTRAINT "field_slots_booked_by_group_id_groups_id_fk" FOREIGN KEY ("booked_by_group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_players" ADD CONSTRAINT "group_players_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_players" ADD CONSTRAINT "group_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_requests" ADD CONSTRAINT "group_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_requests" ADD CONSTRAINT "group_requests_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_voter_id_players_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_votes" ADD CONSTRAINT "match_votes_voted_for_id_players_id_fk" FOREIGN KEY ("voted_for_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_related_match_id_matches_id_fk" FOREIGN KEY ("related_match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_related_player_id_players_id_fk" FOREIGN KEY ("related_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_achievements_player" ON "achievements" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_achievements_group" ON "achievements" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_comments_group_match" ON "comments" USING btree ("group_id","match_id");--> statement-breakpoint
CREATE INDEX "idx_field_bookings_field" ON "field_bookings" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_field_bookings_date" ON "field_bookings" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_field_reviews_field" ON "field_reviews" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_field_slots_field_id" ON "field_slots" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "idx_field_slots_start_time" ON "field_slots" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_fields_group_id" ON "fields" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_fields_owner_id" ON "fields" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_fields_venue_id" ON "fields" USING btree ("venue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_group_players_unique_player" ON "group_players" USING btree ("group_id","player_id");--> statement-breakpoint
CREATE INDEX "idx_group_players_player_id" ON "group_players" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_group_requests_unique" ON "group_requests" USING btree ("group_id","player_id");--> statement-breakpoint
CREATE INDEX "idx_groups_admin_id" ON "groups" USING btree ("admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_match_votes_unique_voter" ON "match_votes" USING btree ("match_id","voter_id");--> statement-breakpoint
CREATE INDEX "idx_matches_date" ON "matches" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_push_sub_player" ON "push_subscriptions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_group_id" ON "transactions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_date" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_venues_owner_id" ON "venues" USING btree ("owner_id");