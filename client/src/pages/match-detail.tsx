import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { type Match, type FeatureImportance, type Player } from "@shared/schema";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, User } from "lucide-react";

export default function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"outcome" | "stats" | "players">("outcome");
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away">("home");
  const [viewMode, setViewMode] = useState<"grid" | "carousel">("carousel");
  
  // Carousel setup
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: false,
    dragFree: true,
    containScroll: "trimSnaps",
    slidesToScroll: 1,
    align: "start"
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = () => emblaApi && emblaApi.scrollPrev();
  const scrollNext = () => emblaApi && emblaApi.scrollNext();

  const onSelect = () => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  };

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("reInit", onSelect);
    emblaApi.on("select", onSelect);
  }, [emblaApi, onSelect]);

  const { data: match, isLoading: matchLoading } = useQuery<Match>({
    queryKey: ["/api/matches", params?.id],
  });

  const { data: features, isLoading: featuresLoading } = useQuery<FeatureImportance[]>({
    queryKey: ["/api/feature-importance", params?.id],
    enabled: !!params?.id,
  });

  // Fetch all players and filter by match teams
  const { data: allPlayers, isLoading: playersLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
    enabled: !!match,
  });

  // Filter players by the teams in this match
  const matchPlayers = allPlayers?.filter(player => 
    player.team === match?.homeTeam || player.team === match?.awayTeam
  ) || [];

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
          <div className="space-y-6">
            {/* Attack vs Defense Comparison */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h4 className="text-lg font-bold mb-6">Attack vs Defense</h4>
              
              <div className="space-y-6">
                {/* Expected Goals Comparison */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-primary">{match.homeTeam}</span>
                    <span className="text-xs text-muted-foreground">Expected Goals (xG)</span>
                    <span className="text-sm font-medium text-secondary">{match.awayTeam}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-primary w-12 text-right">{match.homeXg}</span>
                    <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden flex">
                      <div 
                        className="bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center"
                        style={{ width: `${(match.homeXg / (match.homeXg + match.awayXg)) * 100}%` }}
                      >
                        <span className="text-xs font-bold text-primary-foreground">
                          {((match.homeXg / (match.homeXg + match.awayXg)) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div 
                        className="bg-gradient-to-l from-secondary to-secondary/70 flex items-center justify-center"
                        style={{ width: `${(match.awayXg / (match.homeXg + match.awayXg)) * 100}%` }}
                      >
                        <span className="text-xs font-bold text-secondary-foreground">
                          {((match.awayXg / (match.homeXg + match.awayXg)) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-secondary w-12">{match.awayXg}</span>
                  </div>
                </div>

                {/* Win Probability Comparison */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-primary">{match.homeTeam}</span>
                    <span className="text-xs text-muted-foreground">Win Probability</span>
                    <span className="text-sm font-medium text-secondary">{match.awayTeam}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-primary w-12 text-right">{match.homeWinProb}%</span>
                    <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden flex">
                      <div 
                        className="bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center"
                        style={{ width: `${match.homeWinProb}%` }}
                      >
                        {match.homeWinProb > 15 && (
                          <span className="text-xs font-bold text-primary-foreground">
                            {match.homeWinProb}%
                          </span>
                        )}
                      </div>
                      <div 
                        className="bg-muted-foreground/30 flex items-center justify-center"
                        style={{ width: `${match.drawProb}%` }}
                      >
                        {match.drawProb > 10 && (
                          <span className="text-xs font-bold text-foreground">
                            {match.drawProb}%
                          </span>
                        )}
                      </div>
                      <div 
                        className="bg-gradient-to-l from-secondary to-secondary/70 flex items-center justify-center"
                        style={{ width: `${match.awayWinProb}%` }}
                      >
                        {match.awayWinProb > 15 && (
                          <span className="text-xs font-bold text-secondary-foreground">
                            {match.awayWinProb}%
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-lg font-bold text-secondary w-12">{match.awayWinProb}%</span>
                  </div>
                </div>

                {/* Confidence Level */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Prediction Confidence</span>
                    <span className="text-sm font-bold text-accent">{match.confidence}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-accent to-accent/70 transition-all duration-500"
                      style={{ width: `${match.confidence}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on {features?.length || 0} key factors and historical performance data
                  </p>
                </div>
              </div>
            </div>

            {/* Team Strengths Grid */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h4 className="text-lg font-bold mb-6">Team Strengths</h4>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Home Team */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <img 
                      src={match.homeTeamCrest} 
                      alt={match.homeTeam}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <h5 className="text-lg font-bold text-primary">{match.homeTeam}</h5>
                  </div>
                  
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Attacking Threat</span>
                      <span className="text-sm font-bold text-primary">
                        {((match.homeXg / 3) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${(match.homeXg / 3) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Win Momentum</span>
                      <span className="text-sm font-bold text-primary">{match.homeWinProb}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${match.homeWinProb}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Home Advantage</span>
                      <span className="text-sm font-bold text-primary">
                        {(match.homeWinProb - match.awayWinProb > 0 ? '+' : '')}
                        {(match.homeWinProb - match.awayWinProb).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(Math.max((match.homeWinProb - match.awayWinProb + 50), 0), 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Away Team */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <img 
                      src={match.awayTeamCrest} 
                      alt={match.awayTeam}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <h5 className="text-lg font-bold text-secondary">{match.awayTeam}</h5>
                  </div>
                  
                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Attacking Threat</span>
                      <span className="text-sm font-bold text-secondary">
                        {((match.awayXg / 3) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-secondary"
                        style={{ width: `${(match.awayXg / 3) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Win Momentum</span>
                      <span className="text-sm font-bold text-secondary">{match.awayWinProb}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-secondary"
                        style={{ width: `${match.awayWinProb}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Defensive Solidity</span>
                      <span className="text-sm font-bold text-secondary">
                        {(100 - (match.homeXg / 3) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-secondary"
                        style={{ width: `${100 - (match.homeXg / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Matchup Stats */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h4 className="text-lg font-bold mb-6">Key Matchup Insights</h4>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">Most Likely Result</p>
                  <p className="text-2xl font-bold text-primary mb-1">
                    {match.homeWinProb > match.awayWinProb && match.homeWinProb > match.drawProb 
                      ? `${match.homeTeam} Win`
                      : match.awayWinProb > match.homeWinProb && match.awayWinProb > match.drawProb
                      ? `${match.awayTeam} Win`
                      : 'Draw'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.max(match.homeWinProb, match.awayWinProb, match.drawProb)}% probability
                  </p>
                </div>

                <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">Expected Goal Difference</p>
                  <p className="text-2xl font-bold text-accent mb-1">
                    {Math.abs(match.homeXg - match.awayXg).toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {match.homeXg > match.awayXg 
                      ? `${match.homeTeam} favored`
                      : match.awayXg > match.homeXg
                      ? `${match.awayTeam} favored`
                      : 'Evenly matched'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">Match Competitiveness</p>
                  <p className="text-2xl font-bold text-secondary mb-1">
                    {(100 - Math.abs(match.homeWinProb - match.awayWinProb)).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Math.abs(match.homeWinProb - match.awayWinProb) < 20 
                      ? 'Very close match'
                      : Math.abs(match.homeWinProb - match.awayWinProb) < 40
                      ? 'Competitive match'
                      : 'One-sided match'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Players Tab */}
        {activeTab === "players" && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h4 className="text-lg font-bold mb-6">Player Performance Forecasts</h4>
            
            {playersLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            ) : (
              <>
                {/* Team Toggle */}
                <div className="flex justify-center mb-6">
                  <div className="flex bg-muted rounded-lg p-1">
                    <button
                      onClick={() => setSelectedTeam("home")}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedTeam === "home"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {match.homeTeam}
                    </button>
                    <button
                      onClick={() => setSelectedTeam("away")}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedTeam === "away"
                          ? "bg-secondary text-secondary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {match.awayTeam}
                    </button>
                  </div>
                </div>

                {/* Player Cards - Conditional View */}
                {viewMode === 'carousel' ? (
                  /* Carousel Container */
                  <div className="relative">
                    <div className="overflow-hidden" ref={emblaRef}>
                      <div className="flex">
                        {matchPlayers
                          .filter(player => 
                            selectedTeam === "home" 
                              ? player.team === match.homeTeam 
                              : player.team === match.awayTeam
                          )
                          .map((player) => {
                            const positionColors = {
                              FWD: { bg: "from-red-600 to-red-800", text: "text-red-400", border: "border-red-500" },
                              MID: { bg: "from-green-600 to-green-800", text: "text-green-400", border: "border-green-500" },
                              DEF: { bg: "from-blue-600 to-blue-800", text: "text-blue-400", border: "border-blue-500" },
                              GK: { bg: "from-yellow-600 to-yellow-800", text: "text-yellow-400", border: "border-yellow-500" },
                            };
                            const positionColor = positionColors[player.position as keyof typeof positionColors] || positionColors.MID;

                            return (
                              <div 
                                key={player.id} 
                                className="flex-none w-full sm:w-1/2 lg:w-1/3 xl:w-1/4 px-2"
                              >
                                <div className="relative bg-gradient-to-t from-gray-900 via-gray-800 to-gray-700 rounded-2xl shadow-xl p-4 overflow-hidden border border-gray-700 hover:border-gray-600 transition-all duration-300 h-full">
                                  {/* FIFA-style card background */}
                                  <div className={`absolute inset-0 bg-gradient-to-br ${positionColor.bg} opacity-10`} />
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-full -translate-y-16 translate-x-16" />
                                  
                                  {/* Position Badge */}
                                  <div className={`absolute top-3 left-3 px-2 py-1 bg-gradient-to-r ${positionColor.bg} rounded text-white text-xs font-bold shadow-lg z-10`}>
                                    {player.position}
                                  </div>

                                  {/* Rating Badge */}
                                  <div className="absolute top-3 right-3 flex flex-col items-center z-10">
                                    <div className="text-yellow-400 text-xl font-bold">
                                      {player.expectedContribution.toFixed(1)}
                                    </div>
                                    <div className="text-xs text-gray-300">OVR</div>
                                  </div>

                                  {/* Player Image */}
                                  <div className="flex justify-center mt-8 mb-4">
                                    <div className={`relative w-20 h-20 rounded-full border-2 ${positionColor.border} overflow-hidden shadow-lg`}>
                                      {player.imageUrl ? (
                                        <img
                                          src={player.imageUrl}
                                          alt={player.name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                          }}
                                        />
                                      ) : null}
                                      <div className={`${player.imageUrl ? 'hidden' : ''} w-full h-full bg-gray-600 flex items-center justify-center`}>
                                        <User className="w-8 h-8 text-gray-400" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Player Info */}
                                  <div className="text-center mb-4">
                                    <h3 className="text-white font-bold text-sm mb-1">{player.name}</h3>
                                    <p className="text-gray-400 text-xs">{player.team}</p>
                                  </div>

                                  {/* Stats */}
                                  <div className="space-y-2 mb-4">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-gray-400">Expected</span>
                                      <span className={`font-bold ${positionColor.text}`}>
                                        {player.expectedContribution.toFixed(1)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-gray-400">Minutes</span>
                                      <span className="text-white font-medium">{player.predictedMinutes}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-gray-400">Probability</span>
                                      <span className="text-white font-medium">{(player.statProbability * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-gray-400">Last 5 Avg</span>
                                      <span className="text-white font-medium">{player.last5Avg.toFixed(1)}</span>
                                    </div>
                                  </div>

                                  {/* Pick Buttons */}
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium text-gray-400 text-center">Make Your Pick</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-lg">
                                        Over {player.statType}
                                      </button>
                                      <button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-lg">
                                        Under {player.statType}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Carousel Navigation */}
                    <button
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800 shadow-lg rounded-full p-2 z-10 border border-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-30"
                      onClick={scrollPrev}
                      disabled={!canScrollPrev}
                    >
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <button
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-800 shadow-lg rounded-full p-2 z-10 border border-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-30"
                      onClick={scrollNext}
                      disabled={!canScrollNext}
                    >
                      <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                  </div>
                ) : (
                  /* Grid Container */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {matchPlayers
                      .filter(player => 
                        selectedTeam === "home" 
                          ? player.team === match.homeTeam 
                          : player.team === match.awayTeam
                      )
                      .map((player) => {
                        const positionColors = {
                          FWD: { bg: "from-red-600 to-red-800", text: "text-red-400", border: "border-red-500" },
                          MID: { bg: "from-green-600 to-green-800", text: "text-green-400", border: "border-green-500" },
                          DEF: { bg: "from-blue-600 to-blue-800", text: "text-blue-400", border: "border-blue-500" },
                          GK: { bg: "from-yellow-600 to-yellow-800", text: "text-yellow-400", border: "border-yellow-500" },
                        };
                        const positionColor = positionColors[player.position as keyof typeof positionColors] || positionColors.MID;

                        return (
                          <div 
                            key={player.id} 
                            className="relative bg-gradient-to-t from-gray-900 via-gray-800 to-gray-700 rounded-2xl shadow-xl p-4 overflow-hidden border border-gray-700 hover:border-gray-600 transition-all duration-300"
                          >
                            {/* FIFA-style card background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${positionColor.bg} opacity-10`} />
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-full -translate-y-16 translate-x-16" />
                            
                            {/* Position Badge */}
                            <div className={`absolute top-3 left-3 px-2 py-1 bg-gradient-to-r ${positionColor.bg} rounded text-white text-xs font-bold shadow-lg z-10`}>
                              {player.position}
                            </div>

                            {/* Rating Badge */}
                            <div className="absolute top-3 right-3 flex flex-col items-center z-10">
                              <div className="text-yellow-400 text-xl font-bold">
                                {player.expectedContribution.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-300">OVR</div>
                            </div>

                            {/* Player Image */}
                            <div className="flex justify-center mt-8 mb-4">
                              <div className={`relative w-20 h-20 rounded-full border-2 ${positionColor.border} overflow-hidden shadow-lg`}>
                                {player.imageUrl ? (
                                  <img
                                    src={player.imageUrl}
                                    alt={player.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`${player.imageUrl ? 'hidden' : ''} w-full h-full bg-gray-600 flex items-center justify-center`}>
                                  <User className="w-8 h-8 text-gray-400" />
                                </div>
                              </div>
                            </div>

                            {/* Player Info */}
                            <div className="text-center mb-4">
                              <h3 className="text-white font-bold text-sm mb-1">{player.name}</h3>
                              <p className="text-gray-400 text-xs">{player.team}</p>
                            </div>

                            {/* Stats */}
                            <div className="space-y-2 mb-4">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Expected</span>
                                <span className={`font-bold ${positionColor.text}`}>
                                  {player.expectedContribution.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Minutes</span>
                                <span className="text-white font-medium">{player.predictedMinutes}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Probability</span>
                                <span className="text-white font-medium">{(player.statProbability * 100).toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Last 5 Avg</span>
                                <span className="text-white font-medium">{player.last5Avg.toFixed(1)}</span>
                              </div>
                            </div>

                            {/* Pick Buttons */}
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-gray-400 text-center">Make Your Pick</div>
                              <div className="grid grid-cols-2 gap-2">
                                <button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-lg">
                                  Over {player.statType}
                                </button>
                                <button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-lg">
                                  Under {player.statType}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Grid View Toggle */}
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setViewMode(viewMode === 'carousel' ? 'grid' : 'carousel')}
                    className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-border transition-colors"
                  >
                    Switch to {viewMode === 'carousel' ? 'Grid' : 'Carousel'} View
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
