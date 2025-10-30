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
  
  // Actual match results (populated after match finishes)
  status: varchar("status", { length: 20 }).notNull().default("SCHEDULED"),
  homeGoals: integer("home_goals"),
  awayGoals: integer("away_goals"),
  actualHomeXg: real("actual_home_xg"),
  actualAwayXg: real("actual_away_xg"),
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
  // FIFA Stats from SoFIFA
  radarStats: jsonb("radar_stats").$type<{
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  }>(),
  sofifaId: text("sofifa_id"),
  playerFaceUrl: text("player_face_url"),
  sofifaUrl: text("sofifa_url"),
  overall: integer("overall"),
  potential: integer("potential"),
  preferredFoot: text("preferred_foot"),
  weakFoot: text("weak_foot"),
  skillMoves: text("skill_moves"),
  workRate: text("work_rate"),
  lastScraped: timestamp("last_scraped"),
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

// Enhanced ML feature tables
export const playerFeatures = pgTable("player_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  matchId: varchar("match_id").notNull(),
  // Form metrics
  recentForm: real("recent_form").notNull(),
  goalsLast5: real("goals_last_5").notNull(),
  assistsLast5: real("assists_last_5").notNull(),
  minutesLast5: real("minutes_last_5").notNull(),
  // Performance metrics
  xgPer90: real("xg_per_90").notNull(),
  xaPer90: real("xa_per_90").notNull(),
  shotsPer90: real("shots_per_90").notNull(),
  passAccuracy: real("pass_accuracy").notNull(),
  // Context metrics
  homeAdvantage: boolean("home_advantage").notNull(),
  opponentStrength: real("opponent_strength").notNull(),
  restDays: integer("rest_days").notNull(),
  // Derived features
  formTrend: real("form_trend").notNull(),
  consistencyScore: real("consistency_score").notNull(),
  injuryRisk: real("injury_risk").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamFeatures = pgTable("team_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamName: text("team_name").notNull(),
  matchId: varchar("match_id").notNull(),
  // Tactical metrics
  avgPossession: real("avg_possession").notNull(),
  ppda: real("ppda").notNull(), // Passes per defensive action
  defensiveActions: real("defensive_actions").notNull(),
  pressingIntensity: real("pressing_intensity").notNull(),
  // Performance metrics
  xgFor: real("xg_for").notNull(),
  xgAgainst: real("xg_against").notNull(),
  goalConversionRate: real("goal_conversion_rate").notNull(),
  savePercentage: real("save_percentage").notNull(),
  // Form metrics
  pointsLast5: integer("points_last_5").notNull(),
  goalsForLast5: integer("goals_for_last_5").notNull(),
  goalsAgainstLast5: integer("goals_against_last_5").notNull(),
  // Head-to-head
  h2hWins: integer("h2h_wins").notNull(),
  h2hDraws: integer("h2h_draws").notNull(),
  h2hLosses: integer("h2h_losses").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const modelRegistry = pgTable("model_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelName: text("model_name").notNull(),
  modelType: text("model_type").notNull(), // 'player', 'team', 'match', 'transfer'
  position: text("position"), // for position-specific models
  version: text("version").notNull(),
  algorithm: text("algorithm").notNull(), // 'xgboost', 'random_forest', 'catboost'
  hyperparameters: jsonb("hyperparameters").notNull(),
  trainingData: jsonb("training_data").notNull(),
  performance: jsonb("performance").notNull(), // CV scores, metrics
  featureList: jsonb("feature_list").notNull(),
  isActive: boolean("is_active").default(false),
  trainedAt: timestamp("trained_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const predictionHistory = pgTable("prediction_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull(),
  playerId: varchar("player_id"),
  predictionType: text("prediction_type").notNull(), // 'goals', 'assists', 'match_outcome', 'transfer_value'
  predictedValue: real("predicted_value").notNull(),
  actualValue: real("actual_value"),
  confidence: real("confidence").notNull(),
  modelVersion: text("model_version").notNull(),
  horizon: integer("horizon").notNull().default(1), // 1, 2, 3 gameweeks
  features: jsonb("features").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transferValues = pgTable("transfer_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  currentValue: real("current_value").notNull(),
  predictedValue: real("predicted_value").notNull(),
  valueChange: real("value_change").notNull(),
  confidence: real("confidence").notNull(),
  factors: jsonb("factors").notNull(), // age, performance, contract, media
  marketTrend: text("market_trend").notNull(), // 'rising', 'stable', 'falling'
  riskLevel: text("risk_level").notNull(), // 'low', 'medium', 'high'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matches);
export const insertPlayerSchema = createInsertSchema(players);
export const insertFeatureImportanceSchema = createInsertSchema(featureImportance);
export const insertLeaderboardSchema = createInsertSchema(leaderboard);
export const insertUserPickSchema = createInsertSchema(userPicks);
export const insertPlayerFeaturesSchema = createInsertSchema(playerFeatures);
export const insertTeamFeaturesSchema = createInsertSchema(teamFeatures);
export const insertModelRegistrySchema = createInsertSchema(modelRegistry);
export const insertPredictionHistorySchema = createInsertSchema(predictionHistory);
export const insertTransferValuesSchema = createInsertSchema(transferValues);

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
export type PlayerFeatures = typeof playerFeatures.$inferSelect;
export type InsertPlayerFeatures = z.infer<typeof insertPlayerFeaturesSchema>;
export type TeamFeatures = typeof teamFeatures.$inferSelect;
export type InsertTeamFeatures = z.infer<typeof insertTeamFeaturesSchema>;
export type ModelRegistry = typeof modelRegistry.$inferSelect;
export type InsertModelRegistry = z.infer<typeof insertModelRegistrySchema>;
export type PredictionHistory = typeof predictionHistory.$inferSelect;
export type InsertPredictionHistory = z.infer<typeof insertPredictionHistorySchema>;
export type TransferValues = typeof transferValues.$inferSelect;
export type InsertTransferValues = z.infer<typeof insertTransferValuesSchema>;

// Auth types (from blueprint:javascript_log_in_with_replit)
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
