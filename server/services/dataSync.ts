import { footballDataApi } from "./footballDataApi";
import { predictionService } from "./predictionService";
import { db } from "../../db";
import { matches, players, featureImportance } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { InsertMatch, InsertPlayer, InsertFeatureImportance } from "@shared/schema";

export class DataSyncService {
  async syncChampionsLeagueMatches(): Promise<void> {
    try {
      // Fetch upcoming Champions League matches
      const apiMatches = await footballDataApi.getUpcomingMatches();
      
      if (!apiMatches || apiMatches.length === 0) {
        console.log("No upcoming Champions League matches found");
        return;
      }

      // Sync first 10 upcoming matches
      const matchesToSync = apiMatches.slice(0, 10);

      for (const apiMatch of matchesToSync) {
        const matchId = `match-${apiMatch.id}`;
        
        // Check if match already exists
        const existingMatch = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
        
        if (existingMatch.length > 0) {
          continue; // Skip if already exists
        }

        // Format date and time
        const matchDate = new Date(apiMatch.utcDate);
        const dateStr = matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'CET' });

        // Generate predictions
        const prediction = predictionService.calculateMatchPrediction(
          apiMatch.homeTeam.name,
          apiMatch.awayTeam.name,
          apiMatch.venue || undefined,
          apiMatch.stage
        );

        // Create match record
        const match: InsertMatch = {
          id: matchId,
          homeTeam: apiMatch.homeTeam.shortName || apiMatch.homeTeam.name,
          awayTeam: apiMatch.awayTeam.shortName || apiMatch.awayTeam.name,
          homeTeamCrest: apiMatch.homeTeam.crest,
          awayTeamCrest: apiMatch.awayTeam.crest,
          date: dateStr,
          time: timeStr + " CET",
          venue: apiMatch.venue || `${apiMatch.homeTeam.name} Stadium`,
          stage: this.formatStage(apiMatch.stage),
          homeWinProb: prediction.homeWinProb,
          drawProb: prediction.drawProb,
          awayWinProb: prediction.awayWinProb,
          homeXg: prediction.homeXg,
          awayXg: prediction.awayXg,
          confidence: prediction.confidence,
        };

        await db.insert(matches).values(match);

        // Generate and store feature importance
        const features = predictionService.calculateFeatureImportance(
          predictionService.getTeamStrength(apiMatch.homeTeam.name),
          predictionService.getTeamStrength(apiMatch.awayTeam.name),
          apiMatch.stage
        );

        const featureRecords: InsertFeatureImportance[] = features.map((f, idx) => ({
          id: `f-${matchId}-${idx}`,
          matchId: matchId,
          featureName: f.featureName,
          importance: f.importance,
          impact: f.impact,
        }));

        await db.insert(featureImportance).values(featureRecords);
      }

      console.log(`Synced ${matchesToSync.length} Champions League matches`);
    } catch (error) {
      console.error("Error syncing Champions League matches:", error);
    }
  }

  async syncTeamPlayers(): Promise<void> {
    try {
      const teams = await footballDataApi.getChampionsLeagueTeams();
      
      if (!teams || teams.length === 0) {
        console.log("No Champions League teams found");
        return;
      }

      // Sync players from first 3 teams (to avoid overwhelming the database)
      const teamsToSync = teams.slice(0, 3);

      for (const team of teamsToSync) {
        if (!team.squad || team.squad.length === 0) continue;

        // Get top 5 players from each team (by position priority: attackers, midfielders, defenders, goalkeepers)
        const positionPriority: Record<string, number> = {
          "Offence": 1,
          "Midfield": 2,
          "Defence": 3,
          "Goalkeeper": 4,
        };

        const sortedPlayers = team.squad
          .sort((a, b) => (positionPriority[a.position] || 5) - (positionPriority[b.position] || 5))
          .slice(0, 5);

        for (const apiPlayer of sortedPlayers) {
          const playerId = `player-${apiPlayer.id}`;
          
          // Check if player already exists
          const existingPlayer = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
          if (existingPlayer.length > 0) continue;

          const position = this.mapPosition(apiPlayer.position);
          const teamStrength = predictionService.getTeamStrength(team.name);
          
          const player: InsertPlayer = {
            id: playerId,
            name: this.formatPlayerName(apiPlayer.name),
            team: team.shortName || team.name,
            position: position,
            imageUrl: `https://images.unsplash.com/photo-${Math.floor(Math.random() * 9000000000) + 1000000000}?w=60&h=60&fit=crop&crop=faces`,
            expectedContribution: predictionService.calculatePlayerExpectedContribution(position, teamStrength, 85, 85),
            predictedMinutes: position === "GK" ? 90 : Math.floor(Math.random() * 20) + 70,
            statProbability: Math.floor(Math.random() * 30) + 50,
            statType: this.getStatType(position),
            last5Avg: Math.floor(Math.random() * 30) + 40,
            stat90: Math.random() * 2 + 0.5,
          };

          await db.insert(players).values(player);
        }
      }

      console.log(`Synced players from ${teamsToSync.length} teams`);
    } catch (error) {
      console.error("Error syncing team players:", error);
    }
  }

  private formatStage(stage: string): string {
    const stageMap: Record<string, string> = {
      "LEAGUE_STAGE": "League Phase",
      "ROUND_OF_16": "Round of 16",
      "QUARTER_FINALS": "Quarter Finals",
      "SEMI_FINALS": "Semi Finals",
      "FINAL": "Final",
    };
    return stageMap[stage] || stage;
  }

  private mapPosition(apiPosition: string): string {
    const posMap: Record<string, string> = {
      "Offence": "FWD",
      "Midfield": "MID",
      "Defence": "DEF",
      "Goalkeeper": "GK",
    };
    return posMap[apiPosition] || "MID";
  }

  private getStatType(position: string): string {
    const statMap: Record<string, string> = {
      "FWD": "Goals",
      "MID": "Assists",
      "DEF": "Clean Sheet",
      "GK": "Saves",
    };
    return statMap[position] || "Points";
  }

  private formatPlayerName(fullName: string): string {
    // Extract first initial and last name (e.g., "Erling Haaland" -> "E. Haaland")
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return fullName;
    
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName[0]}. ${lastName}`;
  }
}

export const dataSyncService = new DataSyncService();
