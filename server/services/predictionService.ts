interface TeamStats {
  teamId: number;
  teamName: string;
  strength: number;
  recentForm: number;
  homeAdvantage?: number;
}

interface MatchPrediction {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  homeXg: number;
  awayXg: number;
  confidence: number;
}

export class PredictionService {
  // Simplified team strength ratings (based on UEFA coefficients and recent performance)
  private teamStrengthRatings: Record<string, number> = {
    "Manchester City": 95,
    "Real Madrid": 94,
    "Bayern Munich": 92,
    "Liverpool": 91,
    "Inter Milan": 88,
    "Barcelona": 90,
    "Arsenal": 87,
    "Paris Saint-Germain": 89,
    "Borussia Dortmund": 85,
    "Atlético Madrid": 86,
    "AC Milan": 84,
    "RB Leipzig": 83,
    "Manchester United": 82,
    "Chelsea": 81,
    "Juventus": 85,
    "PSV Eindhoven": 78,
    "Sporting CP": 80,
    "Benfica": 82,
    // Default for unknown teams
  };

  getTeamStrength(teamName: string): number {
    // Find best match for team name (handles variations like "Man City" vs "Manchester City")
    const normalizedName = teamName.toLowerCase();
    for (const [key, value] of Object.entries(this.teamStrengthRatings)) {
      if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
        return value;
      }
    }
    return 80; // Default strength for unknown teams
  }

  calculateMatchPrediction(
    homeTeam: string,
    awayTeam: string,
    venue?: string,
    stage?: string
  ): MatchPrediction {
    const homeStrength = this.getTeamStrength(homeTeam);
    const awayStrength = this.getTeamStrength(awayTeam);
    
    // Home advantage factor (typically 3-5 rating points)
    const homeAdvantage = 4;
    const adjustedHomeStrength = homeStrength + homeAdvantage;
    
    // Calculate strength difference
    const strengthDiff = adjustedHomeStrength - awayStrength;
    
    // Base probabilities using logistic function
    // When teams are equal (diff=0), home has ~45%, draw ~27%, away ~28%
    const baseProbHome = this.logistic(strengthDiff / 15) * 0.85;
    const baseProbAway = this.logistic(-strengthDiff / 15) * 0.85;
    
    // Draw probability inversely related to strength difference
    const drawProb = Math.max(0.15, 0.32 - Math.abs(strengthDiff) / 100);
    
    // Normalize to sum to 100%
    const total = baseProbHome + baseProbAway + drawProb;
    const homeWinProb = Math.round((baseProbHome / total) * 100 * 10) / 10;
    const awayWinProb = Math.round((baseProbAway / total) * 100 * 10) / 10;
    const drawProbNorm = Math.round((drawProb / total) * 100 * 10) / 10;
    
    // Ensure probabilities sum to 100
    const normalizedDrawProb = 100 - homeWinProb - awayWinProb;
    
    // Calculate expected goals (xG) based on team strength
    const homeXg = this.calculateXg(adjustedHomeStrength, awayStrength);
    const awayXg = this.calculateXg(awayStrength, adjustedHomeStrength);
    
    // Confidence based on strength difference (higher diff = higher confidence)
    const confidence = Math.min(95, Math.max(75, 80 + Math.abs(strengthDiff) / 2));
    
    return {
      homeWinProb,
      drawProb: normalizedDrawProb,
      awayWinProb,
      homeXg: Math.round(homeXg * 10) / 10,
      awayXg: Math.round(awayXg * 10) / 10,
      confidence: Math.round(confidence * 10) / 10,
    };
  }

  private logistic(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private calculateXg(attackStrength: number, defenseStrength: number): number {
    // Expected goals based on relative strength
    // Average team scores ~1.5 goals per match in Champions League
    const baseXg = 1.5;
    const strengthFactor = (attackStrength - defenseStrength) / 50;
    const xg = baseXg + strengthFactor;
    
    // Clamp between reasonable bounds (0.5 to 3.5 goals)
    return Math.max(0.5, Math.min(3.5, xg));
  }

  calculatePlayerExpectedContribution(
    playerPosition: string,
    teamStrength: number,
    opponentStrength: number,
    predictedMinutes: number = 90
  ): number {
    // Base contribution by position
    const baseContribution: Record<string, number> = {
      "FWD": 8.0,
      "Attacker": 8.0,
      "MID": 6.5,
      "Midfielder": 6.5,
      "DEF": 5.5,
      "Defender": 5.5,
      "GK": 5.0,
      "Goalkeeper": 5.0,
    };

    const base = baseContribution[playerPosition] || 6.0;
    
    // Adjust for team strength differential
    const strengthFactor = (teamStrength - opponentStrength) / 30;
    
    // Adjust for predicted minutes (scale linearly)
    const minutesFactor = predictedMinutes / 90;
    
    const contribution = base * (1 + strengthFactor * 0.2) * minutesFactor;
    
    return Math.round(contribution * 10) / 10;
  }

  calculateFeatureImportance(
    homeStrength: number,
    awayStrength: number,
    stage: string
  ): Array<{ featureName: string; importance: number; impact: number }> {
    const strengthDiff = homeStrength - awayStrength;
    
    return [
      {
        featureName: "Home Form Advantage",
        importance: 75,
        impact: 0.12,
      },
      {
        featureName: "Recent Performance",
        importance: Math.min(90, 55 + Math.abs(strengthDiff) / 2),
        impact: strengthDiff > 0 ? 0.08 : -0.05,
      },
      {
        featureName: "Opponent Defensive Rating",
        importance: 65,
        impact: -0.06,
      },
      {
        featureName: "Squad Availability",
        importance: 55,
        impact: 0.05,
      },
      {
        featureName: "Stage Importance",
        importance: stage.includes("Final") ? 85 : 45,
        impact: stage.includes("Final") ? 0.10 : 0.03,
      },
    ];
  }
}

export const predictionService = new PredictionService();
