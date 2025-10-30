import { useQuery } from "@tanstack/react-query";
import { type Player } from "@shared/schema";
import { Header } from "@/components/header";
import { PlayerCard } from "@/components/player-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";

export default function Players() {
  const [selectedPosition, setSelectedPosition] = useState("ALL");
  const [selectedTeam, setSelectedTeam] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: players, isLoading } = useQuery<Player[]>({
    queryKey: ["/api/players"],
    queryFn: async () => {
      const res = await fetch("/api/players");
      return res.json();
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
  });

  // Extract unique teams for filter dropdown
  const uniqueTeams = useMemo(() => {
    if (!players) return [];
    const teamSet = new Set(players.map(p => p.team));
    const teams = Array.from(teamSet).sort();
    return teams;
  }, [players]);

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    if (!players) return [];
    
    let filtered = players.filter(player => {
      const matchesPosition = selectedPosition === "ALL" || player.position === selectedPosition;
      const matchesTeam = selectedTeam === "ALL" || player.team === selectedTeam;
      const matchesSearch = searchQuery === "" || 
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.team.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesPosition && matchesTeam && matchesSearch;
    });

    // Sort by position, then by expected contribution
    return filtered.sort((a, b) => {
      const positionOrder = { 'GK': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };
      const posA = positionOrder[a.position as keyof typeof positionOrder] || 5;
      const posB = positionOrder[b.position as keyof typeof positionOrder] || 5;
      
      if (posA !== posB) return posA - posB;
      return b.expectedContribution - a.expectedContribution;
    });
  }, [players, selectedPosition, selectedTeam, searchQuery]);

  const positions = [
    { value: "ALL", label: "All Positions" },
    { value: "GK", label: "Goalkeeper" },
    { value: "DEF", label: "Defender" },
    { value: "MID", label: "Midfielder" },
    { value: "FWD", label: "Forward" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card">
      <Header />

      <section className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-4">Player Performance Forecasts</h3>
            
            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players or teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((pos) => (
                    <SelectItem key={pos.value} value={pos.value}>
                      {pos.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Teams</SelectItem>
                  {uniqueTeams.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Results Count */}
            <p className="text-sm text-muted-foreground mb-4">
              {isLoading ? "Loading..." : `${filteredPlayers.length} players found`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-96 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPlayers.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
              {filteredPlayers.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-muted-foreground">No players found matching your criteria</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
