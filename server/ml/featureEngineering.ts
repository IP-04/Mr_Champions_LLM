/**
 * Feature Engineering for ML Models
 * Calculate ELO ratings, form metrics, and rolling statistics
 */

import { db } from "../../db";
import { matches } from "@shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

interface TeamFormData {
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  xG: number;
  xGA: number;
}

interface HeadToHeadStats {
  homeWins: number;
  draws: number;
  awayWins: number;
  totalMatches: number;
}

export class FeatureEngineeringService {
  // ELO ratings for UCL teams (based on UEFA coefficients and recent performance)
  private eloRatings: Record<string, number> = {
    "Manchester City": 1920,
    "Real Madrid": 1910,
    "Bayern Munich": 1895,
    "Liverpool": 1880,
    "Barcelona": 1870,
    "Paris Saint-Germain": 1860,
    "Inter Milan": 1845,
    "Arsenal": 1835,
    "Atletico Madrid": 1830,
    "Juventus": 1825,
    "Chelsea": 1815,
    "Manchester United": 1810,
    "AC Milan": 1805,
    "Borussia Dortmund": 1825,
    "RB Leipzig": 1800,
    "Sporting CP": 1780,
    "Benfica": 1790,
    "PSV Eindhoven": 1760,
  };

  /**
   * Get ELO rating for a team
   */
  getEloRating(teamName: string): number {
    // Normalize team name for matching
    const normalizedName = teamName.toLowerCase().trim();
    
    for (const [key, value] of Object.entries(this.eloRatings)) {
      if (
        key.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(key.toLowerCase())
      ) {
        return value;
      }
    }
    
    // Default ELO for unknown teams
    return 1700;
  }

  /**
   * Calculate form metrics for a team from last 5 matches
   */
  async getTeamFormData(teamName: string, limit: number = 5): Promise<TeamFormData> {
    try {
      console.log(`[FeatureEngineering] Querying form data for: ${teamName}`);
      
      // Get last 5 finished matches for this team
      const teamMatches = await db
        .select()
        .from(matches)
        .where(
          and(
            or(
              sql`LOWER(${matches.homeTeam}) LIKE LOWER(${`%${teamName}%`})`,
              sql`LOWER(${matches.awayTeam}) LIKE LOWER(${`%${teamName}%`})`
            ),
            eq(matches.status, "FINISHED"),
            sql`${matches.homeGoals} IS NOT NULL`,
            sql`${matches.awayGoals} IS NOT NULL`
          )
        )
        .orderBy(desc(matches.date))
        .limit(limit);

      console.log(`[FeatureEngineering] Found ${teamMatches.length} finished matches for ${teamName}`);

      if (teamMatches.length === 0) {
        // No historical data - return neutral defaults
        console.log(`[FeatureEngineering] ⚠️ No historical data for ${teamName}`);
        return {
          wins: 0,
          draws: 0,
          losses: 0,
          goalsScored: 0,
          goalsConceded: 0,
          xG: 0,
          xGA: 0,
        };
      }

      let wins = 0;
      let draws = 0;
      let losses = 0;
      let goalsScored = 0;
      let goalsConceded = 0;
      let xG = 0;
      let xGA = 0;

      for (const match of teamMatches) {
        const isHome = match.homeTeam.toLowerCase().includes(teamName.toLowerCase());
        const teamGoals = isHome ? match.homeGoals! : match.awayGoals!;
        const oppGoals = isHome ? match.awayGoals! : match.homeGoals!;
        const teamXg = isHome ? match.homeXg : match.awayXg;
        const oppXg = isHome ? match.awayXg : match.homeXg;

        // Results
        if (teamGoals > oppGoals) wins++;
        else if (teamGoals < oppGoals) losses++;
        else draws++;

        // Goals
        goalsScored += teamGoals;
        goalsConceded += oppGoals;

        // xG
        xG += teamXg;
        xGA += oppXg;
      }

      return {
        wins,
        draws,
        losses,
        goalsScored,
        goalsConceded,
        xG,
        xGA,
      };
    } catch (error) {
      console.error(`[FeatureEngineering] ❌ Error fetching form data for ${teamName}:`, error);
      // Return neutral defaults on error
      return {
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        xG: 0,
        xGA: 0,
      };
    }
  }

  /**
   * Calculate form metrics for a team
   */
  calculateFormMetrics(recentMatches: TeamFormData): {
    formPoints: number;
    goalsPerGame: number;
    goalsConcededPerGame: number;
    xGPerGame: number;
    xGAPerGame: number;
  } {
    const totalMatches = recentMatches.wins + recentMatches.draws + recentMatches.losses;
    
    if (totalMatches === 0) {
      return {
        formPoints: 0,
        goalsPerGame: 0,
        goalsConcededPerGame: 0,
        xGPerGame: 0,
        xGAPerGame: 0,
      };
    }

    const formPoints = (recentMatches.wins * 3 + recentMatches.draws) / totalMatches;
    const goalsPerGame = recentMatches.goalsScored / totalMatches;
    const goalsConcededPerGame = recentMatches.goalsConceded / totalMatches;
    const xGPerGame = recentMatches.xG / totalMatches;
    const xGAPerGame = recentMatches.xGA / totalMatches;

    return {
      formPoints,
      goalsPerGame,
      goalsConcededPerGame,
      xGPerGame,
      xGAPerGame,
    };
  }

  /**
   * Calculate head-to-head statistics
   */
  async calculateH2HStats(homeTeam: string, awayTeam: string): Promise<HeadToHeadStats> {
    try {
      console.log(`[FeatureEngineering] Querying H2H: ${homeTeam} vs ${awayTeam}`);
      
      // Get all finished matches between these two teams
      const h2hMatches = await db
        .select()
        .from(matches)
        .where(
          and(
            or(
              and(
                sql`LOWER(${matches.homeTeam}) LIKE LOWER(${`%${homeTeam}%`})`,
                sql`LOWER(${matches.awayTeam}) LIKE LOWER(${`%${awayTeam}%`})`
              ),
              and(
                sql`LOWER(${matches.homeTeam}) LIKE LOWER(${`%${awayTeam}%`})`,
                sql`LOWER(${matches.awayTeam}) LIKE LOWER(${`%${homeTeam}%`})`
              )
            ),
            eq(matches.status, "FINISHED"),
            sql`${matches.homeGoals} IS NOT NULL`
          )
        );

      console.log(`[FeatureEngineering] Found ${h2hMatches.length} H2H matches`);

      if (h2hMatches.length === 0) {
        console.log(`[FeatureEngineering] ⚠️ No H2H history`);
        return {
          homeWins: 0,
          draws: 0,
          awayWins: 0,
          totalMatches: 0,
        };
      }

      let homeWins = 0;
      let draws = 0;
      let awayWins = 0;

      for (const match of h2hMatches) {
        // Check if current homeTeam was home in this match
        const wasHomeTeamHome = match.homeTeam.toLowerCase().includes(homeTeam.toLowerCase());
        
        if (match.homeGoals! > match.awayGoals!) {
          // Home team won
          if (wasHomeTeamHome) homeWins++;
          else awayWins++;
        } else if (match.homeGoals! < match.awayGoals!) {
          // Away team won
          if (wasHomeTeamHome) awayWins++;
          else homeWins++;
        } else {
          draws++;
        }
      }

      return {
        homeWins,
        draws,
        awayWins,
        totalMatches: h2hMatches.length,
      };
    } catch (error) {
      console.error(`[FeatureEngineering] ❌ Error calculating H2H stats for ${homeTeam} vs ${awayTeam}:`, error);
      return {
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        totalMatches: 0,
      };
    }
  }

  /**
   * Calculate venue advantage factor - scaled appropriately
   * Returns a small bonus (0.1-0.3) that doesn't override ELO differences
   */
  calculateVenueAdvantage(homeElo: number, awayElo: number, venue?: string): number {
    // Base home advantage - small and proportional to team strength
    const eloDiff = homeElo - awayElo;
    
    // If home team is significantly weaker (ELO diff < -80), minimal home advantage
    if (eloDiff < -80) {
      return 0.05; // Almost no advantage for weak home teams vs strong away teams
    }
    
    // If home team is significantly stronger (ELO diff > 80), less need for venue boost
    if (eloDiff > 80) {
      return 0.10; // Minimal venue boost - already favored
    }
    
    // For evenly matched teams, standard home advantage
    let baseAdvantage = 0.15;
    
    // Famous stadiums get small additional bonus
    const strongHomeVenues = ["Bernabeu", "Camp Nou", "Allianz", "Anfield"];
    if (venue && strongHomeVenues.some((v) => venue.includes(v))) {
      baseAdvantage += 0.05; // Total: 0.20
    }
    
    return baseAdvantage;
  }

  /**
   * Calculate stage importance factor
   */
  calculateStageImportance(stage: string = ""): number {
    const stageImportance: Record<string, number> = {
      "Group Stage": 5,
      "Round of 16": 7,
      "Quarter-finals": 8,
      "Semi-finals": 9,
      "Final": 10,
    };

    for (const [key, value] of Object.entries(stageImportance)) {
      if (stage.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return 6; // Default importance
  }

  /**
   * Calculate rest days (simplified - in production would use match schedule)
   */
  calculateRestDays(teamName: string): number {
    // Simplified: return average rest days for UCL matches
    return 4;
  }

  /**
   * Prepare complete feature set for ML prediction
   */
  async prepareMatchFeatures(
    homeTeam: string,
    awayTeam: string,
    stage: string = "",
    venue: string = ""
  ): Promise<{
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
    // New features to reduce home bias
    elo_gap_magnitude: number;
    underdog_factor: number;
    quality_tier_home: number;
    quality_tier_away: number;
    strength_adjusted_venue: number;
  }> {
    console.log(`\n[FeatureEngineering] ========================================`);
    console.log(`[FeatureEngineering] Preparing features for: ${homeTeam} vs ${awayTeam}`);
    
    const homeElo = this.getEloRating(homeTeam);
    const awayElo = this.getEloRating(awayTeam);
    const eloDiff = homeElo - awayElo;
    console.log(`[FeatureEngineering] ELO Ratings - Home: ${homeElo}, Away: ${awayElo}`);

    // Query real form data from database
    const homeForm = await this.getTeamFormData(homeTeam);
    const awayForm = await this.getTeamFormData(awayTeam);

    console.log(`[FeatureEngineering] Home Form:`, homeForm);
    console.log(`[FeatureEngineering] Away Form:`, awayForm);

    const homeFormMetrics = this.calculateFormMetrics(homeForm);
    const awayFormMetrics = this.calculateFormMetrics(awayForm);
    const h2h = await this.calculateH2HStats(homeTeam, awayTeam);

    console.log(`[FeatureEngineering] H2H Stats:`, h2h);

    const venueAdvantage = this.calculateVenueAdvantage(homeElo, awayElo, venue);

    // Calculate new features to reduce home bias
    const eloGapMagnitude = Math.abs(eloDiff);
    const underdogFactor = awayElo > homeElo ? 1 : 0;
    
    // Quality tier: 1=elite (>1850), 2=strong (1750-1850), 3=mid (<1750)
    const getQualityTier = (elo: number): number => {
      if (elo > 1850) return 1;
      if (elo > 1750) return 2;
      return 3;
    };
    
    const qualityTierHome = getQualityTier(homeElo);
    const qualityTierAway = getQualityTier(awayElo);
    
    // Strength-adjusted venue: reduce venue advantage when ELO gap is large
    const strengthAdjustedVenue = venueAdvantage * (1 - Math.min(eloGapMagnitude / 200, 0.8));

    const features = {
      home_elo: homeElo,
      away_elo: awayElo,
      elo_diff: eloDiff,
      home_form_last5: homeFormMetrics.formPoints,
      away_form_last5: awayFormMetrics.formPoints,
      home_goals_last5: homeForm.goalsScored,
      away_goals_last5: awayForm.goalsScored,
      home_xg_last5: homeForm.xG,
      away_xg_last5: awayForm.xG,
      h2h_home_wins: h2h.homeWins,
      h2h_draws: h2h.draws,
      h2h_away_wins: h2h.awayWins,
      home_possession_avg: 52 + (homeElo - 1700) / 50,
      away_possession_avg: 48 + (awayElo - 1700) / 50,
      venue_advantage: venueAdvantage,
      stage_importance: this.calculateStageImportance(stage),
      home_rest_days: this.calculateRestDays(homeTeam),
      away_rest_days: this.calculateRestDays(awayTeam),
      // New features
      elo_gap_magnitude: eloGapMagnitude,
      underdog_factor: underdogFactor,
      quality_tier_home: qualityTierHome,
      quality_tier_away: qualityTierAway,
      strength_adjusted_venue: strengthAdjustedVenue,
    };

    console.log(`[FeatureEngineering] Generated features:`, features);
    console.log(`[FeatureEngineering] ========================================\n`);

    return features;
  }
}

export const featureEngineering = new FeatureEngineeringService();
