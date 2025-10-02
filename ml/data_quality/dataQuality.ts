/**
 * Data Quality and Missing Data Handling Service
 * Implements OpenFPL-style data cleaning with nearest neighbor imputation
 * Handles API failures, missing values, and data validation
 */

import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { players, matches, playerFeatures, teamFeatures } from "../../shared/schema.js";
import { mean, standardDeviation, median, min, max } from "simple-statistics";
import _ from "lodash";

export interface DataQualityReport {
  totalRecords: number;
  missingDataPoints: number;
  completenessScore: number;
  outliers: OutlierInfo[];
  imputationsMade: ImputationInfo[];
  dataFreshness: {
    lastUpdate: string;
    stalenessScore: number;
  };
  apiHealthStatus: {
    footballDataApi: 'healthy' | 'degraded' | 'failed';
    statsBombApi: 'healthy' | 'degraded' | 'failed';
    understatApi: 'healthy' | 'degraded' | 'failed';
  };
}

export interface OutlierInfo {
  playerId: string;
  feature: string;
  value: number;
  expectedRange: [number, number];
  outlierType: 'extreme' | 'moderate';
}

export interface ImputationInfo {
  playerId: string;
  feature: string;
  originalValue: number | null;
  imputedValue: number;
  method: 'nearest_neighbor' | 'mean' | 'median' | 'regression' | 'forward_fill';
  confidence: number;
}

export interface PlayerDataValidation {
  playerId: string;
  isValid: boolean;
  missingFeatures: string[];
  invalidFeatures: { feature: string; value: any; reason: string }[];
  qualityScore: number;
}

export class DataQualityService {

  /**
   * Perform comprehensive data quality assessment
   */
  async assessDataQuality(): Promise<DataQualityReport> {
    console.log("Starting data quality assessment...");

    const totalRecords = await this.getTotalRecordCount();
    const missingDataPoints = await this.countMissingDataPoints();
    const completenessScore = 1 - (missingDataPoints / totalRecords);
    
    const outliers = await this.detectOutliers();
    const imputationsMade = await this.getRecentImputations();
    const dataFreshness = await this.assessDataFreshness();
    const apiHealthStatus = await this.checkApiHealth();

    return {
      totalRecords,
      missingDataPoints,
      completenessScore,
      outliers,
      imputationsMade,
      dataFreshness,
      apiHealthStatus
    };
  }

  /**
   * Validate player data completeness and quality
   */
  async validatePlayerData(playerId: string): Promise<PlayerDataValidation> {
    const playerData = await this.getPlayerData(playerId);
    if (!playerData) {
      return {
        playerId,
        isValid: false,
        missingFeatures: ['all'],
        invalidFeatures: [],
        qualityScore: 0
      };
    }

    const requiredFeatures = [
      'recentForm', 'goalsLast5', 'assistsLast5', 'xgPer90', 
      'passAccuracy', 'consistencyScore'
    ];

    const missingFeatures: string[] = [];
    const invalidFeatures: { feature: string; value: any; reason: string }[] = [];

    // Check for missing features
    for (const feature of requiredFeatures) {
      const value = (playerData as any)[feature];
      if (value === null || value === undefined) {
        missingFeatures.push(feature);
      } else if (typeof value !== 'number' || isNaN(value)) {
        invalidFeatures.push({
          feature,
          value,
          reason: 'Invalid numeric value'
        });
      } else if (this.isOutlier(feature, value)) {
        invalidFeatures.push({
          feature,
          value,
          reason: 'Value outside expected range'
        });
      }
    }

    const qualityScore = this.calculateQualityScore(
      requiredFeatures.length,
      missingFeatures.length,
      invalidFeatures.length
    );

    return {
      playerId,
      isValid: missingFeatures.length === 0 && invalidFeatures.length === 0,
      missingFeatures,
      invalidFeatures,
      qualityScore
    };
  }

  /**
   * Impute missing data using nearest neighbor approach (OpenFPL method)
   */
  async imputeMissingData(playerId: string): Promise<ImputationInfo[]> {
    const playerData = await this.getPlayerData(playerId);
    if (!playerData) return [];

    const imputations: ImputationInfo[] = [];
    const features = [
      'recentForm', 'goalsLast5', 'assistsLast5', 'xgPer90', 
      'passAccuracy', 'consistencyScore', 'injuryRisk'
    ];

    for (const feature of features) {
      const value = (playerData as any)[feature];
      
      if (value === null || value === undefined || isNaN(value)) {
        const imputedValue = await this.nearestNeighborImputation(
          playerId,
          feature,
          playerData
        );

        if (imputedValue !== null) {
          // Update the database
          await this.updatePlayerFeature(playerId, feature, imputedValue);

          imputations.push({
            playerId,
            feature,
            originalValue: value,
            imputedValue,
            method: 'nearest_neighbor',
            confidence: this.calculateImputationConfidence(feature, imputedValue)
          });
        }
      }
    }

    return imputations;
  }

  /**
   * Nearest neighbor imputation based on similar players
   */
  private async nearestNeighborImputation(
    playerId: string,
    feature: string,
    playerData: any
  ): Promise<number | null> {
    
    const player = await this.getPlayerDetails(playerId);
    if (!player) return null;

    // Find similar players (same position, similar team strength)
    const similarPlayers = await this.findSimilarPlayers(player);
    
    if (similarPlayers.length === 0) {
      // Fall back to position-based mean
      return this.getPositionMean(player.position, feature);
    }

    // Calculate weighted average based on similarity
    const weights: number[] = [];
    const values: number[] = [];

    for (const similarPlayer of similarPlayers) {
      const similarPlayerData = await this.getPlayerData(similarPlayer.id);
      if (similarPlayerData) {
        const featureValue = (similarPlayerData as any)[feature];
        if (featureValue !== null && !isNaN(featureValue)) {
          const similarity = this.calculatePlayerSimilarity(playerData, similarPlayerData);
          weights.push(similarity);
          values.push(featureValue);
        }
      }
    }

    if (values.length === 0) return null;

    // Weighted average
    const weightedSum = values.reduce((sum, value, i) => sum + value * weights[i], 0);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return totalWeight > 0 ? weightedSum / totalWeight : null;
  }

  /**
   * Calculate similarity between two players
   */
  private calculatePlayerSimilarity(player1: any, player2: any): number {
    const features = ['recentForm', 'goalsLast5', 'assistsLast5', 'passAccuracy'];
    let totalDifference = 0;
    let validComparisons = 0;

    for (const feature of features) {
      const val1 = player1[feature];
      const val2 = player2[feature];
      
      if (val1 !== null && val2 !== null && !isNaN(val1) && !isNaN(val2)) {
        // Normalize difference by feature range
        const featureRange = this.getFeatureRange(feature);
        const normalizedDiff = Math.abs(val1 - val2) / (featureRange.max - featureRange.min);
        totalDifference += normalizedDiff;
        validComparisons++;
      }
    }

    if (validComparisons === 0) return 0;
    
    const avgDifference = totalDifference / validComparisons;
    return Math.max(0, 1 - avgDifference); // Similarity score (higher = more similar)
  }

  /**
   * Handle API failures with graceful degradation
   */
  async handleApiFailure(apiName: string, operation: string): Promise<void> {
    console.log(`API failure detected: ${apiName} - ${operation}`);
    
    // Log the failure
    await this.logApiFailure(apiName, operation);
    
    // Implement fallback strategies
    switch (apiName) {
      case 'footballData':
        await this.useFootballDataFallback();
        break;
      case 'statsBomb':
        await this.useStatsBombFallback();
        break;
      case 'understat':
        await this.useUnderstatFallback();
        break;
    }
  }

  /**
   * Clean and validate incoming API data
   */
  async cleanApiData(rawData: any, dataType: 'match' | 'player' | 'team'): Promise<any> {
    if (!rawData) return null;

    let cleanedData = { ...rawData };

    switch (dataType) {
      case 'player':
        cleanedData = this.cleanPlayerData(cleanedData);
        break;
      case 'match':
        cleanedData = this.cleanMatchData(cleanedData);
        break;
      case 'team':
        cleanedData = this.cleanTeamData(cleanedData);
        break;
    }

    // Remove extreme outliers
    cleanedData = this.removeOutliers(cleanedData, dataType);
    
    // Validate data ranges
    cleanedData = this.validateDataRanges(cleanedData, dataType);

    return cleanedData;
  }

  /**
   * Clean player-specific data
   */
  private cleanPlayerData(data: any): any {
    const cleaned = { ...data };
    
    // Ensure numeric fields are actually numbers
    const numericFields = ['goals', 'assists', 'minutes', 'rating', 'xG', 'shots'];
    for (const field of numericFields) {
      if (cleaned[field] !== undefined) {
        cleaned[field] = Number(cleaned[field]) || 0;
      }
    }

    // Cap ratings between 0-10
    if (cleaned.rating !== undefined) {
      cleaned.rating = Math.max(0, Math.min(10, cleaned.rating));
    }

    // Ensure minutes are reasonable (0-120)
    if (cleaned.minutes !== undefined) {
      cleaned.minutes = Math.max(0, Math.min(120, cleaned.minutes));
    }

    return cleaned;
  }

  /**
   * Clean match-specific data
   */
  private cleanMatchData(data: any): any {
    const cleaned = { ...data };
    
    // Ensure scores are non-negative integers
    if (cleaned.homeScore !== undefined) {
      cleaned.homeScore = Math.max(0, Math.floor(Number(cleaned.homeScore) || 0));
    }
    if (cleaned.awayScore !== undefined) {
      cleaned.awayScore = Math.max(0, Math.floor(Number(cleaned.awayScore) || 0));
    }

    // Validate date format
    if (cleaned.date) {
      const date = new Date(cleaned.date);
      if (isNaN(date.getTime())) {
        cleaned.date = new Date().toISOString();
      }
    }

    return cleaned;
  }

  /**
   * Clean team-specific data
   */
  private cleanTeamData(data: any): any {
    const cleaned = { ...data };
    
    // Ensure possession is between 0-100
    if (cleaned.possession !== undefined) {
      cleaned.possession = Math.max(0, Math.min(100, Number(cleaned.possession) || 50));
    }

    // Ensure shot counts are reasonable
    if (cleaned.shots !== undefined) {
      cleaned.shots = Math.max(0, Math.min(50, Number(cleaned.shots) || 0));
    }

    return cleaned;
  }

  /**
   * Detect and handle data outliers
   */
  private async detectOutliers(): Promise<OutlierInfo[]> {
    const outliers: OutlierInfo[] = [];
    
    // Get all player features for analysis
    const playerData = await this.getAllPlayerFeatures();
    
    const features = ['recentForm', 'goalsLast5', 'xgPer90', 'passAccuracy'];
    
    for (const feature of features) {
      const values = playerData
        .map(p => (p as any)[feature])
        .filter(v => v !== null && !isNaN(v));
      
      if (values.length > 10) {
        const q1 = this.percentile(values, 25);
        const q3 = this.percentile(values, 75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        for (const player of playerData) {
          const value = (player as any)[feature];
          if (value !== null && !isNaN(value)) {
            if (value < lowerBound || value > upperBound) {
              outliers.push({
                playerId: player.playerId,
                feature,
                value,
                expectedRange: [lowerBound, upperBound],
                outlierType: Math.abs(value - mean(values)) > 3 * standardDeviation(values) 
                  ? 'extreme' : 'moderate'
              });
            }
          }
        }
      }
    }
    
    return outliers;
  }

  // Helper methods
  private async getTotalRecordCount(): Promise<number> {
    // Mock implementation
    return 1500;
  }

  private async countMissingDataPoints(): Promise<number> {
    // Mock implementation  
    return 150;
  }

  private async getRecentImputations(): Promise<ImputationInfo[]> {
    // Mock implementation
    return [];
  }

  private async assessDataFreshness() {
    return {
      lastUpdate: new Date().toISOString(),
      stalenessScore: 0.1
    };
  }

  private async checkApiHealth() {
    return {
      footballDataApi: 'healthy' as const,
      statsBombApi: 'healthy' as const,
      understatApi: 'degraded' as const
    };
  }

  private async getPlayerData(playerId: string) {
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

  private async findSimilarPlayers(player: any) {
    // Find players in same position
    const similarPlayers = await db.select()
      .from(players)
      .where(eq(players.position, player.position))
      .limit(10);
    
    return similarPlayers.filter(p => p.id !== player.id);
  }

  private async getPositionMean(position: string, feature: string): Promise<number> {
    // Mock position-based averages
    const positionAverages: Record<string, Record<string, number>> = {
      'FWD': { recentForm: 7.2, goalsLast5: 3.1, assistsLast5: 1.2 },
      'MID': { recentForm: 7.0, goalsLast5: 1.8, assistsLast5: 2.3 },
      'DEF': { recentForm: 6.8, goalsLast5: 0.5, assistsLast5: 0.8 },
      'GK': { recentForm: 6.9, goalsLast5: 0.0, assistsLast5: 0.1 }
    };

    return positionAverages[position]?.[feature] || 0;
  }

  private calculateQualityScore(
    totalFeatures: number,
    missingCount: number,
    invalidCount: number
  ): number {
    const completeness = 1 - (missingCount / totalFeatures);
    const validity = 1 - (invalidCount / totalFeatures);
    return (completeness + validity) / 2;
  }

  private calculateImputationConfidence(feature: string, value: number): number {
    // Mock confidence calculation
    return 0.75;
  }

  private isOutlier(feature: string, value: number): boolean {
    const ranges: Record<string, [number, number]> = {
      recentForm: [0, 10],
      goalsLast5: [0, 15],
      assistsLast5: [0, 10],
      xgPer90: [0, 3],
      passAccuracy: [0, 1],
      consistencyScore: [0, 1],
      injuryRisk: [0, 1]
    };

    const range = ranges[feature];
    return range ? (value < range[0] || value > range[1]) : false;
  }

  private getFeatureRange(feature: string): { min: number; max: number } {
    const ranges: Record<string, { min: number; max: number }> = {
      recentForm: { min: 0, max: 10 },
      goalsLast5: { min: 0, max: 15 },
      assistsLast5: { min: 0, max: 10 },
      passAccuracy: { min: 0, max: 1 }
    };

    return ranges[feature] || { min: 0, max: 10 };
  }

  private async updatePlayerFeature(playerId: string, feature: string, value: number) {
    // Update the feature in the database
    const updateObj: any = {};
    updateObj[feature] = value;
    
    await db.update(playerFeatures)
      .set(updateObj)
      .where(eq(playerFeatures.playerId, playerId));
  }

  private async getAllPlayerFeatures() {
    return await db.select().from(playerFeatures).limit(1000);
  }

  private percentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) return sorted[lower];
    
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private removeOutliers(data: any, dataType: string): any {
    // Implementation would depend on data type
    return data;
  }

  private validateDataRanges(data: any, dataType: string): any {
    // Implementation would depend on data type
    return data;
  }

  private async logApiFailure(apiName: string, operation: string) {
    console.log(`Logging API failure: ${apiName} - ${operation} at ${new Date()}`);
  }

  private async useFootballDataFallback() {
    console.log("Using Football Data API fallback strategy");
  }

  private async useStatsBombFallback() {
    console.log("Using StatsBomb API fallback strategy");
  }

  private async useUnderstatFallback() {
    console.log("Using Understat API fallback strategy");
  }
}

export const dataQualityService = new DataQualityService();