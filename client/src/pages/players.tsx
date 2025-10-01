import { useQuery } from "@tanstack/react-query";
import { type Player } from "@shared/schema";
import { Header } from "@/components/header";
import { PlayerCard } from "@/components/player-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function Players() {
  const [selectedPosition, setSelectedPosition] = useState("ALL");

  const { data: players, isLoading } = useQuery<Player[]>({
    queryKey: ["/api/players", { position: selectedPosition }],
    queryFn: async () => {
      const url = selectedPosition === "ALL" 
        ? "/api/players" 
        : `/api/players?position=${selectedPosition}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const positions = [
    { value: "ALL", label: "All" },
    { value: "GK", label: "GK" },
    { value: "DEF", label: "DEF" },
    { value: "MID", label: "MID" },
    { value: "FWD", label: "FWD" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card">
      <Header />

      <section className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Player Forecasts</h3>
            <div className="flex gap-2">
              {positions.map((pos) => (
                <button
                  key={pos.value}
                  data-testid={`filter-position-${pos.value.toLowerCase()}`}
                  onClick={() => setSelectedPosition(pos.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedPosition === pos.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-border"
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="overflow-x-auto hide-scrollbar pb-4">
              <div className="flex gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="min-w-[280px]">
                    <Skeleton className="h-96 rounded-2xl" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto hide-scrollbar pb-4">
              <div className="flex gap-4" style={{ minWidth: "min-content" }}>
                {players?.map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
