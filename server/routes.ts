import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertUserPickSchema } from "@shared/schema";
import { footballDataApi } from "./services/footballDataApi";
import { dataSyncService } from "./services/dataSync";
import { playerStatsGenerator } from "./services/playerStatsGenerator";
import { sofifaApi, UCL_TEAM_SOFIFA_IDS } from "./services/sofifaApi";

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

  // Players
  app.get("/api/players", async (req, res) => {
    const position = req.query.position as string;
    const players = position 
      ? await storage.getPlayersByPosition(position)
      : await storage.getPlayers();
    res.json(players);
  });

  app.get("/api/players/:id", async (req, res) => {
    const player = await storage.getPlayer(req.params.id);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }
    res.json(player);
  });

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

  // Sync players using SoFIFA Official API (preferred method)
  app.post("/api/admin/sync-players", async (_req, res) => {
    try {
      console.log('🔄 SoFIFA API sync triggered');
      
      // Run sync in background
      (async () => {
        console.log('\n=== STARTING SOFIFA API SYNC ===');
        let totalUpdated = 0;
        
        for (const [teamName, teamId] of Object.entries(UCL_TEAM_SOFIFA_IDS)) {
          const updated = await sofifaApi.syncTeamPlayers(teamId, teamName);
          totalUpdated += updated;
          
          // Small delay between teams to respect rate limit
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log(`\n=== SOFIFA SYNC COMPLETE ===`);
        console.log(`✅ Total players updated: ${totalUpdated}`);
      })().catch(err => console.error('Background SoFIFA sync error:', err));
      
      res.json({ 
        message: "SoFIFA API sync started in background",
        status: "processing",
        teams: Object.keys(UCL_TEAM_SOFIFA_IDS).length
      });
    } catch (error) {
      console.error('Error starting SoFIFA sync:', error);
      res.status(500).json({ error: "Failed to start SoFIFA sync" });
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
