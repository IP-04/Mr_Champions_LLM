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
  private checkInProgress: boolean = false;

  constructor() {
    // Configure Python ML server URL
    this.baseURL = process.env.ML_SERVER_URL || 'http://localhost:8000';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 second timeout (increased for slow Python startup)
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Check availability on initialization with retry
    this.initializeWithRetry();
  }

  /**
   * Initialize with retry logic
   */
  private async initializeWithRetry(): Promise<void> {
    // Try immediate check
    await this.checkAvailability();
    
    // If not available, retry after 2 seconds
    if (!this.isAvailable) {
      setTimeout(async () => {
        await this.checkAvailability();
        
        // If still not available after retry, retry once more after 5 seconds
        if (!this.isAvailable) {
          setTimeout(async () => {
            await this.checkAvailability();
          }, 5000);
        }
      }, 2000);
    }
  }

  /**
   * Check if Python ML server is available
   */
  async checkAvailability(): Promise<boolean> {
    if (this.checkInProgress) {
      return this.isAvailable;
    }

    this.checkInProgress = true;
    
    try {
      const response = await this.client.get<HealthStatus>('/health');
      this.isAvailable = response.data.status === 'healthy';
      
      if (this.isAvailable) {
        console.log(`✅ Python ML server is available at ${this.baseURL}`);
        console.log(`   Models loaded: ${JSON.stringify(response.data.models_loaded)}`);
      }
      
      return this.isAvailable;
    } catch (error: any) {
      this.isAvailable = false;
      console.log(`⚠️  Python ML server not available at ${this.baseURL}`);
      
      // Detailed error logging
      if (error.code) {
        console.log(`   Error code: ${error.code}`);
      }
      if (error.message) {
        console.log(`   Error message: ${error.message}`);
      }
      if (error.response) {
        console.log(`   HTTP Status: ${error.response.status}`);
      }
      
      console.log(`   Will use fallback predictions. Start ML server with:`);
      console.log(`   cd ml/python && python quickstart.py --serve-only`);
      return false;
    } finally {
      this.checkInProgress = false;
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
    // If server was previously unavailable, try to reconnect
    if (!this.isAvailable && !this.checkInProgress) {
      await this.checkAvailability();
    }

    // If still not available, return null
    if (!this.isAvailable) {
      return null;
    }

    try {
      // Convert camelCase to snake_case for Python API
      const requestBody = {
        home_team: input.homeTeam,
        away_team: input.awayTeam,
        features: input.features
      };

      console.log(`[PythonBridge] Sending request to ML server:`, JSON.stringify(requestBody, null, 2));

      const response = await this.client.post<MatchPredictionOutput>(
        '/predict/match',
        requestBody
      );
      
      console.log(`[PythonBridge] ✅ Received response from ML server:`, response.data);
      return response.data;
    } catch (error: any) {
      // Mark as unavailable if connection fails
      this.isAvailable = false;
      
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Python ML server connection refused');
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
    // If server was previously unavailable, try to reconnect
    if (!this.isAvailable && !this.checkInProgress) {
      await this.checkAvailability();
    }

    // If still not available, return null
    if (!this.isAvailable) {
      return null;
    }

    try {
      const response = await this.client.post<ExplanationOutput>(
        '/explain/match',
        input
      );
      return response.data;
    } catch (error: any) {
      // Mark as unavailable if connection fails
      this.isAvailable = false;
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
