import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertUserPickSchema } from "@shared/schema";
import { footballDataApi } from "./services/footballDataApi";

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

  const httpServer = createServer(app);
  return httpServer;
}
