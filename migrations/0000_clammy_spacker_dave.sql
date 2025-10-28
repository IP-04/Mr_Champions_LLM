CREATE TABLE "feature_importance" (
	"id" varchar PRIMARY KEY NOT NULL,
	"match_id" varchar NOT NULL,
	"feature_name" text NOT NULL,
	"importance" real NOT NULL,
	"impact" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text NOT NULL,
	"rank" integer NOT NULL,
	"accuracy" real NOT NULL,
	"points" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" varchar PRIMARY KEY NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_team_crest" text NOT NULL,
	"away_team_crest" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"venue" text NOT NULL,
	"stage" text NOT NULL,
	"home_win_prob" real NOT NULL,
	"draw_prob" real NOT NULL,
	"away_win_prob" real NOT NULL,
	"home_xg" real NOT NULL,
	"away_xg" real NOT NULL,
	"confidence" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_registry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_name" text NOT NULL,
	"model_type" text NOT NULL,
	"position" text,
	"version" text NOT NULL,
	"algorithm" text NOT NULL,
	"hyperparameters" jsonb NOT NULL,
	"training_data" jsonb NOT NULL,
	"performance" jsonb NOT NULL,
	"feature_list" jsonb NOT NULL,
	"is_active" boolean DEFAULT false,
	"trained_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"match_id" varchar NOT NULL,
	"recent_form" real NOT NULL,
	"goals_last_5" real NOT NULL,
	"assists_last_5" real NOT NULL,
	"minutes_last_5" real NOT NULL,
	"xg_per_90" real NOT NULL,
	"xa_per_90" real NOT NULL,
	"shots_per_90" real NOT NULL,
	"pass_accuracy" real NOT NULL,
	"home_advantage" boolean NOT NULL,
	"opponent_strength" real NOT NULL,
	"rest_days" integer NOT NULL,
	"form_trend" real NOT NULL,
	"consistency_score" real NOT NULL,
	"injury_risk" real NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"team" text NOT NULL,
	"position" text NOT NULL,
	"image_url" text NOT NULL,
	"expected_contribution" real NOT NULL,
	"predicted_minutes" integer NOT NULL,
	"stat_probability" real NOT NULL,
	"stat_type" text NOT NULL,
	"last5_avg" real NOT NULL,
	"stat_90" real NOT NULL,
	"radar_stats" jsonb,
	"sofifa_id" text
);
--> statement-breakpoint
CREATE TABLE "prediction_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"player_id" varchar,
	"prediction_type" text NOT NULL,
	"predicted_value" real NOT NULL,
	"actual_value" real,
	"confidence" real NOT NULL,
	"model_version" text NOT NULL,
	"horizon" integer DEFAULT 1 NOT NULL,
	"features" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_features" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_name" text NOT NULL,
	"match_id" varchar NOT NULL,
	"avg_possession" real NOT NULL,
	"ppda" real NOT NULL,
	"defensive_actions" real NOT NULL,
	"pressing_intensity" real NOT NULL,
	"xg_for" real NOT NULL,
	"xg_against" real NOT NULL,
	"goal_conversion_rate" real NOT NULL,
	"save_percentage" real NOT NULL,
	"points_last_5" integer NOT NULL,
	"goals_for_last_5" integer NOT NULL,
	"goals_against_last_5" integer NOT NULL,
	"h2h_wins" integer NOT NULL,
	"h2h_draws" integer NOT NULL,
	"h2h_losses" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transfer_values" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"current_value" real NOT NULL,
	"predicted_value" real NOT NULL,
	"value_change" real NOT NULL,
	"confidence" real NOT NULL,
	"factors" jsonb NOT NULL,
	"market_trend" text NOT NULL,
	"risk_level" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_picks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"pick_type" text NOT NULL,
	"stat_line" real NOT NULL,
	"is_over" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");