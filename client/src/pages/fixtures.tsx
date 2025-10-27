import { useQuery } from "@tanstack/react-query";
import { type Match } from "@shared/schema";
import { Header } from "@/components/header";
import { MatchCard } from "@/components/match-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { isMatchUpcoming, compareMatchesByDate } from "@/lib/dateUtils";

export default function Fixtures() {
  const { data: matches, isLoading } = useQuery<Match[]>({
    queryKey: ["/api/matches"],
  });

  // Filter and sort upcoming matches
  const upcomingMatches = useMemo(() => {
    if (!matches) return [];
    
    return matches
      .filter(match => isMatchUpcoming(match.date, match.time))
      .sort(compareMatchesByDate);
  }, [matches]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Page Header */}
      <section className="px-4 py-6 bg-gradient-to-br from-background via-card to-background">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 rounded-2xl p-6 border border-primary/30 glow-primary">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">All Upcoming Fixtures</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Complete Champions League match schedule with AI-powered predictions
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" data-testid="indicator-live"></div>
                <span className="text-xs text-muted-foreground">{upcomingMatches.length} Upcoming Matches</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* All Fixtures */}
      <section className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
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
              {upcomingMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
              {upcomingMatches.length === 0 && (
                <div className="bg-card rounded-2xl border border-border p-8 text-center">
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold">No Upcoming Matches</h4>
                    <p className="text-muted-foreground">
                      Champions League fixtures are currently being updated. Check back soon for the latest match schedule.
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
