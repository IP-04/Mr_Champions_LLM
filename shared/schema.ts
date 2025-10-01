import { pgTable, text, varchar, integer, real, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Auth tables - Required for Replit Auth (from blueprint:javascript_log_in_with_replit)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeTeamCrest: text("home_team_crest").notNull(),
  awayTeamCrest: text("away_team_crest").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  venue: text("venue").notNull(),
  stage: text("stage").notNull(),
  homeWinProb: real("home_win_prob").notNull(),
  drawProb: real("draw_prob").notNull(),
  awayWinProb: real("away_win_prob").notNull(),
  homeXg: real("home_xg").notNull(),
  awayXg: real("away_xg").notNull(),
  confidence: real("confidence").notNull(),
});

export const players = pgTable("players", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  team: text("team").notNull(),
  position: text("position").notNull(),
  imageUrl: text("image_url").notNull(),
  expectedContribution: real("expected_contribution").notNull(),
  predictedMinutes: integer("predicted_minutes").notNull(),
  statProbability: real("stat_probability").notNull(),
  statType: text("stat_type").notNull(),
  last5Avg: real("last5_avg").notNull(),
  stat90: real("stat_90").notNull(),
});

export const featureImportance = pgTable("feature_importance", {
  id: varchar("id").primaryKey(),
  matchId: varchar("match_id").notNull(),
  featureName: text("feature_name").notNull(),
  importance: real("importance").notNull(),
  impact: real("impact").notNull(),
});

export const leaderboard = pgTable("leaderboard", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  rank: integer("rank").notNull(),
  accuracy: real("accuracy").notNull(),
  points: integer("points").notNull(),
});

export const userPicks = pgTable("user_picks", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  playerId: varchar("player_id").notNull(),
  pickType: text("pick_type").notNull(),
  statLine: real("stat_line").notNull(),
  isOver: boolean("is_over").notNull(),
});

export const insertMatchSchema = createInsertSchema(matches);
export const insertPlayerSchema = createInsertSchema(players);
export const insertFeatureImportanceSchema = createInsertSchema(featureImportance);
export const insertLeaderboardSchema = createInsertSchema(leaderboard);
export const insertUserPickSchema = createInsertSchema(userPicks);

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type FeatureImportance = typeof featureImportance.$inferSelect;
export type InsertFeatureImportance = z.infer<typeof insertFeatureImportanceSchema>;
export type LeaderboardEntry = typeof leaderboard.$inferSelect;
export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardSchema>;
export type UserPick = typeof userPicks.$inferSelect;
export type InsertUserPick = z.infer<typeof insertUserPickSchema>;

// Auth types (from blueprint:javascript_log_in_with_replit)
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
