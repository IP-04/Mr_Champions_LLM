/**
 * Multi-Horizon Forecasting Service
 * Implements different prediction horizons for UCL tournament progression
 * Handles group stage → knockout stage transition dynamics
 */

import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { players, matches, playerFeatures, predictionHistory } from "../../shared/schema.js";
import { featureEngineeringService } from "../feature_engineering/extractFeatures.js";
import { mean, standardDeviation } from "simple-statistics";
import _ from "lodash";

export type PredictionHorizon = '1_gameweek' | '2_gameweek' | '3_gameweek';
export type TournamentPhase = 'group_stage' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'final';

export interface MultiHorizonPrediction {
  playerId: string;
  predictions: {
    [K in PredictionHorizon]: HorizonPrediction;
  };
  confidence: {
    [K in PredictionHorizon]: number;
  };
  uncertaintyFactors: UncertaintyFactor[];
  tournamentContext: TournamentContext;
}

export interface HorizonPrediction {
  expectedPoints: number;
  goalProbability: number;
  assistProbability: number;
  cleanSheetProbability?: number; // For defenders/GK
  minutesProbability: number;
  captainSuitability: number;
  variance: number; // Prediction uncertainty
  influencingFactors: string[];
}

export interface UncertaintyFactor {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  adjustment: number; // Multiplier for prediction confidence
}

export interface TournamentContext {
  currentPhase: TournamentPhase;
  nextPhase?: TournamentPhase;
  groupStanding?: number;
  qualificationProbability?: number;
  pressureLevel: 'low' | 'medium' | 'high' | 'extreme';
  rotationRisk: number; // 0-1 scale
  fixtureStrength: number; // 0-10 scale
}

export interface SeasonalityPattern {
  phase: TournamentPhase;
  playerModifiers: {
    [position: string]: {
      performance: number;
      variance: number;
      rotation: number;
    };
  };
}

export class MultiHorizonForecastService {

  /**
   * Generate predictions across multiple horizons for a player
   */
  async generateMultiHorizonPrediction(
    playerId: string,
    currentGameweek: number
  ): Promise<MultiHorizonPrediction> {
    
    console.log(`Generating multi-horizon predictions for player ${playerId}`);

    const tournamentContext = await this.getTournamentContext(currentGameweek);
    const uncertaintyFactors = await this.calculateUncertaintyFactors(playerId, tournamentContext);
    
    const predictions = {
      '1_gameweek': await this.generateHorizonPrediction(playerId, 1, tournamentContext),
      '2_gameweek': await this.generateHorizonPrediction(playerId, 2, tournamentContext),
      '3_gameweek': await this.generateHorizonPrediction(playerId, 3, tournamentContext)
    } as const;

    const confidence = {
      '1_gameweek': this.calculateHorizonConfidence(1, uncertaintyFactors),
      '2_gameweek': this.calculateHorizonConfidence(2, uncertaintyFactors),
      '3_gameweek': this.calculateHorizonConfidence(3, uncertaintyFactors)
    } as const;

    return {
      playerId,
      predictions,
      confidence,
      uncertaintyFactors,
      tournamentContext
    };
  }

  /**
   * Generate prediction for specific horizon
   */
  private async generateHorizonPrediction(
    playerId: string,
    horizon: number,
    context: TournamentContext
  ): Promise<HorizonPrediction> {
    
    const playerFeatures = await this.getPlayerFeatures(playerId);
    const seasonality = this.getSeasonalityPatterns();
    const phaseModifier = seasonality[context.currentPhase] || seasonality.group_stage;
    
    const player = await this.getPlayerDetails(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const positionModifier = phaseModifier.playerModifiers[player.position] || 
                            phaseModifier.playerModifiers['MID'];

    // Base predictions from recent form
    const basePrediction = this.calculateBasePrediction(playerFeatures, player.position);
    
    // Apply horizon decay
    const horizonDecay = this.getHorizonDecay(horizon);
    
    // Apply tournament phase effects
    const phaseEffect = this.getPhaseEffect(context.currentPhase, player.position);
    
    // Apply rotation risk
    const rotationAdjustment = 1 - (context.rotationRisk * positionModifier.rotation);
    
    // Calculate final predictions
    const expectedPoints = basePrediction.points * 
                          horizonDecay * 
                          phaseEffect * 
                          rotationAdjustment * 
                          positionModifier.performance;

    const goalProbability = this.calculateEventProbability(
      basePrediction.goalProbability,
      horizon,
      context,
      'goal'
    );

    const assistProbability = this.calculateEventProbability(
      basePrediction.assistProbability,
      horizon,
      context,
      'assist'
    );

    const minutesProbability = this.calculateMinutesProbability(
      playerFeatures,
      context,
      horizon
    );

    const captainSuitability = this.calculateCaptainSuitability(
      expectedPoints,
      basePrediction.variance * positionModifier.variance,
      context
    );

    const variance = basePrediction.variance * 
                    positionModifier.variance * 
                    this.getHorizonVarianceMultiplier(horizon);

    const influencingFactors = this.getInfluencingFactors(
      context,
      player.position,
      horizon
    );

    return {
      expectedPoints,
      goalProbability,
      assistProbability,
      minutesProbability,
      captainSuitability,
      variance,
      influencingFactors,
      ...(player.position === 'GK' || player.position === 'DEF' ? {
        cleanSheetProbability: this.calculateCleanSheetProbability(
          playerFeatures,
          context,
          horizon
        )
      } : {})
    };
  }

  /**
   * Calculate base prediction from player features
   */
  private calculateBasePrediction(playerFeatures: any, position: string) {
    if (!playerFeatures) {
      return {
        points: 4,
        goalProbability: 0.1,
        assistProbability: 0.1,
        variance: 2
      };
    }

    const recentForm = playerFeatures.recentForm || 6;
    const goalsLast5 = playerFeatures.goalsLast5 || 0;
    const assistsLast5 = playerFeatures.assistsLast5 || 0;
    const xgPer90 = playerFeatures.xgPer90 || 0.1;

    // Position-specific base expectations
    const positionBase = {
      'GK': { points: 4, goalMult: 0.02, assistMult: 0.05 },
      'DEF': { points: 4.5, goalMult: 0.08, assistMult: 0.12 },
      'MID': { points: 5, goalMult: 0.15, assistMult: 0.20 },
      'FWD': { points: 5.5, goalMult: 0.25, assistMult: 0.15 }
    }[position] || { points: 5, goalMult: 0.15, assistMult: 0.15 };

    const points = positionBase.points + (recentForm - 6) * 0.5;
    const goalProbability = Math.min(0.8, xgPer90 * positionBase.goalMult + (goalsLast5 / 5) * 0.3);
    const assistProbability = Math.min(0.6, (assistsLast5 / 5) * positionBase.assistMult + 0.1);
    const variance = 2 + (10 - recentForm) * 0.2; // Higher variance for inconsistent players

    return {
      points,
      goalProbability,
      assistProbability,
      variance
    };
  }

  /**
   * Calculate event probability for specific horizon
   */
  private calculateEventProbability(
    baseProbability: number,
    horizon: number,
    context: TournamentContext,
    eventType: 'goal' | 'assist'
  ): number {
    
    // Horizon effect (longer horizons = more uncertainty, different patterns)
    const horizonMultiplier = horizon === 1 ? 1.0 : 
                             horizon === 2 ? 0.95 : 0.9;

    // Tournament pressure effects
    const pressureMultiplier = {
      'low': 1.0,
      'medium': 1.05,
      'high': 1.1,
      'extreme': eventType === 'goal' ? 1.15 : 0.95 // Goals up, assists down under extreme pressure
    }[context.pressureLevel];

    // Phase-specific effects
    const phaseMultiplier = {
      'group_stage': 1.0,
      'round_of_16': 0.95,
      'quarter_final': 0.9,
      'semi_final': 0.85,
      'final': 0.8
    }[context.currentPhase] || 1.0;

    return Math.min(0.95, baseProbability * horizonMultiplier * pressureMultiplier * phaseMultiplier);
  }

  /**
   * Calculate minutes probability (rotation risk consideration)
   */
  private calculateMinutesProbability(
    playerFeatures: any,
    context: TournamentContext,
    horizon: number
  ): number {
    
    const baseMinutesProb = 0.85; // Assume most players start
    
    // Rotation increases with horizon
    const rotationRisk = context.rotationRisk * (horizon / 2);
    
    // Injury risk
    const injuryRisk = playerFeatures?.injuryRisk || 0.1;
    
    // Tournament phase rotation patterns
    const phaseRotation = {
      'group_stage': 0.1,
      'round_of_16': 0.05,
      'quarter_final': 0.03,
      'semi_final': 0.02,
      'final': 0.01
    }[context.currentPhase] || 0.1;

    return Math.max(0.3, baseMinutesProb - rotationRisk - injuryRisk - phaseRotation);
  }

  /**
   * Calculate captain suitability based on expected points and variance
   */
  private calculateCaptainSuitability(
    expectedPoints: number,
    variance: number,
    context: TournamentContext
  ): number {
    
    // High points good, low variance good
    const pointsScore = Math.min(10, expectedPoints) / 10;
    const consistencyScore = Math.max(0, (5 - variance) / 5);
    
    // Tournament context
    const contextBonus = context.pressureLevel === 'high' ? 0.1 : 
                        context.pressureLevel === 'extreme' ? -0.1 : 0;

    return Math.max(0, Math.min(1, (pointsScore + consistencyScore) / 2 + contextBonus));
  }

  /**
   * Calculate clean sheet probability for defenders/goalkeepers
   */
  private calculateCleanSheetProbability(
    playerFeatures: any,
    context: TournamentContext,
    horizon: number
  ): number {
    
    const teamDefensiveStrength = playerFeatures?.teamDefensiveStrength || 0.5;
    const fixtureStrength = context.fixtureStrength / 10;
    
    // Base clean sheet probability
    let cleanSheetProb = teamDefensiveStrength * (1 - fixtureStrength * 0.6);
    
    // Tournament phase effect (teams more defensive in knockouts)
    const phaseBonus = {
      'group_stage': 0,
      'round_of_16': 0.05,
      'quarter_final': 0.08,
      'semi_final': 0.1,
      'final': 0.12
    }[context.currentPhase] || 0;

    cleanSheetProb += phaseBonus;
    
    // Horizon decay
    cleanSheetProb *= (1 - (horizon - 1) * 0.05);

    return Math.max(0.1, Math.min(0.8, cleanSheetProb));
  }

  /**
   * Calculate uncertainty factors affecting predictions
   */
  private async calculateUncertaintyFactors(
    playerId: string,
    context: TournamentContext
  ): Promise<UncertaintyFactor[]> {
    
    const factors: UncertaintyFactor[] = [];
    
    // Tournament phase uncertainty
    if (context.currentPhase !== 'group_stage') {
      factors.push({
        factor: 'knockout_pressure',
        impact: 'high',
        description: 'Knockout stage adds performance pressure and tactical changes',
        adjustment: 0.85
      });
    }

    // Qualification pressure
    if (context.qualificationProbability && context.qualificationProbability < 0.7) {
      factors.push({
        factor: 'qualification_pressure',
        impact: 'medium',
        description: 'Team under pressure to qualify from group',
        adjustment: 0.9
      });
    }

    // Rotation risk
    if (context.rotationRisk > 0.3) {
      factors.push({
        factor: 'rotation_risk',
        impact: 'medium',
        description: 'High rotation risk due to squad depth and fixture congestion',
        adjustment: 0.85
      });
    }

    // Fixture difficulty
    if (context.fixtureStrength > 7) {
      factors.push({
        factor: 'difficult_fixture',
        impact: 'high',
        description: 'Facing strong opposition affects scoring opportunities',
        adjustment: 0.8
      });
    }

    return factors;
  }

  /**
   * Calculate confidence for specific horizon
   */
  private calculateHorizonConfidence(
    horizon: number,
    uncertaintyFactors: UncertaintyFactor[]
  ): number {
    
    // Base confidence decreases with horizon
    let confidence = 1 - (horizon - 1) * 0.15;
    
    // Apply uncertainty adjustments
    for (const factor of uncertaintyFactors) {
      confidence *= factor.adjustment;
    }

    return Math.max(0.3, Math.min(1, confidence));
  }

  /**
   * Get tournament context for current gameweek
   */
  private async getTournamentContext(gameweek: number): Promise<TournamentContext> {
    // Mock tournament progression logic
    const currentPhase: TournamentPhase = gameweek <= 6 ? 'group_stage' :
                                         gameweek <= 8 ? 'round_of_16' :
                                         gameweek <= 10 ? 'quarter_final' :
                                         gameweek <= 12 ? 'semi_final' : 'final';

    const phaseTransitions: Record<TournamentPhase, TournamentPhase | undefined> = {
      'group_stage': 'round_of_16',
      'round_of_16': 'quarter_final',
      'quarter_final': 'semi_final',
      'semi_final': 'final',
      'final': undefined
    };
    const nextPhase = phaseTransitions[currentPhase];

    return {
      currentPhase,
      nextPhase,
      groupStanding: Math.floor(Math.random() * 4) + 1,
      qualificationProbability: Math.random() * 0.4 + 0.6,
      pressureLevel: currentPhase === 'group_stage' ? 'medium' : 'high',
      rotationRisk: currentPhase === 'group_stage' ? 0.3 : 0.15,
      fixtureStrength: Math.random() * 4 + 6
    };
  }

  // Helper methods and constants
  private getHorizonDecay(horizon: number): number {
    return {
      1: 1.0,
      2: 0.95,
      3: 0.9
    }[horizon] || 0.85;
  }

  private getPhaseEffect(phase: TournamentPhase, position: string): number {
    const effects: Record<TournamentPhase, Record<string, number>> = {
      'group_stage': { 'GK': 1.0, 'DEF': 1.0, 'MID': 1.0, 'FWD': 1.0 },
      'round_of_16': { 'GK': 1.05, 'DEF': 1.1, 'MID': 0.95, 'FWD': 0.9 },
      'quarter_final': { 'GK': 1.1, 'DEF': 1.15, 'MID': 0.9, 'FWD': 0.85 },
      'semi_final': { 'GK': 1.15, 'DEF': 1.2, 'MID': 0.85, 'FWD': 0.8 },
      'final': { 'GK': 1.2, 'DEF': 1.25, 'MID': 0.8, 'FWD': 0.75 }
    };

    return effects[phase]?.[position] || 1.0;
  }

  private getHorizonVarianceMultiplier(horizon: number): number {
    return 1 + (horizon - 1) * 0.2;
  }

  private getInfluencingFactors(
    context: TournamentContext,
    position: string,
    horizon: number
  ): string[] {
    const factors: string[] = [];
    
    if (horizon > 1) factors.push('Extended horizon uncertainty');
    if (context.pressureLevel === 'high') factors.push('High tournament pressure');
    if (context.rotationRisk > 0.3) factors.push('Squad rotation risk');
    if (context.currentPhase !== 'group_stage') factors.push('Knockout stage dynamics');
    
    return factors;
  }

  private getSeasonalityPatterns(): Record<TournamentPhase, SeasonalityPattern> {
    return {
      'group_stage': {
        phase: 'group_stage',
        playerModifiers: {
          'GK': { performance: 1.0, variance: 1.0, rotation: 0.2 },
          'DEF': { performance: 1.0, variance: 1.0, rotation: 0.25 },
          'MID': { performance: 1.0, variance: 1.0, rotation: 0.3 },
          'FWD': { performance: 1.0, variance: 1.0, rotation: 0.35 }
        }
      },
      'round_of_16': {
        phase: 'round_of_16',
        playerModifiers: {
          'GK': { performance: 1.05, variance: 0.9, rotation: 0.1 },
          'DEF': { performance: 1.1, variance: 0.85, rotation: 0.15 },
          'MID': { performance: 0.95, variance: 1.1, rotation: 0.2 },
          'FWD': { performance: 0.9, variance: 1.15, rotation: 0.25 }
        }
      },
      'quarter_final': {
        phase: 'quarter_final',
        playerModifiers: {
          'GK': { performance: 1.1, variance: 0.8, rotation: 0.05 },
          'DEF': { performance: 1.15, variance: 0.8, rotation: 0.1 },
          'MID': { performance: 0.9, variance: 1.2, rotation: 0.15 },
          'FWD': { performance: 0.85, variance: 1.25, rotation: 0.2 }
        }
      },
      'semi_final': {
        phase: 'semi_final',
        playerModifiers: {
          'GK': { performance: 1.15, variance: 0.75, rotation: 0.02 },
          'DEF': { performance: 1.2, variance: 0.75, rotation: 0.05 },
          'MID': { performance: 0.85, variance: 1.3, rotation: 0.1 },
          'FWD': { performance: 0.8, variance: 1.35, rotation: 0.15 }
        }
      },
      'final': {
        phase: 'final',
        playerModifiers: {
          'GK': { performance: 1.2, variance: 0.7, rotation: 0.0 },
          'DEF': { performance: 1.25, variance: 0.7, rotation: 0.02 },
          'MID': { performance: 0.8, variance: 1.4, rotation: 0.05 },
          'FWD': { performance: 0.75, variance: 1.5, rotation: 0.1 }
        }
      }
    };
  }

  private async getPlayerFeatures(playerId: string) {
    const features = await db.select()
      .from(playerFeatures)
      .where(eq(playerFeatures.playerId, playerId))
      .limit(1);
    
    return features[0] || null;
  }

  private async getPlayerDetails(playerId: string) {
    const playerList = await db.select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    
    return playerList[0] || null;
  }
}

export const multiHorizonForecastService = new MultiHorizonForecastService();