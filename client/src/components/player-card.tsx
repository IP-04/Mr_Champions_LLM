import { type Player } from "@shared/schema";
import { useState } from "react";
import { RadarChart } from "./radar-chart";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PlayerCardProps {
  player: Player;
}

export function PlayerCard({ player }: PlayerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPick, setSelectedPick] = useState<"over" | "under" | null>(null);
  const queryClient = useQueryClient();

  const pickMutation = useMutation({
    mutationFn: async (isOver: boolean) => {
      if (selectedPick) {
        // Remove existing pick
        const picks = await fetch("/api/picks").then(r => r.json());
        const existingPick = picks.find((p: any) => p.playerId === player.id);
        if (existingPick) {
          await apiRequest("DELETE", `/api/picks/${existingPick.id}`);
        }
      }
      
      return apiRequest("POST", "/api/picks", {
        playerId: player.id,
        pickType: player.statType,
        statLine: 0.5,
        isOver,
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/picks"] });
    },
  });

  const handlePickToggle = (isOver: boolean) => {
    const newPick = selectedPick === (isOver ? "over" : "under") ? null : (isOver ? "over" : "under");
    setSelectedPick(newPick);
    if (newPick) {
      pickMutation.mutate(isOver);
    }
  };

  const positionColors = {
    FWD: "primary",
    MID: "secondary",
    DEF: "primary",
    GK: "secondary",
  };

  const positionColor = positionColors[player.position as keyof typeof positionColors] || "primary";

  return (
    <div
      data-testid={`card-player-${player.id}`}
      onClick={() => setExpanded(!expanded)}
      className="bg-card rounded-2xl border border-border p-5 hover:transform hover:-translate-y-1 transition-all duration-300 cursor-pointer min-w-[280px]"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={player.imageUrl}
            alt={player.name}
            className={`w-14 h-14 rounded-full object-cover border-2 border-${positionColor}`}
          />
          <div>
            <p className="font-bold">{player.name}</p>
            <p className="text-xs text-muted-foreground">
              {player.team} • {player.position}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 bg-${positionColor}/20 text-${positionColor} text-xs font-bold rounded`}>
          {player.position}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Expected Contribution</span>
          <span className={`text-sm font-bold text-${positionColor}`}>
            {player.expectedContribution} pts
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r from-${positionColor} to-secondary transition-all duration-500`}
            style={{ width: `${player.expectedContribution * 10}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-muted rounded-lg p-2">
          <p className="text-xs text-muted-foreground">Predicted Minutes</p>
          <p className="text-lg font-bold">{player.predictedMinutes}'</p>
        </div>
        <div className="bg-muted rounded-lg p-2">
          <p className="text-xs text-muted-foreground">{player.statType} Probability</p>
          <p className="text-lg font-bold">{player.statProbability}%</p>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground mb-2">Make Your Pick</p>
        <div className="flex gap-2">
          <button
            data-testid={`button-pick-over-${player.id}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePickToggle(true);
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              selectedPick === "over"
                ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg"
                : "bg-muted hover:bg-border"
            }`}
          >
            Over 0.5 {player.statType}
          </button>
          <button
            data-testid={`button-pick-under-${player.id}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePickToggle(false);
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              selectedPick === "under"
                ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg"
                : "bg-muted hover:bg-border"
            }`}
          >
            Under 0.5 {player.statType}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm font-semibold mb-3">Recent Performance</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Last 5 Matches Avg</span>
              <span className="font-semibold">{player.last5Avg} pts</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{player.statType} per 90min</span>
              <span className="font-semibold">{player.stat90}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold mb-2">Performance Radar</p>
            <RadarChart />
          </div>
        </div>
      )}
    </div>
  );
}
