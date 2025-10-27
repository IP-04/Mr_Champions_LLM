import axios, { AxiosInstance } from 'axios';

export interface MatchFeatures {
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
}

export interface MatchPredictionInput {
  homeTeam: string;
  awayTeam: string;
  features: MatchFeatures;
}

export interface MatchPredictionOutput {
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  home_xg: number;
  away_xg: number;
  confidence: number;
}

export interface ExplanationOutput extends MatchPredictionOutput {
  feature_importance: Array<{ feature: string; importance: number }>;
  shap_values: Record<string, number>;
  top_factors: {
    positive: Array<{ feature: string; impact: number }>;
    negative: Array<{ feature: string; impact: number }>;
  };
}

export interface HealthStatus {
  status: string;
  models_loaded: {
    match_outcome: boolean;
    xg_home: boolean;
    xg_away: boolean;
  };
  version: string;
}

export class PythonMLBridge {
  private client: AxiosInstance;
  private baseURL: string;
  private isAvailable: boolean = false;

  constructor() {
    // Configure Python ML server URL
    this.baseURL = process.env.ML_SERVER_URL || 'http://localhost:8000';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Check availability on initialization
    this.checkAvailability();
  }

  /**
   * Check if Python ML server is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.client.get<HealthStatus>('/health');
      this.isAvailable = response.data.status === 'healthy';
      console.log(`✅ Python ML server is ${this.isAvailable ? 'available' : 'unavailable'}`);
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      console.log('⚠️  Python ML server not available, will use fallback predictions');
      return false;
    }
  }

  /**
   * Get health status of ML server
   */
  async getHealth(): Promise<HealthStatus | null> {
    try {
      const response = await this.client.get<HealthStatus>('/health');
      return response.data;
    } catch (error) {
      console.error('Failed to get ML server health:', error);
      return null;
    }
  }

  /**
   * Predict match outcome using Python XGBoost model
   */
  async predictMatch(input: MatchPredictionInput): Promise<MatchPredictionOutput | null> {
    try {
      const response = await this.client.post<MatchPredictionOutput>(
        '/predict/match',
        input
      );
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Python ML server not running. Start it with: cd ml/python && uvicorn serve:app --reload');
      } else {
        console.error('Failed to get ML prediction:', error.message);
      }
      return null;
    }
  }

  /**
   * Get match prediction with SHAP explanation
   */
  async explainMatch(input: MatchPredictionInput): Promise<ExplanationOutput | null> {
    try {
      const response = await this.client.post<ExplanationOutput>(
        '/explain/match',
        input
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to get ML explanation:', error.message);
      return null;
    }
  }

  /**
   * Get global feature importance from trained model
   */
  async getFeatureImportance(): Promise<Array<{ feature: string; importance: number }> | null> {
    try {
      const response = await this.client.get<Array<{ feature: string; importance: number }>>(
        '/features/importance'
      );
      return response.data;
    } catch (error: any) {
      console.error('Failed to get feature importance:', error.message);
      return null;
    }
  }

  /**
   * Check if ML server is currently available
   */
  getAvailability(): boolean {
    return this.isAvailable;
  }
}

// Export singleton instance
export const mlBridge = new PythonMLBridge();
