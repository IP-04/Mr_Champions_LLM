/**
 * Player Performance Prediction Service
 * Calculates realistic player predictions based on:
 * - Historical stats
 * - Team strength
 * - Opposition quality
 * - Position-specific metrics
 */

import { db } from "../../db";
import { players, matches } from "@shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

interface PlayerPrediction {
  expectedContribution: number; // Expected stat value (goals, assists, saves, etc.)
  statProbability: number; // Probability of achieving 1+ of that stat (0-1)
  stat90: number; // Per 90 minute average
  last5Avg: number; // Average over last 5 matches
  confidence: number; // Model confidence (0-1)
  expectedMinutes: number; // Predicted playing time
  expectedRating: number; // Match rating prediction (1-10)
}

export class PlayerPredictionService {
  /**
   * Calculate player performance prediction for a specific match
   */
  async predictPlayerPerformance(
    playerId: string,
    matchId: string,
    playerTeam: string,
    opponentTeam: string
  ): Promise<PlayerPrediction> {
    // Get player info
    const player = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player || player.length === 0) {
      throw new Error(`Player ${playerId} not found`);
    }

    const playerData = player[0];
    const position = playerData.position;
    const statType = playerData.statType;

    // Get historical performance
    const historicalStats = await this.getPlayerHistoricalStats(playerId);

    // Calculate base expectation from historical data
    const baseExpectation = this.calculateBaseExpectation(historicalStats, statType);

    // Adjust for opposition strength
    const opponentAdjustment = await this.getOpponentAdjustment(playerTeam, opponentTeam);

    // Position-specific adjustments
    const positionMultiplier = this.getPositionMultiplier(position, statType);

    // Calculate final prediction
    const expectedContribution = Math.max(
      0,
      baseExpectation * opponentAdjustment * positionMultiplier
    );

    // Calculate probability (using Poisson distribution for count stats)
    const statProbability = this.calculateProbability(expectedContribution, statType);

    // Per 90 calculation
    const stat90 = historicalStats.totalStats / (historicalStats.totalMinutes / 90);

    // Last 5 average
    const last5Avg = historicalStats.last5Avg;

    // Expected minutes based on player importance and recent usage
    const expectedMinutes = this.calculateExpectedMinutes(historicalStats);

    // Expected match rating
    const expectedRating = this.calculateExpectedRating(
      position,
      expectedContribution,
      statType
    );

    // Confidence based on sample size
    const confidence = Math.min(0.95, 0.5 + (historicalStats.matchCount * 0.05));

    return {
      expectedContribution: Math.round(expectedContribution * 100) / 100,
      statProbability: Math.min(1.0, Math.max(0.0, statProbability)), // FIXED: Cap at 1.0
      stat90: Math.round(stat90 * 100) / 100,
      last5Avg: Math.round(last5Avg * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      expectedMinutes: Math.round(expectedMinutes),
      expectedRating: Math.round(expectedRating * 10) / 10,
    };
  }

  /**
   * Get player's historical statistics
   */
  private async getPlayerHistoricalStats(playerId: string) {
    // In production, this would query actual match performance data
    // For now, we'll use the stored stats as baseline
    const playerData = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!playerData || playerData.length === 0) {
      return {
        totalStats: 0,
        totalMinutes: 90,
        matchCount: 0,
        last5Avg: 0,
      };
    }

    const player = playerData[0];

    // Use existing stats as historical baseline
    return {
      totalStats: player.last5Avg * 5, // Estimate total from last 5
      totalMinutes: player.predictedMinutes * 5, // Assume similar minutes
      matchCount: 5,
      last5Avg: player.last5Avg,
    };
  }

  /**
   * Calculate base expectation from historical average
   */
  private calculateBaseExpectation(
    historicalStats: { totalStats: number; totalMinutes: number },
    statType: string
  ): number {
    if (historicalStats.totalMinutes === 0) {
      // Default expectations by stat type
      const defaults: Record<string, number> = {
        Goals: 0.3,
        Assists: 0.25,
        "Goals + Assists": 0.5,
        Saves: 3.0,
        "Clean Sheet": 0.4,
        Tackles: 2.5,
        Interceptions: 1.5,
      };
      return defaults[statType] || 0.2;
    }

    // Return per-match average
    const matchCount = historicalStats.totalMinutes / 90;
    return historicalStats.totalStats / matchCount;
  }

  /**
   * Adjust expectation based on opponent strength
   */
  private async getOpponentAdjustment(
    playerTeam: string,
    opponentTeam: string
  ): Promise<number> {
    // Simplified team strength ratings (in production, use ELO or similar)
    const teamStrengths: Record<string, number> = {
      "Manchester City": 95,
      "Real Madrid": 94,
      "Bayern Munich": 92,
      "Liverpool": 91,
      "Barcelona": 90,
      "Paris Saint-Germain": 89,
      "Inter Milan": 88,
      "Arsenal": 87,
      "Atletico Madrid": 86,
      "Juventus": 85,
      "Borussia Dortmund": 85,
      "AC Milan": 84,
      "RB Leipzig": 83,
      "Chelsea": 81,
      "Manchester United": 82,
      "Benfica": 82,
      "Sporting CP": 80,
      "PSV Eindhoven": 78,
    };

    const playerTeamStrength = teamStrengths[playerTeam] || 80;
    const opponentStrength = teamStrengths[opponentTeam] || 80;

    // Stronger opponent = harder to score/assist, easier to defend/save
    const strengthDiff = playerTeamStrength - opponentStrength;

    // Attacking stats benefit from weaker opponents
    // Defensive stats benefit from stronger opponents
    return 1.0 + (strengthDiff * 0.01); // ±15% max adjustment
  }

  /**
   * Position-specific multipliers for different stat types
   */
  private getPositionMultiplier(position: string, statType: string): number {
    const multipliers: Record<string, Record<string, number>> = {
      FWD: {
        Goals: 1.5,
        Assists: 1.0,
        "Goals + Assists": 1.3,
        Tackles: 0.3,
        Saves: 0,
      },
      MID: {
        Goals: 0.8,
        Assists: 1.3,
        "Goals + Assists": 1.0,
        Tackles: 1.2,
        Interceptions: 1.1,
      },
      DEF: {
        Goals: 0.2,
        Assists: 0.4,
        Tackles: 1.5,
        Interceptions: 1.6,
        "Clean Sheet": 1.0,
      },
      GK: {
        Saves: 1.0,
        "Clean Sheet": 1.0,
        Goals: 0,
        Assists: 0,
      },
    };

    return multipliers[position]?.[statType] || 1.0;
  }

  /**
   * Calculate probability using appropriate distribution
   */
  private calculateProbability(expectedValue: number, statType: string): number {
    // For count stats (goals, assists, etc.) use Poisson distribution
    // P(X >= 1) = 1 - P(X = 0) = 1 - e^(-λ)
    
    if (["Goals", "Assists", "Saves", "Tackles", "Interceptions"].includes(statType)) {
      return 1 - Math.exp(-expectedValue);
    }

    // For binary outcomes (clean sheet), use direct probability
    if (statType === "Clean Sheet") {
      return Math.min(1.0, expectedValue);
    }

    // For combined stats
    if (statType === "Goals + Assists") {
      return 1 - Math.exp(-expectedValue);
    }

    // Default: linear probability capped at 100%
    return Math.min(1.0, expectedValue);
  }

  /**
   * Calculate expected playing time
   */
  private calculateExpectedMinutes(historicalStats: {
    totalMinutes: number;
    matchCount: number;
  }): number {
    if (historicalStats.matchCount === 0) {
      return 75; // Default expectation
    }

    const avgMinutes = historicalStats.totalMinutes / historicalStats.matchCount;

    // Regulars: 85-90 min, Squad players: 60-75 min, Subs: 20-45 min
    return Math.min(90, Math.max(15, avgMinutes));
  }

  /**
   * Calculate expected match rating (1-10 scale)
   */
  private calculateExpectedRating(
    position: string,
    expectedContribution: number,
    statType: string
  ): number {
    // Base rating by position
    const baseRatings: Record<string, number> = {
      FWD: 6.8,
      MID: 7.0,
      DEF: 6.9,
      GK: 6.7,
    };

    const baseRating = baseRatings[position] || 7.0;

    // Contribution bonus
    let contributionBonus = 0;
    if (statType === "Goals") {
      contributionBonus = expectedContribution * 0.8; // Each goal adds ~0.8 rating
    } else if (statType === "Assists") {
      contributionBonus = expectedContribution * 0.6;
    } else if (statType === "Goals + Assists") {
      contributionBonus = expectedContribution * 0.5;
    } else if (statType === "Saves") {
      contributionBonus = expectedContribution * 0.15;
    }

    return Math.min(10.0, Math.max(5.0, baseRating + contributionBonus));
  }
}

export const playerPredictionService = new PlayerPredictionService();
