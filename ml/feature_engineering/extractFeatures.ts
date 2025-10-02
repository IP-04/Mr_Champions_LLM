/**
 * Feature Engineering Service
 * Transforms raw Football Data API and external sources into ML-ready features
 * Based on OpenFPL methodology with player, team, and contextual features
 */

import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { matches, players, playerFeatures, teamFeatures } from "../../shared/schema.js";
import * as math from "mathjs";
import { mean, standardDeviation, regression } from "simple-statistics";

export interface RawPlayerData {
  playerId: string;
  name: string;
  team: string;
  position: string;
  recentMatches: PlayerMatchData[];
  seasonStats: SeasonStats;
}

export interface PlayerMatchData {
  matchId: string;
  date: string;
  opponent: string;
  homeAway: 'home' | 'away';
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  interceptions: number;
  rating: number;
  xG: number;
  xA: number;
}

export interface SeasonStats {
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  averageRating: number;
}

export interface TeamMatchData {
  teamName: string;
  matchId: string;
  date: string;
  opponent: string;
  homeAway: 'home' | 'away';
  result: 'W' | 'D' | 'L';
  goalsFor: number;
  goalsAgainst: number;
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  xG: number;
  xGA: number;
}

export class FeatureEngineeringService {
  
  /**
   * Extract comprehensive player features for ML models
   */
  async extractPlayerFeatures(playerId: string, matchId: string): Promise<any> {
    const rawData = await this.getRawPlayerData(playerId);
    if (!rawData) return null;

    const match = await this.getMatchContext(matchId);
    if (!match) return null;

    const opponentTeam = match.homeTeam === rawData.team ? match.awayTeam : match.homeTeam;
    const isHome = match.homeTeam === rawData.team;

    // Form-based features
    const formFeatures = this.calculateFormFeatures(rawData.recentMatches);
    
    // Performance-based features
    const performanceFeatures = this.calculatePerformanceFeatures(rawData.recentMatches);
    
    // Context-based features
    const contextFeatures = await this.calculateContextFeatures(
      rawData.team, 
      opponentTeam, 
      isHome, 
      matchId
    );
    
    // Derived features
    const derivedFeatures = this.calculateDerivedFeatures(rawData);

    const features = {
      playerId,
      matchId,
      ...formFeatures,
      ...performanceFeatures,
      ...contextFeatures,
      ...derivedFeatures,
    };

    // Store in database
    await db.insert(playerFeatures).values(features).onConflictDoUpdate({
      target: [playerFeatures.playerId, playerFeatures.matchId],
      set: features
    });

    return features;
  }

  /**
   * Extract team-level features including tactical and performance metrics
   */
  async extractTeamFeatures(teamName: string, matchId: string): Promise<any> {
    const teamData = await this.getRawTeamData(teamName);
    if (!teamData) return null;

    const match = await this.getMatchContext(matchId);
    if (!match) return null;

    const opponentTeam = match.homeTeam === teamName ? match.awayTeam : match.homeTeam;
    const isHome = match.homeTeam === teamName;

    // Tactical metrics
    const tacticalFeatures = this.calculateTacticalFeatures(teamData);
    
    // Performance metrics
    const performanceFeatures = this.calculateTeamPerformanceFeatures(teamData);
    
    // Form metrics
    const formFeatures = this.calculateTeamFormFeatures(teamData);
    
    // Head-to-head metrics
    const h2hFeatures = await this.calculateHeadToHeadFeatures(teamName, opponentTeam);

    const features = {
      teamName,
      matchId,
      ...tacticalFeatures,
      ...performanceFeatures,
      ...formFeatures,
      ...h2hFeatures,
    };

    // Store in database
    await db.insert(teamFeatures).values(features).onConflictDoUpdate({
      target: [teamFeatures.teamName, teamFeatures.matchId],
      set: features
    });

    return features;
  }

  /**
   * Calculate form-based features from recent matches
   */
  private calculateFormFeatures(recentMatches: PlayerMatchData[]) {
    const last5Matches = recentMatches.slice(0, 5);
    
    const goalsLast5 = last5Matches.reduce((sum, match) => sum + match.goals, 0);
    const assistsLast5 = last5Matches.reduce((sum, match) => sum + match.assists, 0);
    const minutesLast5 = last5Matches.reduce((sum, match) => sum + match.minutes, 0);
    
    // Form trend using linear regression
    const matchNumbers = last5Matches.map((_, i) => i + 1);
    const ratings = last5Matches.map(match => match.rating);
    const formTrend = ratings.length > 1 ? regression.linear(
      matchNumbers.map((x, i) => [x, ratings[i]])
    ).m : 0;

    // Recent form score (weighted average with more recent matches having higher weight)
    const weights = [0.3, 0.25, 0.2, 0.15, 0.1];
    const recentForm = last5Matches.reduce((sum, match, i) => 
      sum + (match.rating * (weights[i] || 0.05)), 0
    );

    return {
      recentForm,
      goalsLast5,
      assistsLast5,
      minutesLast5,
      formTrend,
    };
  }

  /**
   * Calculate performance-based features per 90 minutes
   */
  private calculatePerformanceFeatures(recentMatches: PlayerMatchData[]) {
    const totalMinutes = recentMatches.reduce((sum, match) => sum + match.minutes, 0);
    const minutesPer90 = totalMinutes / 90;

    if (minutesPer90 === 0) {
      return {
        xgPer90: 0,
        xaPer90: 0,
        shotsPer90: 0,
        passAccuracy: 0,
      };
    }

    const totalXg = recentMatches.reduce((sum, match) => sum + match.xG, 0);
    const totalXa = recentMatches.reduce((sum, match) => sum + match.xA, 0);
    const totalShots = recentMatches.reduce((sum, match) => sum + match.shots, 0);
    const totalPasses = recentMatches.reduce((sum, match) => sum + match.passes, 0);
    const totalPassesCompleted = recentMatches.reduce((sum, match) => sum + match.passesCompleted, 0);

    return {
      xgPer90: totalXg / minutesPer90,
      xaPer90: totalXa / minutesPer90,
      shotsPer90: totalShots / minutesPer90,
      passAccuracy: totalPasses > 0 ? totalPassesCompleted / totalPasses : 0,
    };
  }

  /**
   * Calculate contextual features
   */
  private async calculateContextFeatures(
    team: string, 
    opponentTeam: string, 
    isHome: boolean, 
    matchId: string
  ) {
    // Get opponent strength (average rating of last 5 matches)
    const opponentData = await this.getRawTeamData(opponentTeam);
    const opponentStrength = opponentData ? 
      this.calculateTeamStrength(opponentData.slice(0, 5)) : 0.5;

    // Calculate rest days (simplified - would need actual match dates)
    const restDays = 7; // Default assumption

    return {
      homeAdvantage: isHome,
      opponentStrength,
      restDays,
    };
  }

  /**
   * Calculate derived features like consistency and injury risk
   */
  private calculateDerivedFeatures(rawData: RawPlayerData) {
    const ratings = rawData.recentMatches.map(match => match.rating);
    const consistencyScore = ratings.length > 1 ? 
      1 / (standardDeviation(ratings) + 0.1) : 0.5;

    // Injury risk based on minutes played trend
    const minutes = rawData.recentMatches.map(match => match.minutes);
    const avgMinutes = mean(minutes);
    const injuryRisk = avgMinutes < 45 ? 0.7 : avgMinutes < 70 ? 0.3 : 0.1;

    return {
      consistencyScore,
      injuryRisk,
    };
  }

  /**
   * Calculate tactical features for teams
   */
  private calculateTacticalFeatures(teamData: TeamMatchData[]) {
    const last5Matches = teamData.slice(0, 5);
    
    const avgPossession = mean(last5Matches.map(match => match.possession));
    
    // PPDA = Passes allowed per defensive action
    const totalPassesAllowed = last5Matches.reduce((sum, match) => 
      sum + (match.opponent ? 400 : 300), 0); // Estimated
    const totalDefensiveActions = last5Matches.reduce((sum, match) => 
      sum + match.fouls + (match.yellowCards * 2), 0);
    const ppda = totalDefensiveActions > 0 ? totalPassesAllowed / totalDefensiveActions : 15;

    const defensiveActions = totalDefensiveActions / last5Matches.length;
    const pressingIntensity = ppda < 10 ? 0.8 : ppda < 15 ? 0.5 : 0.2;

    return {
      avgPossession,
      ppda,
      defensiveActions,
      pressingIntensity,
    };
  }

  /**
   * Calculate team performance features
   */
  private calculateTeamPerformanceFeatures(teamData: TeamMatchData[]) {
    const last5Matches = teamData.slice(0, 5);
    
    const xgFor = mean(last5Matches.map(match => match.xG));
    const xgAgainst = mean(last5Matches.map(match => match.xGA));
    
    const totalShots = last5Matches.reduce((sum, match) => sum + match.shots, 0);
    const totalShotsOnTarget = last5Matches.reduce((sum, match) => sum + match.shotsOnTarget, 0);
    const totalGoals = last5Matches.reduce((sum, match) => sum + match.goalsFor, 0);
    
    const goalConversionRate = totalShotsOnTarget > 0 ? totalGoals / totalShotsOnTarget : 0;
    const savePercentage = 0.7; // Would need goalkeeper-specific data

    return {
      xgFor,
      xgAgainst,
      goalConversionRate,
      savePercentage,
    };
  }

  /**
   * Calculate team form features
   */
  private calculateTeamFormFeatures(teamData: TeamMatchData[]) {
    const last5Matches = teamData.slice(0, 5);
    
    const pointsLast5 = last5Matches.reduce((sum, match) => {
      if (match.result === 'W') return sum + 3;
      if (match.result === 'D') return sum + 1;
      return sum;
    }, 0);
    
    const goalsForLast5 = last5Matches.reduce((sum, match) => sum + match.goalsFor, 0);
    const goalsAgainstLast5 = last5Matches.reduce((sum, match) => sum + match.goalsAgainst, 0);

    return {
      pointsLast5,
      goalsForLast5,
      goalsAgainstLast5,
    };
  }

  /**
   * Calculate head-to-head features
   */
  private async calculateHeadToHeadFeatures(team1: string, team2: string) {
    // This would query historical match data
    // For now, returning mock data
    return {
      h2hWins: 2,
      h2hDraws: 1,
      h2hLosses: 1,
    };
  }

  /**
   * Calculate team strength metric
   */
  private calculateTeamStrength(matches: TeamMatchData[]): number {
    const results = matches.map(match => {
      if (match.result === 'W') return 1;
      if (match.result === 'D') return 0.5;
      return 0;
    });
    
    return mean(results);
  }

  /**
   * Get raw player data (would integrate with external APIs)
   */
  private async getRawPlayerData(playerId: string): Promise<RawPlayerData | null> {
    // This would fetch from Football Data API, StatsBomb, etc.
    // For now, returning mock data structure
    return {
      playerId,
      name: "Mock Player",
      team: "Mock Team",
      position: "MID",
      recentMatches: [
        {
          matchId: "match-1",
          date: "2025-03-01",
          opponent: "Opponent",
          homeAway: "home",
          minutes: 90,
          goals: 1,
          assists: 0,
          shots: 3,
          shotsOnTarget: 2,
          passes: 45,
          passesCompleted: 40,
          tackles: 2,
          interceptions: 1,
          rating: 7.5,
          xG: 0.8,
          xA: 0.2,
        }
        // ... more matches
      ],
      seasonStats: {
        appearances: 25,
        goals: 8,
        assists: 5,
        yellowCards: 3,
        redCards: 0,
        averageRating: 7.2,
      }
    };
  }

  /**
   * Get raw team data
   */
  private async getRawTeamData(teamName: string): Promise<TeamMatchData[] | null> {
    // Mock team data - would fetch from APIs
    return [
      {
        teamName,
        matchId: "match-1",
        date: "2025-03-01",
        opponent: "Opponent",
        homeAway: "home",
        result: "W",
        goalsFor: 2,
        goalsAgainst: 1,
        possession: 60,
        shots: 15,
        shotsOnTarget: 8,
        corners: 6,
        fouls: 12,
        yellowCards: 2,
        redCards: 0,
        xG: 1.8,
        xGA: 0.9,
      }
      // ... more matches
    ];
  }

  /**
   * Get match context
   */
  private async getMatchContext(matchId: string) {
    const match = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    return match[0] || null;
  }
}

export const featureEngineeringService = new FeatureEngineeringService();