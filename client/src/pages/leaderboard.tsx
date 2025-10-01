import { useQuery } from "@tanstack/react-query";
import { type LeaderboardEntry } from "@shared/schema";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Leaderboard</h3>
            <button 
              data-testid="button-view-all-leaderboard"
              className="text-sm text-primary font-semibold hover:underline"
            >
              View All →
            </button>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/20 to-secondary/20 p-4 border-b border-border">
              <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-muted-foreground">
                <span>Rank</span>
                <span>User</span>
                <span>Accuracy</span>
                <span>Points</span>
              </div>
            </div>

            {/* Entries */}
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              leaderboard?.map((entry) => (
                <div
                  key={entry.id}
                  data-testid={`leaderboard-entry-${entry.rank}`}
                  className={`p-4 border-b border-border hover:bg-muted/50 transition-colors ${
                    entry.username === "You" ? "bg-primary/10 border-t border-primary/30" : ""
                  }`}
                >
                  <div className="grid grid-cols-4 gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          entry.rank <= 3
                            ? "bg-gradient-to-br from-primary to-secondary"
                            : entry.username === "You"
                            ? "bg-primary/30"
                            : "bg-muted"
                        }`}
                      >
                        {entry.rank}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src={entry.avatarUrl}
                        alt={entry.username}
                        className={`w-8 h-8 rounded-full ${
                          entry.username === "You" ? "border-2 border-primary" : ""
                        }`}
                      />
                      <span
                        className={`text-sm font-semibold ${
                          entry.username === "You" ? "text-primary" : ""
                        }`}
                      >
                        {entry.username}
                      </span>
                    </div>
                    <span
                      data-testid={`text-accuracy-${entry.rank}`}
                      className={`text-sm font-bold ${
                        entry.rank === 1
                          ? "text-primary"
                          : entry.rank === 2
                          ? "text-secondary"
                          : entry.username === "You"
                          ? "text-primary"
                          : ""
                      }`}
                    >
                      {entry.accuracy}%
                    </span>
                    <span
                      data-testid={`text-points-${entry.rank}`}
                      className={`text-sm font-bold ${
                        entry.username === "You" ? "text-primary" : ""
                      }`}
                    >
                      {entry.points}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
