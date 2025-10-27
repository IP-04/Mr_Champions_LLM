/**
 * Feature Engineering for ML Models
 * Calculate ELO ratings, form metrics, and rolling statistics
 */

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
  calculateH2HStats(teamA: string, teamB: string): HeadToHeadStats {
    // In production, this would query historical match database
    // For now, return estimated values based on team strength
    const eloA = this.getEloRating(teamA);
    const eloB = this.getEloRating(teamB);
    const eloDiff = eloA - eloB;

    // Simulate H2H based on relative strength
    const totalMatches = 5;
    let homeWins = 2;
    let draws = 1;
    let awayWins = 2;

    if (eloDiff > 100) {
      homeWins = 3;
      draws = 1;
      awayWins = 1;
    } else if (eloDiff > 50) {
      homeWins = 3;
      draws = 1;
      awayWins = 1;
    } else if (eloDiff < -100) {
      homeWins = 1;
      draws = 1;
      awayWins = 3;
    } else if (eloDiff < -50) {
      homeWins = 1;
      draws = 2;
      awayWins = 2;
    }

    return {
      homeWins,
      draws,
      awayWins,
      totalMatches,
    };
  }

  /**
   * Calculate venue advantage factor
   */
  calculateVenueAdvantage(isHomeTeam: boolean, venue?: string): number {
    // Standard home advantage
    if (isHomeTeam) {
      // Stronger home advantage for specific venues
      const strongHomeVenues = ["Bernabeu", "Camp Nou", "Allianz", "Anfield"];
      if (venue && strongHomeVenues.some((v) => venue.includes(v))) {
        return 1.2;
      }
      return 1.0;
    }
    return 0;
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
  prepareMatchFeatures(
    homeTeam: string,
    awayTeam: string,
    stage: string = "",
    venue: string = ""
  ): {
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
  } {
    const homeElo = this.getEloRating(homeTeam);
    const awayElo = this.getEloRating(awayTeam);

    // Mock form data (in production, would query database)
    const homeForm: TeamFormData = {
      wins: 3,
      draws: 1,
      losses: 1,
      goalsScored: 9,
      goalsConceded: 5,
      xG: 8.5,
      xGA: 5.2,
    };

    const awayForm: TeamFormData = {
      wins: 2,
      draws: 2,
      losses: 1,
      goalsScored: 7,
      goalsConceded: 6,
      xG: 6.8,
      xGA: 6.5,
    };

    const homeFormMetrics = this.calculateFormMetrics(homeForm);
    const awayFormMetrics = this.calculateFormMetrics(awayForm);
    const h2h = this.calculateH2HStats(homeTeam, awayTeam);

    return {
      home_elo: homeElo,
      away_elo: awayElo,
      elo_diff: homeElo - awayElo,
      home_form_last5: homeFormMetrics.formPoints,
      away_form_last5: awayFormMetrics.formPoints,
      home_goals_last5: homeForm.goalsScored,
      away_goals_last5: awayForm.goalsScored,
      home_xg_last5: homeForm.xG,
      away_xg_last5: awayForm.xG,
      h2h_home_wins: h2h.homeWins,
      h2h_draws: h2h.draws,
      h2h_away_wins: h2h.awayWins,
      home_possession_avg: 52 + (homeElo - 1700) / 50, // Estimate based on ELO
      away_possession_avg: 48 + (awayElo - 1700) / 50,
      venue_advantage: this.calculateVenueAdvantage(true, venue),
      stage_importance: this.calculateStageImportance(stage),
      home_rest_days: this.calculateRestDays(homeTeam),
      away_rest_days: this.calculateRestDays(awayTeam),
    };
  }
}

export const featureEngineering = new FeatureEngineeringService();
