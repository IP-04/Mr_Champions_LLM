/**
 * Collect extensive historical UCL data for ML training
 * Fetches matches from multiple seasons and exports to CSV
 */

import { db } from "../db";
import { matches } from "../shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { FootballDataApiService } from "../server/services/footballDataApi";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get API key from environment
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || "";

interface TrainingRow {
  home_elo: number;
  away_elo: number;
  elo_diff: number;
  home_form_last5: number;
  away_form_last5: number;
  home_goals_last5: number;
  away_goals_last5: number;
  home_xg_last5: number;
  away_xg_last5: number;
  h2h_home_wins: number;
  h2h_draws: number;
  h2h_away_wins: number;
  home_possession_avg: number;
  away_possession_avg: number;
  venue_advantage: number;
  stage_importance: number;
  home_rest_days: number;
  away_rest_days: number;
  elo_gap_magnitude: number;
  underdog_factor: number;
  quality_tier_home: number;
  quality_tier_away: number;
  strength_adjusted_venue: number;
  outcome: number; // 0=home win, 1=draw, 2=away win
  home_goals: number;
  away_goals: number;
  home_xg: number;
  away_xg: number;
}

// ELO system for tracking team strength
class ELOSystem {
  private ratings: Map<string, number> = new Map();
  private readonly K_FACTOR = 32;
  private readonly DEFAULT_RATING = 1500;

  getOrInitialize(team: string): number {
    if (!this.ratings.has(team)) {
      this.ratings.set(team, this.DEFAULT_RATING);
    }
    return this.ratings.get(team)!;
  }

  updateRatings(homeTeam: string, awayTeam: string, homeGoals: number, awayGoals: number) {
    const homeElo = this.getOrInitialize(homeTeam);
    const awayElo = this.getOrInitialize(awayTeam);

    // Expected scores
    const expectedHome = 1 / (1 + Math.pow(10, (awayElo - homeElo) / 400));
    const expectedAway = 1 - expectedHome;

    // Actual scores
    let actualHome: number;
    let actualAway: number;

    if (homeGoals > awayGoals) {
      actualHome = 1;
      actualAway = 0;
    } else if (homeGoals < awayGoals) {
      actualHome = 0;
      actualAway = 1;
    } else {
      actualHome = 0.5;
      actualAway = 0.5;
    }

    // Update ratings
    const newHomeElo = homeElo + this.K_FACTOR * (actualHome - expectedHome);
    const newAwayElo = awayElo + this.K_FACTOR * (actualAway - expectedAway);

    this.ratings.set(homeTeam, newHomeElo);
    this.ratings.set(awayTeam, newAwayElo);
  }

  getRatings(): Map<string, number> {
    return new Map(this.ratings);
  }
}

// Form tracker for teams
class FormTracker {
  private recentMatches: Map<string, Array<{
    goals: number;
    conceded: number;
    xg: number;
    xga: number;
    points: number;
  }>> = new Map();

  recordMatch(team: string, goals: number, conceded: number, xg: number, xga: number) {
    if (!this.recentMatches.has(team)) {
      this.recentMatches.set(team, []);
    }

    const points = goals > conceded ? 3 : goals === conceded ? 1 : 0;
    const matches = this.recentMatches.get(team)!;
    
    matches.push({ goals, conceded, xg, xga, points });
    
    // Keep only last 5 matches
    if (matches.length > 5) {
      matches.shift();
    }
  }

  getForm(team: string) {
    const matches = this.recentMatches.get(team) || [];
    
    if (matches.length === 0) {
      return { formPoints: 0, goalsScored: 0, xg: 0 };
    }

    const totalPoints = matches.reduce((sum, m) => sum + m.points, 0);
    const totalGoals = matches.reduce((sum, m) => sum + m.goals, 0);
    const totalXg = matches.reduce((sum, m) => sum + m.xg, 0);

    return {
      formPoints: totalPoints / matches.length,
      goalsScored: totalGoals,
      xg: totalXg
    };
  }
}

async function collectHistoricalData() {
  console.log("\n🎯 COLLECTING EXTENSIVE HISTORICAL UCL DATA");
  console.log("=".repeat(60));

  if (!API_KEY) {
    console.error("❌ FOOTBALL_DATA_API_KEY not found in environment variables");
    console.log("\n📝 To get an API key:");
    console.log("   1. Visit https://www.football-data.org/");
    console.log("   2. Sign up for a free account");
    console.log("   3. Add API key to .env file as FOOTBALL_DATA_API_KEY");
    console.log("\n💡 Alternative: The system will use existing database matches");
    console.log("   Run: npm run import-finished-matches");
    return;
  }

  const api = new FootballDataApiService(API_KEY);
  
  // Fetch all UCL matches from database
  console.log("\n📊 Fetching finished matches from database...");
  const dbMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.status, "FINISHED"),
        sql`${matches.homeGoals} IS NOT NULL`,
        sql`${matches.awayGoals} IS NOT NULL`
      )
    )
    .orderBy(desc(matches.date));

  console.log(`✅ Found ${dbMatches.length} finished matches in database`);

  if (dbMatches.length < 50) {
    console.log("\n⚠️  Limited data available. Attempting to fetch more from API...");
    
    try {
      const apiMatches = await api.getChampionsLeagueMatches();
      const finishedApiMatches = apiMatches.filter(m => 
        m.status === "FINISHED" && 
        m.score.fullTime.home !== null && 
        m.score.fullTime.away !== null
      );
      
      console.log(`✅ Found ${finishedApiMatches.length} finished matches from API`);
    } catch (error) {
      console.warn("⚠️  Could not fetch from API:", error);
    }
  }

  // Initialize ELO and form tracking
  const eloSystem = new ELOSystem();
  const formTracker = new FormTracker();
  const h2hHistory = new Map<string, { homeWins: number; draws: number; awayWins: number }>();

  const trainingData: TrainingRow[] = [];

  console.log("\n🔄 Processing matches and calculating features...");

  for (const match of dbMatches) {
    const homeTeam = match.homeTeam;
    const awayTeam = match.awayTeam;
    const homeGoals = match.homeGoals!;
    const awayGoals = match.awayGoals!;
    
    // Get current ELO ratings BEFORE this match
    const homeElo = eloSystem.getOrInitialize(homeTeam);
    const awayElo = eloSystem.getOrInitialize(awayTeam);
    const eloDiff = homeElo - awayElo;

    // Get form data BEFORE this match
    const homeForm = formTracker.getForm(homeTeam);
    const awayForm = formTracker.getForm(awayTeam);

    // Get H2H stats
    const h2hKey = [homeTeam, awayTeam].sort().join("_vs_");
    const h2h = h2hHistory.get(h2hKey) || { homeWins: 0, draws: 0, awayWins: 0 };

    // Calculate new features
    const eloGapMagnitude = Math.abs(eloDiff);
    const underdogFactor = awayElo > homeElo ? 1 : 0;
    
    const getQualityTier = (elo: number): number => {
      if (elo > 1850) return 1;
      if (elo > 1750) return 2;
      return 3;
    };

    const qualityTierHome = getQualityTier(homeElo);
    const qualityTierAway = getQualityTier(awayElo);

    const baseVenueAdvantage = 0.15;
    const strengthAdjustedVenue = baseVenueAdvantage * (1 - Math.min(eloGapMagnitude / 200, 0.8));

    // Stage importance
    const getStageImportance = (stage: string): number => {
      if (stage.toLowerCase().includes("final")) return 10;
      if (stage.toLowerCase().includes("semi")) return 9;
      if (stage.toLowerCase().includes("quarter")) return 8;
      if (stage.toLowerCase().includes("round of 16")) return 7;
      return 6;
    };

    // Determine outcome
    let outcome: number;
    if (homeGoals > awayGoals) outcome = 0; // Home win
    else if (homeGoals < awayGoals) outcome = 2; // Away win
    else outcome = 1; // Draw

    // Create training row
    const row: TrainingRow = {
      home_elo: homeElo,
      away_elo: awayElo,
      elo_diff: eloDiff,
      home_form_last5: homeForm.formPoints,
      away_form_last5: awayForm.formPoints,
      home_goals_last5: homeForm.goalsScored,
      away_goals_last5: awayForm.goalsScored,
      home_xg_last5: homeForm.xg,
      away_xg_last5: awayForm.xg,
      h2h_home_wins: h2h.homeWins,
      h2h_draws: h2h.draws,
      h2h_away_wins: h2h.awayWins,
      home_possession_avg: 52 + (homeElo - 1700) / 50,
      away_possession_avg: 48 + (awayElo - 1700) / 50,
      venue_advantage: baseVenueAdvantage,
      stage_importance: getStageImportance(match.stage || "Group Stage"),
      home_rest_days: 4,
      away_rest_days: 4,
      elo_gap_magnitude: eloGapMagnitude,
      underdog_factor: underdogFactor,
      quality_tier_home: qualityTierHome,
      quality_tier_away: qualityTierAway,
      strength_adjusted_venue: strengthAdjustedVenue,
      outcome: outcome,
      home_goals: homeGoals,
      away_goals: awayGoals,
      home_xg: match.homeXg || 1.5,
      away_xg: match.awayXg || 1.5
    };

    trainingData.push(row);

    // Update ELO ratings AFTER this match
    eloSystem.updateRatings(homeTeam, awayTeam, homeGoals, awayGoals);

    // Update form tracker
    formTracker.recordMatch(homeTeam, homeGoals, awayGoals, row.home_xg, row.away_xg);
    formTracker.recordMatch(awayTeam, awayGoals, homeGoals, row.away_xg, row.home_xg);

    // Update H2H history
    if (homeGoals > awayGoals) h2h.homeWins++;
    else if (homeGoals < awayGoals) h2h.awayWins++;
    else h2h.draws++;
    h2hHistory.set(h2hKey, h2h);
  }

  console.log(`✅ Generated ${trainingData.length} training samples`);

  // Save to CSV
  const csvPath = path.join(__dirname, "..", "ml", "python", "data", "real_training_data.csv");
  
  // Create CSV header
  const header = Object.keys(trainingData[0]).join(",");
  const rows = trainingData.map(row => Object.values(row).join(","));
  const csvContent = [header, ...rows].join("\n");

  fs.writeFileSync(csvPath, csvContent);

  console.log(`\n✅ Training data exported to: ${csvPath}`);
  console.log(`\n📊 Dataset Statistics:`);
  console.log(`   Total samples: ${trainingData.length}`);
  
  const homeWins = trainingData.filter(r => r.outcome === 0).length;
  const draws = trainingData.filter(r => r.outcome === 1).length;
  const awayWins = trainingData.filter(r => r.outcome === 2).length;
  
  console.log(`   Home wins: ${homeWins} (${(homeWins/trainingData.length*100).toFixed(1)}%)`);
  console.log(`   Draws: ${draws} (${(draws/trainingData.length*100).toFixed(1)}%)`);
  console.log(`   Away wins: ${awayWins} (${(awayWins/trainingData.length*100).toFixed(1)}%)`);
  
  console.log(`\n🎯 Next Steps:`);
  console.log(`   1. cd ml/python`);
  console.log(`   2. python train_real_data.py`);
  console.log(`   3. Restart the ML server to use new models`);
}

collectHistoricalData()
  .then(() => {
    console.log("\n✅ Data collection complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
