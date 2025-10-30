/**
 * Export training data from database to CSV for ML training
 * This script queries the database and generates training features
 */

import { db } from "../db";
import { matches, teamStats } from "../shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface Match {
  id: string;
  date: Date | string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeXg: number | null;
  awayXg: number | null;
  status: string;
}

interface TeamFormStats {
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  xgFor: number;
  xgAgainst: number;
  winRate?: number;
}

class ELOSystem {
  private ratings: Map<string, number> = new Map();
  private readonly K = 20;
  private readonly INITIAL_RATING = 1500;

  getRating(team: string): number {
    if (!this.ratings.has(team)) {
      this.ratings.set(team, this.INITIAL_RATING);
    }
    return this.ratings.get(team)!;
  }

  updateRatings(homeTeam: string, awayTeam: string, homeGoals: number, awayGoals: number) {
    const homeRating = this.getRating(homeTeam);
    const awayRating = this.getRating(awayTeam);

    const expectedHome = 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
    const expectedAway = 1 - expectedHome;

    let actualHome: number;
    if (homeGoals > awayGoals) actualHome = 1;
    else if (homeGoals < awayGoals) actualHome = 0;
    else actualHome = 0.5;

    const actualAway = 1 - actualHome;

    this.ratings.set(homeTeam, homeRating + this.K * (actualHome - expectedHome));
    this.ratings.set(awayTeam, awayRating + this.K * (actualAway - expectedAway));
  }
}

class TrainingDataExporter {
  private eloSystem = new ELOSystem();
  private matchHistory: Map<string, Match[]> = new Map();
  private h2hHistory: Map<string, Match[]> = new Map();

  async exportTrainingData(outputPath: string) {
    console.log("\n🔍 Fetching matches from database...");

    // Get all finished matches ordered by date
    const finishedMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.status, "FINISHED"))
      .orderBy(matches.date);

    console.log(`✅ Found ${finishedMatches.length} finished matches\n`);

    if (finishedMatches.length < 10) {
      console.log("❌ Insufficient data: Need at least 10 finished matches");
      return;
    }

    // Calculate features for each match
    const trainingData: any[] = [];
    
    for (const match of finishedMatches) {
      if (match.homeGoals === null || match.awayGoals === null) continue;

      const features = this.calculateFeatures(match);
      if (features) {
        trainingData.push(features);
      }

      // Update historical data
      this.updateMatchHistory(match);
      this.eloSystem.updateRatings(
        match.homeTeam,
        match.awayTeam,
        match.homeGoals,
        match.awayGoals
      );
    }

    console.log(`📊 Generated ${trainingData.length} training samples\n`);

    // Convert to CSV
    const csvLines = [
      // Header
      "home_elo,away_elo,elo_diff,home_form_last5,away_form_last5," +
      "home_goals_last5,away_goals_last5,home_xg_last5,away_xg_last5," +
      "h2h_home_wins,h2h_draws,h2h_away_wins,home_possession_avg,away_possession_avg," +
      "venue_advantage,stage_importance,home_rest_days,away_rest_days," +
      "outcome,home_goals,away_goals,home_xg,away_xg"
    ];

    for (const data of trainingData) {
      csvLines.push(
        `${data.home_elo},${data.away_elo},${data.elo_diff},` +
        `${data.home_form_last5},${data.away_form_last5},` +
        `${data.home_goals_last5},${data.away_goals_last5},` +
        `${data.home_xg_last5},${data.away_xg_last5},` +
        `${data.h2h_home_wins},${data.h2h_draws},${data.h2h_away_wins},` +
        `${data.home_possession_avg},${data.away_possession_avg},` +
        `${data.venue_advantage},${data.stage_importance},` +
        `${data.home_rest_days},${data.away_rest_days},` +
        `${data.outcome},${data.home_goals},${data.away_goals},` +
        `${data.home_xg},${data.away_xg}`
      );
    }

    // Write to file
    const csvContent = csvLines.join("\n");
    fs.writeFileSync(outputPath, csvContent, "utf8");

    console.log(`✅ Training data exported to: ${outputPath}`);
    console.log(`   Rows: ${trainingData.length}`);
    console.log(`   Features: 18`);
    console.log(`   Labels: outcome, home_xg, away_xg\n`);
  }

  private calculateFeatures(match: Match): any | null {
    // Get ELO ratings (before this match)
    const homeElo = this.eloSystem.getRating(match.homeTeam);
    const awayElo = this.eloSystem.getRating(match.awayTeam);
    const eloDiff = homeElo - awayElo;

    // Convert date to Date object if string
    const matchDate = typeof match.date === 'string' ? new Date(match.date) : match.date;

    // Get form stats (last 5 matches before this one)
    const homeForm = this.getTeamForm(match.homeTeam, matchDate);
    const awayForm = this.getTeamForm(match.awayTeam, matchDate);

    // Get head-to-head stats
    const h2h = this.getH2HStats(match.homeTeam, match.awayTeam, matchDate);

    // Calculate possession averages (use defaults since not in DB yet)
    const homePossessionAvg = 50 + (eloDiff / 40); // Estimate based on ELO
    const awayPossessionAvg = 100 - homePossessionAvg;

    // Venue advantage (always 1.0 for home team)
    const venueAdvantage = 1.0;

    // Stage importance (simplified - can be enhanced with actual stage data)
    const stageImportance = 0.5;

    // Rest days (estimate - we don't have exact data)
    const homeRestDays = 7;
    const awayRestDays = 7;

    // Labels
    let outcome: number;
    if (match.homeGoals! > match.awayGoals!) outcome = 0; // Home win
    else if (match.homeGoals! < match.awayGoals!) outcome = 2; // Away win
    else outcome = 1; // Draw

    return {
      // Features
      home_elo: homeElo.toFixed(2),
      away_elo: awayElo.toFixed(2),
      elo_diff: eloDiff.toFixed(2),
      home_form_last5: (homeForm.winRate || 0).toFixed(3),
      away_form_last5: (awayForm.winRate || 0).toFixed(3),
      home_goals_last5: homeForm.goalsScored.toFixed(2),
      away_goals_last5: awayForm.goalsScored.toFixed(2),
      home_xg_last5: homeForm.xgFor.toFixed(2),
      away_xg_last5: awayForm.xgFor.toFixed(2),
      h2h_home_wins: h2h.homeWins,
      h2h_draws: h2h.draws,
      h2h_away_wins: h2h.awayWins,
      home_possession_avg: homePossessionAvg.toFixed(2),
      away_possession_avg: awayPossessionAvg.toFixed(2),
      venue_advantage: venueAdvantage.toFixed(2),
      stage_importance: stageImportance.toFixed(2),
      home_rest_days: homeRestDays,
      away_rest_days: awayRestDays,
      
      // Labels
      outcome: outcome,
      home_goals: match.homeGoals,
      away_goals: match.awayGoals,
      home_xg: match.homeXg?.toFixed(2) || "0.00",
      away_xg: match.awayXg?.toFixed(2) || "0.00",
    };
  }

  private getTeamForm(team: string, beforeDate: Date): TeamFormStats {
    const history = this.matchHistory.get(team) || [];
    
    // Get last 5 matches before this date
    const recentMatches = history
      .filter(m => m.date < beforeDate)
      .slice(-5);

    if (recentMatches.length === 0) {
      return {
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        xgFor: 0,
        xgAgainst: 0,
      };
    }

    let wins = 0, draws = 0, losses = 0;
    let goalsScored = 0, goalsConceded = 0;
    let xgFor = 0, xgAgainst = 0;

    for (const match of recentMatches) {
      const isHome = match.homeTeam === team;
      const teamGoals = isHome ? (match.homeGoals || 0) : (match.awayGoals || 0);
      const oppGoals = isHome ? (match.awayGoals || 0) : (match.homeGoals || 0);
      const teamXg = isHome ? (match.homeXg || 0) : (match.awayXg || 0);
      const oppXg = isHome ? (match.awayXg || 0) : (match.homeXg || 0);

      if (teamGoals > oppGoals) wins++;
      else if (teamGoals < oppGoals) losses++;
      else draws++;

      goalsScored += teamGoals;
      goalsConceded += oppGoals;
      xgFor += teamXg;
      xgAgainst += oppXg;
    }

    const matchCount = recentMatches.length;
    const winRate = wins / matchCount;

    return {
      wins,
      draws,
      losses,
      goalsScored: goalsScored / matchCount,
      goalsConceded: goalsConceded / matchCount,
      xgFor: xgFor / matchCount,
      xgAgainst: xgAgainst / matchCount,
      winRate,
    } as any;
  }

  private getH2HStats(homeTeam: string, awayTeam: string, beforeDate: Date) {
    const key = `${homeTeam}_vs_${awayTeam}`;
    const h2hMatches = (this.h2hHistory.get(key) || [])
      .filter(m => m.date < beforeDate);

    let homeWins = 0, draws = 0, awayWins = 0;

    for (const match of h2hMatches) {
      if (match.homeGoals! > match.awayGoals!) homeWins++;
      else if (match.homeGoals! < match.awayGoals!) awayWins++;
      else draws++;
    }

    return { homeWins, draws, awayWins };
  }

  private updateMatchHistory(match: Match) {
    // Add to team histories
    if (!this.matchHistory.has(match.homeTeam)) {
      this.matchHistory.set(match.homeTeam, []);
    }
    if (!this.matchHistory.has(match.awayTeam)) {
      this.matchHistory.set(match.awayTeam, []);
    }

    this.matchHistory.get(match.homeTeam)!.push(match);
    this.matchHistory.get(match.awayTeam)!.push(match);

    // Add to h2h history
    const key = `${match.homeTeam}_vs_${match.awayTeam}`;
    if (!this.h2hHistory.has(key)) {
      this.h2hHistory.set(key, []);
    }
    this.h2hHistory.get(key)!.push(match);
  }
}

// Main execution
async function main() {
  const exporter = new TrainingDataExporter();
  const outputPath = path.join(process.cwd(), "ml", "python", "data", "real_training_data.csv");

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await exporter.exportTrainingData(outputPath);
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Export failed:", error);
  process.exit(1);
});
