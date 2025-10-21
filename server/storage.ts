import { type Match, type InsertMatch, type Player, type InsertPlayer, type FeatureImportance, type InsertFeatureImportance, type LeaderboardEntry, type InsertLeaderboardEntry, type UserPick, type InsertUserPick, type User, type UpsertUser } from "@shared/schema";
import { matches, players, featureImportance, leaderboard, userPicks, users } from "@shared/schema";
import { db } from "../db";
import { eq, and, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations (Required for Replit Auth - blueprint:javascript_log_in_with_replit)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Matches
  getMatches(): Promise<Match[]>;
  getMatch(id: string): Promise<Match | undefined>;
  createMatch(match: InsertMatch): Promise<Match>;
  
  // Players
  getPlayers(): Promise<Player[]>;
  getPlayersByPosition(position: string): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  
  // Feature Importance
  getFeatureImportanceByMatch(matchId: string): Promise<FeatureImportance[]>;
  
  // Leaderboard
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  
  // User Picks
  getUserPicks(userId: string): Promise<UserPick[]>;
  createUserPick(pick: InsertUserPick): Promise<UserPick>;
  deleteUserPick(id: string, userId: string): Promise<void>;
  
  // Initialization
  seedMockData(): Promise<void>;
}

export class DbStorage implements IStorage {
  // User operations (Required for Replit Auth - blueprint:javascript_log_in_with_replit)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async seedMockData(): Promise<void> {
    // Check if data already exists
    const existingMatches = await db.select().from(matches).limit(1);
    if (existingMatches.length > 0) {
      return; // Already seeded
    }

    // Mock Matches
    const match1: InsertMatch = {
      id: "match-1",
      homeTeam: "Man City",
      awayTeam: "Bayern",
      homeTeamCrest: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=100&h=100&fit=crop",
      awayTeamCrest: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=100&h=100&fit=crop",
      date: "Today",
      time: "21:00 CET",
      venue: "Etihad Stadium, Manchester",
      stage: "Round of 16",
      homeWinProb: 52.0,
      drawProb: 28.0,
      awayWinProb: 20.0,
      homeXg: 2.3,
      awayXg: 1.7,
      confidence: 87.3,
    };

    const match2: InsertMatch = {
      id: "match-2",
      homeTeam: "Real Madrid",
      awayTeam: "Inter",
      homeTeamCrest: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=100&h=100&fit=crop",
      awayTeamCrest: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=100&h=100&fit=crop",
      date: "Today",
      time: "21:00 CET",
      venue: "Santiago Bernabéu, Madrid",
      stage: "Round of 16",
      homeWinProb: 65.0,
      drawProb: 22.0,
      awayWinProb: 13.0,
      homeXg: 2.8,
      awayXg: 1.4,
      confidence: 91.5,
    };

    await db.insert(matches).values([match1, match2]);

    // Mock Players
    const mockPlayers: InsertPlayer[] = [
      {
        id: "player-1",
        name: "E. Haaland",
        team: "Man City",
        position: "FWD",
        imageUrl: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=60&h=60&fit=crop&crop=faces",
        expectedContribution: 8.4,
        predictedMinutes: 85,
        statProbability: 67,
        statType: "Goals",
        last5Avg: 7.2,
        stat90: 1.2,
      },
      {
        id: "player-2",
        name: "K. De Bruyne",
        team: "Man City",
        position: "MID",
        imageUrl: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=60&h=60&fit=crop&crop=faces",
        expectedContribution: 7.2,
        predictedMinutes: 78,
        statProbability: 52,
        statType: "Assists",
        last5Avg: 6.8,
        stat90: 3.4,
      },
      {
        id: "player-3",
        name: "R. Dias",
        team: "Man City",
        position: "DEF",
        imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=60&h=60&fit=crop&crop=faces",
        expectedContribution: 5.8,
        predictedMinutes: 90,
        statProbability: 45,
        statType: "Clean Sheet",
        last5Avg: 5.4,
        stat90: 4.2,
      },
      {
        id: "player-4",
        name: "Ederson",
        team: "Man City",
        position: "GK",
        imageUrl: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=60&h=60&fit=crop&crop=faces",
        expectedContribution: 5.2,
        predictedMinutes: 90,
        statProbability: 72,
        statType: "Saves",
        last5Avg: 4.9,
        stat90: 3.2,
      },
    ];

    await db.insert(players).values(mockPlayers);

    // Mock Feature Importance
    const features: InsertFeatureImportance[] = [
      { id: "f-1", matchId: "match-1", featureName: "Home Form Advantage", importance: 75, impact: 0.12 },
      { id: "f-2", matchId: "match-1", featureName: "Recent Performance", importance: 55, impact: 0.08 },
      { id: "f-3", matchId: "match-1", featureName: "Opponent Defensive Rating", importance: 40, impact: -0.06 },
      { id: "f-4", matchId: "match-1", featureName: "Squad Availability", importance: 35, impact: 0.05 },
      { id: "f-5", matchId: "match-1", featureName: "Travel & Rest Days", importance: 20, impact: -0.03 },
    ];

    await db.insert(featureImportance).values(features);

    // Mock Leaderboard
    const leaderboardData: InsertLeaderboardEntry[] = [
      {
        id: "l-1",
        username: "Alex_UCL",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=faces",
        rank: 1,
        accuracy: 94.2,
        points: 1247,
      },
      {
        id: "l-2",
        username: "Sarah_M",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=faces",
        rank: 2,
        accuracy: 92.8,
        points: 1189,
      },
      {
        id: "l-3",
        username: "Mike_Pred",
        avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=40&h=40&fit=crop&crop=faces",
        rank: 3,
        accuracy: 91.5,
        points: 1134,
      },
      {
        id: "l-4",
        username: "You",
        avatarUrl: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=faces",
        rank: 24,
        accuracy: 88.3,
        points: 987,
      },
    ];

    await db.insert(leaderboard).values(leaderboardData);
  }

  async getMatches(): Promise<Match[]> {
    return await db.select().from(matches).orderBy(asc(matches.date));
  }

  async getMatch(id: string): Promise<Match | undefined> {
    const result = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
    return result[0];
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const id = insertMatch.id || randomUUID();
    const match = { ...insertMatch, id };
    await db.insert(matches).values(match);
    return match as Match;
  }

  async getPlayers(): Promise<Player[]> {
    return await db.select().from(players);
  }

  async getPlayersByPosition(position: string): Promise<Player[]> {
    if (position === "ALL") {
      return this.getPlayers();
    }
    return await db.select().from(players).where(eq(players.position, position));
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const result = await db.select().from(players).where(eq(players.id, id)).limit(1);
    return result[0];
  }

  async getFeatureImportanceByMatch(matchId: string): Promise<FeatureImportance[]> {
    return await db.select().from(featureImportance).where(eq(featureImportance.matchId, matchId));
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return await db.select().from(leaderboard);
  }

  async getUserPicks(userId: string): Promise<UserPick[]> {
    return await db.select().from(userPicks).where(eq(userPicks.userId, userId));
  }

  async createUserPick(insertPick: InsertUserPick): Promise<UserPick> {
    const id = randomUUID();
    const pick = { ...insertPick, id };
    await db.insert(userPicks).values(pick);
    return pick as UserPick;
  }

  async deleteUserPick(id: string, userId: string): Promise<void> {
    await db.delete(userPicks).where(and(eq(userPicks.id, id), eq(userPicks.userId, userId)));
  }
}

export const storage = new DbStorage();
