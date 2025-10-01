import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { type Match, type FeatureImportance } from "@shared/schema";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from "lucide-react";

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

  // Mock player forecasts data for demonstration
  const mockPlayerForecasts = [
    {
      id: 1,
      name: "Erling Haaland",
      position: "ST",
      team: match?.homeTeam || "Man City",
      forecasts: {
        goals: 1.2,
        assists: 0.3,
        rating: 8.4,
        shots: 4.1,
        passes: 35.2,
        passAccuracy: 0.85
      }
    },
    {
      id: 2,
      name: "Kevin De Bruyne",
      position: "MID",
      team: match?.homeTeam || "Man City",
      forecasts: {
        goals: 0.4,
        assists: 0.8,
        rating: 8.1,
        shots: 2.3,
        passes: 68.5,
        passAccuracy: 0.89
      }
    },
    {
      id: 3,
      name: "Phil Foden",
      position: "LW",
      team: match?.homeTeam || "Man City",
      forecasts: {
        goals: 0.6,
        assists: 0.5,
        rating: 7.8,
        shots: 3.2,
        passes: 45.1,
        passAccuracy: 0.87
      }
    },
    {
      id: 4,
      name: "Jack Grealish",
      position: "LW",
      team: match?.homeTeam || "Man City",
      forecasts: {
        goals: 0.3,
        assists: 0.6,
        rating: 7.5,
        shots: 2.1,
        passes: 42.8,
        passAccuracy: 0.91
      }
    },
    {
      id: 5,
      name: "Kylian Mbappé",
      position: "ST",
      team: match?.awayTeam || "PSG",
      forecasts: {
        goals: 1.1,
        assists: 0.4,
        rating: 8.3,
        shots: 4.5,
        passes: 28.7,
        passAccuracy: 0.82
      }
    },
    {
      id: 6,
      name: "Neymar Jr",
      position: "LW",
      team: match?.awayTeam || "PSG",
      forecasts: {
        goals: 0.7,
        assists: 0.9,
        rating: 8.0,
        shots: 3.8,
        passes: 52.3,
        passAccuracy: 0.88
      }
    },
    {
      id: 7,
      name: "Lionel Messi",
      position: "RW",
      team: match?.awayTeam || "PSG",
      forecasts: {
        goals: 0.8,
        assists: 0.7,
        rating: 8.2,
        shots: 3.5,
        passes: 58.2,
        passAccuracy: 0.92
      }
    },
    {
      id: 8,
      name: "Marco Verratti",
      position: "MID",
      team: match?.awayTeam || "PSG",
      forecasts: {
        goals: 0.1,
        assists: 0.4,
        rating: 7.6,
        shots: 1.2,
        passes: 72.1,
        passAccuracy: 0.94
      }
    }
  ];

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
            <h4 className="text-lg font-bold mb-6">Player Performance Forecasts</h4>
            
            {/* Team Toggle */}
            <div className="flex justify-center mb-6">
              <div className="flex bg-muted rounded-lg p-1">
                <button
                  onClick={() => setSelectedTeam("home")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedTeam === "home"
                      ? "bg-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {match.homeTeam}
                </button>
                <button
                  onClick={() => setSelectedTeam("away")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedTeam === "away"
                      ? "bg-white shadow-sm"
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
                    {mockPlayerForecasts
                      .filter(player => 
                        selectedTeam === "home" 
                          ? player.team === match.homeTeam 
                          : player.team === match.awayTeam
                      )
                      .map((player) => (
                        <div 
                          key={player.id} 
                          className="flex-none w-full sm:w-1/2 lg:w-1/3 xl:w-1/4 px-2"
                        >
                          <div className={`border rounded-xl p-4 h-full ${
                            player.team === match.homeTeam 
                              ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' 
                              : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'
                          }`}>
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                player.team === match.homeTeam 
                                  ? 'bg-blue-200' 
                                  : 'bg-purple-200'
                              }`}>
                                <span className={`text-lg font-bold ${
                                  player.team === match.homeTeam 
                                    ? 'text-blue-800' 
                                    : 'text-purple-800'
                                }`}>
                                  {player.name.split(' ').map((n: string) => n[0]).join('')}
                                </span>
                              </div>
                              <div className="flex-1">
                                <h5 className="font-semibold">{player.name}</h5>
                                <p className="text-xs text-muted-foreground">{player.team} • {player.position}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-3 mb-4">
                              <div className="flex justify-between text-sm">
                                <span>Goals</span>
                                <span className="font-medium">{player.forecasts.goals.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Assists</span>
                                <span className="font-medium">{player.forecasts.assists.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Rating</span>
                                <span className="font-medium">{player.forecasts.rating.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Shots</span>
                                <span className="font-medium">{player.forecasts.shots.toFixed(1)}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Make Your Pick</div>
                              <div className="grid grid-cols-2 gap-2">
                                <button className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                                  Over 0.5 Goals
                                </button>
                                <button className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                                  Under 0.5 Goals
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Carousel Navigation */}
                <button
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white shadow-lg rounded-full p-2 z-10 border border-border hover:bg-gray-50 transition-colors"
                  onClick={scrollPrev}
                  disabled={!canScrollPrev}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white shadow-lg rounded-full p-2 z-10 border border-border hover:bg-gray-50 transition-colors"
                  onClick={scrollNext}
                  disabled={!canScrollNext}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              /* Grid Container */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {mockPlayerForecasts
                  .filter(player => 
                    selectedTeam === "home" 
                      ? player.team === match.homeTeam 
                      : player.team === match.awayTeam
                  )
                  .map((player) => (
                    <div 
                      key={player.id} 
                      className={`border rounded-xl p-4 ${
                        player.team === match.homeTeam 
                          ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' 
                          : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          player.team === match.homeTeam 
                            ? 'bg-blue-200' 
                            : 'bg-purple-200'
                        }`}>
                          <span className={`text-lg font-bold ${
                            player.team === match.homeTeam 
                              ? 'text-blue-800' 
                              : 'text-purple-800'
                          }`}>
                            {player.name.split(' ').map((n: string) => n[0]).join('')}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold">{player.name}</h5>
                          <p className="text-xs text-muted-foreground">{player.team} • {player.position}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span>Goals</span>
                          <span className="font-medium">{player.forecasts.goals.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Assists</span>
                          <span className="font-medium">{player.forecasts.assists.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Rating</span>
                          <span className="font-medium">{player.forecasts.rating.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Shots</span>
                          <span className="font-medium">{player.forecasts.shots.toFixed(1)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Make Your Pick</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                            Over 0.5 Goals
                          </button>
                          <button className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                            Under 0.5 Goals
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
          </div>
        )}
      </div>
    </div>
  );
}
