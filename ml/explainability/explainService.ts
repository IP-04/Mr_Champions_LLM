/**
 * ML Explainability Service
 * Provides feature importance and model explanation capabilities
 * Implements SHAP-like analysis for prediction interpretability
 */

import { eq, desc, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import { modelRegistry, featureImportance, predictionHistory, playerFeatures } from "../../shared/schema.js";
import { mean, standardDeviation } from "simple-statistics";

export interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number;
  importance: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface PredictionExplanation {
  predictionId: string;
  predictedValue: number;
  confidence: number;
  modelVersion: string;
  baseValue: number; // Average prediction for this model
  featureContributions: FeatureContribution[];
  topFactors: {
    positive: FeatureContribution[];
    negative: FeatureContribution[];
  };
  explanation: string;
}

export interface ModelExplanation {
  modelName: string;
  modelType: string;
  algorithm: string;
  overallFeatureImportance: { feature: string; importance: number }[];
  performanceMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  dataInsights: {
    sampleSize: number;
    featureCount: number;
    correlations: { feature1: string; feature2: string; correlation: number }[];
  };
}

export class ExplainabilityService {

  /**
   * Generate explanation for a specific prediction
   */
  async explainPrediction(
    predictionId: string,
    features: Record<string, number>
  ): Promise<PredictionExplanation | null> {
    
    // Get prediction details
    const prediction = await this.getPredictionDetails(predictionId);
    if (!prediction) return null;

    // Get model details
    const model = await this.getModelDetails(prediction.modelVersion);
    if (!model) return null;

    // Calculate feature contributions using SHAP-like approach
    const featureContributions = await this.calculateFeatureContributions(
      features,
      model,
      prediction.predictedValue
    );

    // Get base value (average prediction for this model type)
    const baseValue = await this.calculateBaseValue(model);

    // Identify top positive and negative factors
    const sortedContributions = [...featureContributions].sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
    );

    const topFactors = {
      positive: sortedContributions
        .filter(f => f.contribution > 0)
        .slice(0, 3),
      negative: sortedContributions
        .filter(f => f.contribution < 0)
        .slice(0, 3)
    };

    // Generate human-readable explanation
    const explanation = this.generateExplanationText(
      prediction,
      topFactors,
      baseValue
    );

    return {
      predictionId,
      predictedValue: prediction.predictedValue,
      confidence: prediction.confidence,
      modelVersion: prediction.modelVersion,
      baseValue,
      featureContributions,
      topFactors,
      explanation
    };
  }

  /**
   * Calculate SHAP-like feature contributions
   */
  private async calculateFeatureContributions(
    features: Record<string, number>,
    model: any,
    predictedValue: number
  ): Promise<FeatureContribution[]> {
    
    const contributions: FeatureContribution[] = [];
    const featureImportances = await this.getModelFeatureImportance(model.id);

    for (const [featureName, featureValue] of Object.entries(features)) {
      const importance = featureImportances.find(f => f.feature === featureName)?.importance || 0;
      
      // Simplified SHAP calculation (in practice, would use actual SHAP library)
      const contribution = this.calculateShapValue(
        featureName,
        featureValue,
        importance,
        model
      );

      const impact = contribution > 0.05 ? 'positive' : 
                    contribution < -0.05 ? 'negative' : 'neutral';

      contributions.push({
        feature: featureName,
        value: featureValue,
        contribution,
        importance,
        impact
      });
    }

    return contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }

  /**
   * Simplified SHAP value calculation
   */
  private calculateShapValue(
    featureName: string,
    featureValue: number,
    importance: number,
    model: any
  ): number {
    
    // Get feature statistics for normalization
    const featureStats = this.getFeatureStatistics(featureName);
    
    // Normalize feature value
    const normalizedValue = featureStats.std > 0 ? 
      (featureValue - featureStats.mean) / featureStats.std : 0;

    // Calculate contribution based on importance and normalized value
    const contribution = importance * normalizedValue * 0.1; // Scaling factor

    return contribution;
  }

  /**
   * Get feature statistics for normalization
   */
  private getFeatureStatistics(featureName: string): { mean: number; std: number } {
    // In practice, these would be calculated from training data
    const mockStats: Record<string, { mean: number; std: number }> = {
      recent_form: { mean: 7.0, std: 0.8 },
      opponent_strength: { mean: 0.5, std: 0.2 },
      home_advantage: { mean: 0.5, std: 0.5 },
      goals_last_5: { mean: 2.0, std: 1.5 },
      xg_per_90: { mean: 0.3, std: 0.4 },
      consistency_score: { mean: 0.6, std: 0.2 },
      rest_days: { mean: 5, std: 3 },
      injury_risk: { mean: 0.3, std: 0.2 }
    };

    return mockStats[featureName] || { mean: 0, std: 1 };
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanationText(
    prediction: any,
    topFactors: { positive: FeatureContribution[]; negative: FeatureContribution[] },
    baseValue: number
  ): string {
    
    const predictionType = prediction.predictionType;
    const value = prediction.predictedValue.toFixed(2);
    
    let explanation = `The model predicts ${value} ${predictionType} for this player. `;
    
    if (topFactors.positive.length > 0) {
      const topPositive = topFactors.positive[0];
      explanation += `This is mainly driven by ${this.formatFeatureName(topPositive.feature)} `;
      explanation += `(${this.formatFeatureImpact(topPositive)}), `;
    }

    if (topFactors.negative.length > 0) {
      const topNegative = topFactors.negative[0];
      explanation += `though ${this.formatFeatureName(topNegative.feature)} `;
      explanation += `${this.formatFeatureImpact(topNegative)} works against this prediction. `;
    }

    // Add confidence interpretation
    if (prediction.confidence > 0.8) {
      explanation += "The model has high confidence in this prediction.";
    } else if (prediction.confidence > 0.6) {
      explanation += "The model has moderate confidence in this prediction.";
    } else {
      explanation += "The model has low confidence in this prediction due to limited data or conflicting signals.";
    }

    return explanation;
  }

  /**
   * Format feature names for human readability
   */
  private formatFeatureName(featureName: string): string {
    const nameMap: Record<string, string> = {
      recent_form: "recent form",
      opponent_strength: "opponent quality",
      home_advantage: "playing at home",
      goals_last_5: "recent scoring record",
      xg_per_90: "expected goals rate",
      consistency_score: "performance consistency",
      rest_days: "recovery time",
      injury_risk: "injury concerns"
    };

    return nameMap[featureName] || featureName.replace(/_/g, ' ');
  }

  /**
   * Format feature impact for explanation
   */
  private formatFeatureImpact(contribution: FeatureContribution): string {
    const absContribution = Math.abs(contribution.contribution);
    
    if (absContribution > 0.2) {
      return contribution.impact === 'positive' ? "strongly supports" : "strongly opposes";
    } else if (absContribution > 0.1) {
      return contribution.impact === 'positive' ? "supports" : "opposes";
    } else {
      return contribution.impact === 'positive' ? "slightly supports" : "slightly opposes";
    }
  }

  /**
   * Explain model behavior and performance
   */
  async explainModel(modelId: string): Promise<ModelExplanation | null> {
    const model = await this.getModelDetails(modelId);
    if (!model) return null;

    const featureImportances = await this.getModelFeatureImportance(modelId);
    const performanceMetrics = await this.calculateModelPerformance(modelId);
    const dataInsights = await this.getDataInsights(modelId);

    return {
      modelName: model.modelName,
      modelType: model.modelType,
      algorithm: model.algorithm,
      overallFeatureImportance: featureImportances,
      performanceMetrics,
      dataInsights
    };
  }

  /**
   * Calculate model performance metrics
   */
  private async calculateModelPerformance(modelId: string) {
    // In practice, would calculate from actual predictions vs. actuals
    return {
      accuracy: 0.78,
      precision: 0.75,
      recall: 0.82,
      f1Score: 0.78
    };
  }

  /**
   * Get data insights for the model
   */
  private async getDataInsights(modelId: string) {
    return {
      sampleSize: 1500,
      featureCount: 15,
      correlations: [
        { feature1: "recent_form", feature2: "consistency_score", correlation: 0.65 },
        { feature1: "goals_last_5", feature2: "xg_per_90", correlation: 0.72 },
        { feature1: "opponent_strength", feature2: "home_advantage", correlation: -0.23 }
      ]
    };
  }

  /**
   * Generate feature importance explanations for UI
   */
  async generateFeatureImportanceExplanations(
    modelId: string
  ): Promise<Array<{ feature: string; importance: number; explanation: string }>> {
    
    const featureImportances = await this.getModelFeatureImportance(modelId);
    
    return featureImportances.map(fi => ({
      feature: fi.feature,
      importance: fi.importance,
      explanation: this.explainFeatureImportance(fi.feature, fi.importance)
    }));
  }

  /**
   * Explain why a feature is important
   */
  private explainFeatureImportance(featureName: string, importance: number): string {
    const explanations: Record<string, string> = {
      recent_form: "Recent form captures a player's current momentum and confidence, making it highly predictive of near-term performance.",
      opponent_strength: "The quality of the opposition directly affects how many opportunities a player will have to score or assist.",
      home_advantage: "Playing at home typically provides a 5-10% boost in performance due to familiar conditions and crowd support.",
      goals_last_5: "Recent scoring history is the strongest indicator of a player's current finishing ability and positioning.",
      xg_per_90: "Expected goals per 90 minutes measures the quality of chances a player creates, independent of finishing luck.",
      consistency_score: "Consistent performers are more reliable for predictions, while volatile players are harder to forecast.",
      rest_days: "Fatigue significantly impacts performance, especially for high-intensity positions like midfielders.",
      injury_risk: "Players with injury concerns often have reduced playing time or suboptimal performance."
    };

    const baseExplanation = explanations[featureName] || "This feature contributes to the model's predictions.";
    
    if (importance > 0.2) {
      return `${baseExplanation} This is one of the most important factors in our model.`;
    } else if (importance > 0.1) {
      return `${baseExplanation} This factor has moderate importance in predictions.`;
    } else {
      return `${baseExplanation} This factor has minor importance in predictions.`;
    }
  }

  /**
   * Store feature importance in database for API access
   */
  async storeFeatureImportanceExplanations(
    matchId: string,
    modelId: string,
    featureContributions: FeatureContribution[]
  ): Promise<void> {
    
    for (const contribution of featureContributions) {
      await db.insert(featureImportance).values({
        id: `fi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        matchId,
        featureName: contribution.feature,
        importance: contribution.importance,
        impact: contribution.contribution, // Store contribution as impact
      });
    }
  }

  // Helper methods
  private async getPredictionDetails(predictionId: string) {
    const predictions = await db.select()
      .from(predictionHistory)
      .where(eq(predictionHistory.id, predictionId))
      .limit(1);
    
    return predictions[0] || null;
  }

  private async getModelDetails(modelVersion: string) {
    const models = await db.select()
      .from(modelRegistry)
      .where(eq(modelRegistry.version, modelVersion))
      .limit(1);
    
    return models[0] || null;
  }

  private async getModelFeatureImportance(modelId: string) {
    // Mock feature importance - would be stored during training
    return [
      { feature: 'recent_form', importance: 0.25 },
      { feature: 'opponent_strength', importance: 0.20 },
      { feature: 'home_advantage', importance: 0.15 },
      { feature: 'goals_last_5', importance: 0.12 },
      { feature: 'xg_per_90', importance: 0.10 },
      { feature: 'consistency_score', importance: 0.08 },
      { feature: 'rest_days', importance: 0.06 },
      { feature: 'injury_risk', importance: 0.04 }
    ];
  }

  private async calculateBaseValue(model: any): Promise<number> {
    // Would calculate from training data
    return 0.8; // Mock base value for goals prediction
  }
}

export const explainabilityService = new ExplainabilityService();