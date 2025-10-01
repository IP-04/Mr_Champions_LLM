import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Leaderboard
  app.get("/api/leaderboard", async (_req, res) => {
    const leaderboard = await storage.getLeaderboard();
    res.json(leaderboard);
  });

  // User Picks
  app.get("/api/picks", async (_req, res) => {
    const picks = await storage.getUserPicks();
    res.json(picks);
  });

  app.post("/api/picks", async (req, res) => {
    const pick = await storage.createUserPick(req.body);
    res.json(pick);
  });

  app.delete("/api/picks/:id", async (req, res) => {
    await storage.deleteUserPick(req.params.id);
    res.json({ success: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
