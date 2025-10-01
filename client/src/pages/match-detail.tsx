import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { type Match, type FeatureImportance } from "@shared/schema";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"outcome" | "stats" | "players">("outcome");

  const { data: match, isLoading: matchLoading } = useQuery<Match>({
    queryKey: ["/api/matches", params?.id],
  });

  const { data: features, isLoading: featuresLoading } = useQuery<FeatureImportance[]>({
    queryKey: ["/api/feature-importance", params?.id],
    enabled: !!params?.id,
  });

  if (matchLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 py-6">
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 py-6 text-center">
          <p className="text-muted-foreground">Match not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-card to-background">
      <Header />

      <div className="px-4 py-6 max-w-7xl mx-auto">
        <button
          data-testid="button-back"
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <i className="fas fa-arrow-left"></i>
          <span>Back to Fixtures</span>
        </button>

        {/* Match Header */}
        <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-2xl p-6 mb-6 border border-primary/20">
          <div className="text-center mb-4">
            <span className="stage-badge mb-2 inline-block">{match.stage} - Leg 1</span>
            <p className="text-xs text-muted-foreground">
              {match.date}, {match.time} • {match.venue}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center mb-6">
            <div className="flex flex-col items-center">
              <img
                src={match.homeTeamCrest}
                alt={match.homeTeam}
                className="w-20 h-20 rounded-full mb-3 object-cover border-2 border-primary"
              />
              <p className="text-lg font-bold">{match.homeTeam}</p>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-sm text-muted-foreground mb-2">Final Score</span>
              <div className="bg-background rounded-xl px-6 py-3 border border-primary/30">
                <span className="text-3xl font-mono font-bold">? : ?</span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <img
                src={match.awayTeamCrest}
                alt={match.awayTeam}
                className="w-20 h-20 rounded-full mb-3 object-cover border-2 border-secondary"
              />
              <p className="text-lg font-bold">{match.awayTeam}</p>
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Model Confidence: {match.confidence}%
            </p>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                style={{ width: `${match.confidence}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
          <button
            data-testid="tab-outcome"
            onClick={() => setActiveTab("outcome")}
            className={`px-6 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
              activeTab === "outcome"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-border"
            }`}
          >
            Outcome Prediction
          </button>
          <button
            data-testid="tab-stats"
            onClick={() => setActiveTab("stats")}
            className={`px-6 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
              activeTab === "stats"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-border"
            }`}
          >
            Team Stats
          </button>
          <button
            data-testid="tab-players"
            onClick={() => setActiveTab("players")}
            className={`px-6 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${
              activeTab === "players"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-border"
            }`}
          >
            Player Forecasts
          </button>
        </div>

        {/* Outcome Tab */}
        {activeTab === "outcome" && (
          <div>
            {/* Probabilities */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h4 className="text-lg font-bold mb-4">Match Outcome Probabilities</h4>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{match.homeTeam} Win</span>
                    <span 
                      data-testid="text-home-win-prob"
                      className="text-sm font-bold text-primary"
                    >
                      {match.homeWinProb}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                      style={{ width: `${match.homeWinProb}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Draw</span>
                    <span 
                      data-testid="text-draw-prob"
                      className="text-sm font-bold text-muted-foreground"
                    >
                      {match.drawProb}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-muted-foreground to-muted-foreground/70 transition-all duration-500"
                      style={{ width: `${match.drawProb}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{match.awayTeam} Win</span>
                    <span 
                      data-testid="text-away-win-prob"
                      className="text-sm font-bold text-secondary"
                    >
                      {match.awayWinProb}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-secondary to-secondary/70 transition-all duration-500"
                      style={{ width: `${match.awayWinProb}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Expected Goals */}
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h4 className="text-lg font-bold mb-4">Expected Goals (xG)</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{match.homeTeam} xG</p>
                  <p 
                    data-testid="text-home-xg"
                    className="text-3xl font-bold text-primary"
                  >
                    {match.homeXg}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">±0.4 CI</p>
                </div>
                <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{match.awayTeam} xG</p>
                  <p 
                    data-testid="text-away-xg"
                    className="text-3xl font-bold text-secondary"
                  >
                    {match.awayXg}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">±0.5 CI</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <i className="fas fa-info-circle mr-1"></i>
                  Expected goals based on shot quality, position, and defensive pressure analysis
                </p>
              </div>
            </div>

            {/* Feature Importance */}
            {!featuresLoading && features && features.length > 0 && (
              <div className="bg-card rounded-2xl border border-border p-6 mb-6">
                <h4 className="text-lg font-bold mb-4">Key Prediction Factors</h4>

                <div className="space-y-3">
                  {features.map((feature) => (
                    <div key={feature.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{feature.featureName}</span>
                        <span
                          className={`text-sm font-bold ${
                            feature.impact >= 0 ? "text-primary" : "text-secondary"
                          }`}
                        >
                          {feature.impact >= 0 ? "+" : ""}
                          {feature.impact.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            feature.impact >= 0 ? "bg-primary" : "bg-secondary"
                          }`}
                          style={{ width: `${feature.importance}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-Horizon */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h4 className="text-lg font-bold mb-4">Multi-Horizon Performance</h4>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Last Match</p>
                  <p className="text-xl font-bold">W 3-1</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Last 3 Matches</p>
                  <p className="text-xl font-bold">2W 1D</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Last 5 Matches</p>
                  <p className="text-xl font-bold">3W 2D</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h4 className="text-lg font-bold mb-4">Team Statistics Comparison</h4>
            <p className="text-muted-foreground text-center py-8">
              Team stats comparison visualization
            </p>
          </div>
        )}

        {/* Players Tab */}
        {activeTab === "players" && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h4 className="text-lg font-bold mb-4">Player Performance Forecasts</h4>
            <p className="text-muted-foreground text-center py-8">
              Player forecast cards will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
