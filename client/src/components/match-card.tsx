import { type Match } from "@shared/schema";
import { useLocation } from "wouter";

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const [, setLocation] = useLocation();

  return (
    <div
      data-testid={`card-match-${match.id}`}
      onClick={() => setLocation(`/match/${match.id}`)}
      className="bg-card rounded-2xl border border-border p-5 hover:transform hover:-translate-y-1 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="stage-badge">{match.stage}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {match.time}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 items-center mb-4">
        <div className="flex flex-col items-center">
          <img
            src={match.homeTeamCrest}
            alt={`${match.homeTeam} crest`}
            className="w-16 h-16 rounded-full mb-2 object-cover border-2 border-primary/30"
          />
          <p className="text-sm font-semibold text-center">{match.homeTeam}</p>
          <p className="text-xs text-muted-foreground">Home</p>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-muted-foreground mb-1">vs</span>
          <div className="bg-muted rounded-lg px-3 py-1">
            <span className="text-xs font-mono font-semibold">- : -</span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <img
            src={match.awayTeamCrest}
            alt={`${match.awayTeam} crest`}
            className="w-16 h-16 rounded-full mb-2 object-cover border-2 border-secondary/30"
          />
          <p className="text-sm font-semibold text-center">{match.awayTeam}</p>
          <p className="text-xs text-muted-foreground">Away</p>
        </div>
      </div>

      <div className="bg-muted rounded-lg p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Venue:</span>
          <span className="font-semibold">{match.venue}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">AI Prediction</span>
          <span 
            data-testid={`text-prediction-${match.id}`}
            className="text-xs font-semibold text-primary"
          >
            Win {match.homeWinProb}% | Draw {match.drawProb}% | Loss {match.awayWinProb}%
          </span>
        </div>
      </div>
    </div>
  );
}
