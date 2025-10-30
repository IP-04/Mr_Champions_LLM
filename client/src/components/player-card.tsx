import { type Player } from "@shared/schema";
import { useState } from "react";
import { RadarChart } from "./radar-chart";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User } from "lucide-react";
import { motion } from "framer-motion";

interface PlayerCardProps {
  player: Player;
}

export function PlayerCard({ player }: PlayerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPick, setSelectedPick] = useState<"over" | "under" | null>(null);
  const [imageError, setImageError] = useState(false);
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
    FWD: { bg: "from-red-600 to-red-800", text: "text-red-400", border: "border-red-500" },
    MID: { bg: "from-green-600 to-green-800", text: "text-green-400", border: "border-green-500" },
    DEF: { bg: "from-blue-600 to-blue-800", text: "text-blue-400", border: "border-blue-500" },
    GK: { bg: "from-yellow-600 to-yellow-800", text: "text-yellow-400", border: "border-yellow-500" },
  };

  const positionColor = positionColors[player.position as keyof typeof positionColors] || positionColors.MID;

  return (
    <motion.div
      data-testid={`card-player-${player.id}`}
      onClick={() => setExpanded(!expanded)}
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative bg-gradient-to-t from-gray-900 via-gray-800 to-gray-700 rounded-2xl shadow-xl p-4 cursor-pointer overflow-hidden border border-gray-700 hover:border-gray-600 transition-all duration-300"
    >
      {/* FIFA-style card background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${positionColor.bg} opacity-10`} />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-full -translate-y-16 translate-x-16" />
      
      {/* Position Badge */}
      <div className={`absolute top-3 left-3 px-2 py-1 bg-gradient-to-r ${positionColor.bg} rounded text-white text-xs font-bold shadow-lg`}>
        {player.position}
      </div>

      {/* Rating Badge */}
      <div className="absolute top-3 right-3 flex flex-col items-center">
        <div className="text-yellow-400 text-xl font-bold">
          {player.expectedContribution.toFixed(1)}
        </div>
        <div className="text-xs text-gray-300">OVR</div>
      </div>

      {/* Player Image */}
      <div className="flex justify-center mt-8 mb-4">
        <div className={`relative w-20 h-20 rounded-full border-2 ${positionColor.border} overflow-hidden shadow-lg`}>
          {!imageError && (player.playerFaceUrl || player.imageUrl) ? (
            <img
              src={player.playerFaceUrl || player.imageUrl}
              alt={player.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gray-600 flex items-center justify-center">
              <User className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Player Info */}
      <div className="text-center mb-4">
        <h3 className="text-white font-bold text-lg mb-1">{player.name}</h3>
        <p className="text-gray-300 text-sm">{player.team}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">{player.statType}</div>
          <div className={`text-lg font-bold ${positionColor.text}`}>
            {player.stat90}
          </div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">Minutes</div>
          <div className="text-lg font-bold text-white">
            {player.predictedMinutes}'
          </div>
        </div>
      </div>

      {/* Performance Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Performance</span>
          <span>{player.statProbability}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${positionColor.bg} transition-all duration-500`}
            style={{ width: `${player.statProbability}%` }}
          />
        </div>
      </div>

      {/* Pick Buttons */}
      <div className="space-y-2">
        <div className="text-xs text-gray-400 text-center mb-2">Make Your Pick</div>
        <div className="flex gap-2">
          <button
            data-testid={`button-pick-over-${player.id}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePickToggle(true);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              selectedPick === "over"
                ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            Over 0.5
          </button>
          <button
            data-testid={`button-pick-under-${player.id}`}
            onClick={(e) => {
              e.stopPropagation();
              handlePickToggle(false);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              selectedPick === "under"
                ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200"
            }`}
          >
            Under 0.5
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 pt-4 border-t border-gray-600"
        >
          <div className="text-sm font-semibold mb-3 text-white">Recent Performance</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Last 5 Matches Avg</span>
              <span className="font-semibold text-white">{player.last5Avg} pts</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{player.statType} per 90min</span>
              <span className="font-semibold text-white">{player.stat90}</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold mb-2 text-white">Performance Radar</div>
            <div className="bg-black/20 rounded-lg p-3">
              <RadarChart player={player} />
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
