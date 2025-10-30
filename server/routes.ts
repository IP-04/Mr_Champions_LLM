import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertUserPickSchema } from "@shared/schema";
import { footballDataApi } from "./services/footballDataApi";
import { dataSyncService } from "./services/dataSync";
import { playerStatsGenerator } from "./services/playerStatsGenerator";
import { sofifaApi, UCL_TEAM_SOFIFA_IDS } from "./services/sofifaApi";
import { predictionService } from "./services/predictionService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Skip auth setup in local development
  if (process.env.DISABLE_AUTH !== 'true') {
    await setupAuth(app);
  }

  // Auth routes - modify for local development
  app.get('/api/auth/user', process.env.DISABLE_AUTH === 'true' ? (req: any, res) => {
    // Mock user for local development
    res.json({
      id: 'local-user',
      email: 'local@example.com',
      firstName: 'Local',
      lastName: 'User'
    });
  } : isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Matches
  app.get("/api/matches", async (_req, res) => {
    const matches = await storage.getMatches();
    res.json(matches);
  });

  app.get("/api/matches/:id", async (req, res) => {
    const match = await storage.getMatch(req.params.id);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }
    res.json(match);
  });

  // Regenerate prediction for a specific match
  app.post("/api/matches/:id/regenerate-prediction", async (req, res) => {
    try {
      const matchId = req.params.id;
      console.log(`\n🔄 Regenerating prediction for match: ${matchId}`);
      
      const match = await storage.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      // Generate new prediction
      const prediction = await predictionService.calculateMatchPrediction(
        match.homeTeam,
        match.awayTeam,
        match.venue,
        match.stage
      );

      // Update match in database
      const updatedMatch = {
        ...match,
        homeWinProb: prediction.homeWinProb,
        drawProb: prediction.drawProb,
        awayWinProb: prediction.awayWinProb,
        homeXg: prediction.homeXg,
        awayXg: prediction.awayXg,
      };

      await storage.updateMatch(matchId, updatedMatch);

      console.log(`✅ Prediction regenerated for ${match.homeTeam} vs ${match.awayTeam}`);
      res.json(updatedMatch);
    } catch (error) {
      console.error('Error regenerating prediction:', error);
      res.status(500).json({ message: "Failed to regenerate prediction" });
    }
  });

  // Regenerate all predictions
  app.post("/api/admin/regenerate-all-predictions", async (_req, res) => {
    try {
      console.log('\n🔄 Regenerating ALL match predictions...');
      
      const matches = await storage.getMatches();
      const scheduledMatches = matches.filter(m => m.status === 'SCHEDULED' || !m.status);
      
      console.log(`Found ${scheduledMatches.length} scheduled matches to update`);
      
      let updated = 0;
      for (const match of scheduledMatches) {
        try {
          const prediction = await predictionService.calculateMatchPrediction(
            match.homeTeam,
            match.awayTeam,
            match.venue,
            match.stage
          );

          await storage.updateMatch(match.id, {
            ...match,
            homeWinProb: prediction.homeWinProb,
            drawProb: prediction.drawProb,
            awayWinProb: prediction.awayWinProb,
            homeXg: prediction.homeXg,
            awayXg: prediction.awayXg,
          });

          updated++;
          console.log(`✅ [${updated}/${scheduledMatches.length}] ${match.homeTeam} vs ${match.awayTeam}`);
        } catch (error) {
          console.error(`❌ Failed to update ${match.id}:`, error);
        }
      }
      
      console.log(`\n✅ Regenerated ${updated} predictions`);
      res.json({ 
        message: `Regenerated ${updated} predictions`,
        total: scheduledMatches.length,
        updated 
      });
    } catch (error) {
      console.error('Error regenerating predictions:', error);
      res.status(500).json({ message: "Failed to regenerate predictions" });
    }
  });

  // Players
  app.get("/api/players", async (req, res) => {
    const position = req.query.position as string;
    let players = position 
      ? await storage.getPlayersByPosition(position)
      : await storage.getPlayers();
    
    // DEBUG: Check image URLs BEFORE normalization
    console.log('🖼️ [DEBUG] First 3 players BEFORE normalization:');
    players.slice(0, 3).forEach(p => {
      console.log(`  ${p.name}: playerFaceUrl=${p.playerFaceUrl || 'NULL'}, imageUrl=${p.imageUrl || 'NULL'}`);
    });
    
    // Normalize player data for display
    players = players.map(player => normalizePlayerData(player));
    
    // DEBUG: Check image URLs AFTER normalization
    console.log('🖼️ [DEBUG] First 3 players AFTER normalization:');
    players.slice(0, 3).forEach(p => {
      console.log(`  ${p.name}: playerFaceUrl=${p.playerFaceUrl || 'NULL'}, imageUrl=${p.imageUrl || 'NULL'}`);
    });
    
    res.json(players);
  });

  app.get("/api/players/:id", async (req, res) => {
    const player = await storage.getPlayer(req.params.id);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }
    
    // Normalize player data for display
    const normalizedPlayer = normalizePlayerData(player);
    
    res.json(normalizedPlayer);
  });
  
  // Helper function to normalize player data for frontend display
  function normalizePlayerData(player: any) {
    // Normalize probability to ensure it's 0-1
    let statProbability = player.statProbability;
    if (statProbability > 1) {
      statProbability = statProbability / 100;
    }
    statProbability = Math.min(1.0, Math.max(0.0, statProbability));
    
    // Normalize expectedContribution based on stat type
    // The stored value is currently a 0-10 rating, convert to realistic expected stat
    let expectedContribution = player.expectedContribution;
    const statType = player.statType;
    
    if (expectedContribution > 5) {
      // Scale down from 0-10 rating to realistic 0-2 expected stat range
      const conversionFactors: Record<string, number> = {
        "Goals": 0.15,        // 0-1.5 goals per match
        "Assists": 0.12,      // 0-1.2 assists per match
        "Goals + Assists": 0.20,  // 0-2.0 combined
        "Saves": 0.5,         // 0-5 saves per match
        "Clean Sheet": 0.08,  // 0-0.8 probability
        "Tackles": 0.3,       // 0-3 tackles
        "Interceptions": 0.2, // 0-2 interceptions
      };
      
      const factor = conversionFactors[statType] || 0.1;
      expectedContribution = expectedContribution * factor;
    }
    
    // Normalize stat90 to realistic range
    let stat90 = player.stat90;
    if (stat90 > 5 && statType !== "Saves") {
      // Likely incorrectly scaled, normalize to 0-2 range
      stat90 = stat90 * 0.2;
    }
    
    // Convert last5Avg to match rating (6.0-9.0 scale) if it's currently in different format
    let last5Avg = player.last5Avg;
    if (last5Avg > 10) {
      // Convert from percentage or points to rating
      last5Avg = 6.0 + (last5Avg / 100) * 3.0;
    }
    
    return {
      ...player,
      expectedContribution: Math.round(expectedContribution * 100) / 100,
      statProbability: Math.round(statProbability * 1000) / 1000,
      stat90: Math.round(stat90 * 100) / 100,
      last5Avg: Math.round(last5Avg * 10) / 10,
    };
  }

  // Feature Importance
  app.get("/api/feature-importance/:matchId", async (req, res) => {
    const features = await storage.getFeatureImportanceByMatch(req.params.matchId);
    res.json(features);
  });

  // Teams count
  app.get("/api/teams/count", async (_req, res) => {
    try {
      const teams = await footballDataApi.getChampionsLeagueTeams();
      res.json({ 
        count: teams?.length || 0, 
        teams: teams?.map((t: any) => t.name) || [] 
      });
    } catch (error) {
      console.error("Error fetching teams count:", error);
      res.status(500).json({ count: 0, teams: [] });
    }
  });

  // Leaderboard
  app.get("/api/leaderboard", async (_req, res) => {
    const leaderboard = await storage.getLeaderboard();
    res.json(leaderboard);
  });

  // User Picks (Protected - requires authentication)
  app.get("/api/picks", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const picks = await storage.getUserPicks(userId);
    res.json(picks);
  });

  app.post("/api/picks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Validate required pick fields from request body
      const { playerId, pickType, statLine, isOver } = req.body;
      
      if (!playerId || !pickType || statLine === undefined || isOver === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const pick = await storage.createUserPick({
        id: "", // Will be replaced by storage with UUID
        userId,
        playerId,
        pickType,
        statLine: Number(statLine),
        isOver: Boolean(isOver),
      });
      res.json(pick);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid request data" });
    }
  });

  app.delete("/api/picks/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.deleteUserPick(req.params.id, userId);
    res.json({ success: true });
  });

  // Admin routes for player data sync
  
  // Generate FIFA-style stats for all players (fallback method)
  app.post("/api/admin/generate-stats", async (_req, res) => {
    try {
      console.log('🔄 Manual player stats generation triggered');
      playerStatsGenerator.generateStatsForAllPlayers().catch(err => 
        console.error('Background stats generation error:', err)
      );
      res.json({ 
        message: "Player stats generation started in background",
        status: "processing" 
      });
    } catch (error) {
      console.error('Error starting player stats generation:', error);
      res.status(500).json({ error: "Failed to start stats generation" });
    }
  });

  // Sync players using Playwright web scraper
  app.post("/api/admin/sync-players", async (req, res) => {
    try {
      const limit = req.body?.limit || 20; // Default to 20 players
      console.log(`🔄 Playwright scraper sync triggered (limit: ${limit})`);
      
      // Run sync in background
      (async () => {
        console.log('\n=== STARTING PLAYWRIGHT SCRAPER SYNC ===');
        await dataSyncService.syncPlayersWithUrls(limit);
        console.log(`\n=== SYNC COMPLETE ===`);
      })().catch(err => console.error('Background scraper sync error:', err));
      
      res.json({ 
        message: `Playwright scraper sync started in background (limit: ${limit})`,
        status: "processing",
        note: "Check server logs for progress"
      });
    } catch (error) {
      console.error('Error starting scraper sync:', error);
      res.status(500).json({ error: "Failed to start scraper sync" });
    }
  });

  app.post("/api/admin/sync-match-players/:matchId", async (req, res) => {
    try {
      const matchId = req.params.matchId;
      console.log(`🔄 Manual sync triggered for match: ${matchId}`);
      
      // Run sync in background
      dataSyncService.syncPlayersForMatch(matchId).catch(err =>
        console.error('Background match sync error:', err)
      );
      
      res.json({ 
        message: `Player sync started for match ${matchId}`,
        status: "processing" 
      });
    } catch (error) {
      console.error('Error starting match player sync:', error);
      res.status(500).json({ message: "Failed to start match player sync" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
