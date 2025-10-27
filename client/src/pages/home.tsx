import { useQuery } from "@tanstack/react-query";
import { type Match } from "@shared/schema";
import { Header } from "@/components/header";
import { MatchCard } from "@/components/match-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

interface TeamsResponse {
  count: number;
  teams: string[];
}

export default function Home() {
  const { data: matches, isLoading } = useQuery<Match[]>({
    queryKey: ["/api/matches"],
  });

  const { data: teamsData, isLoading: teamsLoading } = useQuery<TeamsResponse>({
    queryKey: ["/api/teams/count"],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Filter only upcoming matches and calculate dynamic stats
  const upcomingMatches = useMemo(() => {
    if (!matches) return [];
    const now = new Date();
    console.log('🔍 DEBUG: Current time:', now.toISOString());
    console.log('🔍 DEBUG: Total matches received:', matches.length);
    
    const filtered = matches.filter(match => {
      try {
        console.log(`🔍 DEBUG: Match ${match.homeTeam} vs ${match.awayTeam}:`);
        console.log(`   Date: ${match.date}, Time: ${match.time}`);
        
        let matchDateTime: Date;
        
        // Handle different date formats
        if (match.date === "Today") {
          // Handle mock "Today" format
          const todayStr = new Date().toISOString().split('T')[0];
          const timeStr = match.time.replace(' CET', '').replace(' PM', '').replace(' AM', '');
          matchDateTime = new Date(`${todayStr}T${timeStr}:00.000Z`);
        } else if (match.date.includes('-')) {
          // Handle ISO format (YYYY-MM-DD)
          const timeStr = match.time.replace(' CET', '').replace(' PM', '').replace(' AM', '');
          const dateTimeString = `${match.date}T${timeStr}:00.000Z`;
          matchDateTime = new Date(dateTimeString);
        } else {
          // Handle old format (Oct 21)
          const currentYear = new Date().getFullYear();
          const timeStr = match.time.replace(' CET', '');
          const dateStr = `${match.date} ${currentYear} ${timeStr}`;
          matchDateTime = new Date(dateStr);
        }
        
        console.log(`   DateTime string created from: ${match.date} + ${match.time}`);
        
        // Check if date is valid
        if (isNaN(matchDateTime.getTime())) {
          console.log(`   ❌ Invalid date for match: ${match.homeTeam} vs ${match.awayTeam}`);
          return false;
        }
        
        const isUpcoming = matchDateTime >= now;
        console.log(`   Parsed: ${matchDateTime.toISOString()}`);
        console.log(`   Is upcoming: ${isUpcoming}`);
        return isUpcoming;
      } catch (error) {
        console.log(`   ❌ Error parsing date for match: ${match.homeTeam} vs ${match.awayTeam}`, error);
        return false;
      }
    }).sort((a, b) => {
      // Similar logic for sorting
      let dateA: Date, dateB: Date;
      
      try {
        if (a.date === "Today") {
          const todayStr = new Date().toISOString().split('T')[0];
          const timeStr = a.time.replace(' CET', '').replace(' PM', '').replace(' AM', '');
          dateA = new Date(`${todayStr}T${timeStr}:00.000Z`);
        } else if (a.date.includes('-')) {
          const timeStr = a.time.replace(' CET', '').replace(' PM', '').replace(' AM', '');
          dateA = new Date(`${a.date}T${timeStr}:00.000Z`);
        } else {
          const currentYear = new Date().getFullYear();
          const timeStr = a.time.replace(' CET', '');
          dateA = new Date(`${a.date} ${currentYear} ${timeStr}`);
        }
        
        if (b.date === "Today") {
          const todayStr = new Date().toISOString().split('T')[0];
          const timeStr = b.time.replace(' CET', '').replace(' PM', '').replace(' AM', '');
          dateB = new Date(`${todayStr}T${timeStr}:00.000Z`);
        } else if (b.date.includes('-')) {
          const timeStr = b.time.replace(' CET', '').replace(' PM', '').replace(' AM', '');
          dateB = new Date(`${b.date}T${timeStr}:00.000Z`);
        } else {
          const currentYear = new Date().getFullYear();
          const timeStr = b.time.replace(' CET', '');
          dateB = new Date(`${b.date} ${currentYear} ${timeStr}`);
        }
        
        return dateA.getTime() - dateB.getTime();
      } catch {
        return 0;
      }
    });
    
    console.log('🔍 DEBUG: Filtered upcoming matches:', filtered.length);
    return filtered;
  }, [matches]);

  // Get actual team count from API
  const activeTeamsCount = teamsData?.count || 0;

  // Get current stage from the most recent match
  const currentStage = useMemo(() => {
    return upcomingMatches.find(m => m.stage)?.stage || "League Phase";
  }, [upcomingMatches]);

  // Get today's fixtures
  const todayFixtures = useMemo(() => {
    if (!upcomingMatches) return [];
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    return upcomingMatches.filter(match => {
      return match.date === today;
    });
  }, [upcomingMatches]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="px-4 py-6 bg-gradient-to-br from-background via-card to-background">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 rounded-2xl p-6 border border-primary/30 glow-primary">
            <div className="flex items-center gap-2 mb-3">
              <span className="pulse-live w-2 h-2 bg-primary rounded-full"></span>
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Live Predictions
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Champions League Predictor</h2>
            <p className="text-muted-foreground text-sm md:text-base">
              AI-powered match outcomes & player performance forecasts
            </p>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="px-4 py-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            {teamsLoading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-bold text-secondary">{activeTeamsCount}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Teams Active</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            <p className="text-lg font-bold text-foreground">{currentStage}</p>
            <p className="text-xs text-muted-foreground mt-1">Current Stage</p>
          </div>
        </div>
      </section>

          {/* Match Fixtures */}
      <section className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">
              {todayFixtures.length > 0 ? "Today's Fixtures" : "Upcoming Fixtures"}
            </h3>
            <button 
              data-testid="button-view-all-matches"
              className="text-sm text-primary font-semibold hover:underline"
            >
              View All →
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-card rounded-2xl border border-border p-5">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <Skeleton className="h-20 rounded-full" />
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20 rounded-full" />
                  </div>
                  <Skeleton className="h-12" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(todayFixtures.length > 0 ? todayFixtures : upcomingMatches.slice(0, 5))?.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
              {upcomingMatches.length === 0 && (
                <div className="bg-card rounded-2xl border border-border p-8 text-center">
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold">No Upcoming Matches</h4>
                    <p className="text-muted-foreground">
                      Champions League fixtures are currently being updated. Check back soon for the latest match schedule.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Current stage: {currentStage} • Teams: {activeTeamsCount}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
