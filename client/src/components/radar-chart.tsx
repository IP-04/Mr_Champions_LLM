import { RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { type Player } from "@shared/schema";

interface RadarChartProps {
  player?: Player;
}

export function RadarChart({ player }: RadarChartProps) {
  // Generate position-specific radar data based on player stats
  const generateRadarData = (player?: Player) => {
    if (!player) {
      // Fallback data
      return [
        { subject: 'Goals', value: 75 },
        { subject: 'Assists', value: 65 },
        { subject: 'Passing', value: 85 },
        { subject: 'Defense', value: 60 },
        { subject: 'Physical', value: 70 },
        { subject: 'Mental', value: 80 },
      ];
    }

    const baseValue = player.expectedContribution * 8; // Scale to 0-100
    const variance = 15; // Add some variance for realism
    
    // Position-specific stat emphasis
    const positionMultipliers = {
      FWD: { Goals: 1.3, Assists: 1.1, Passing: 0.9, Defense: 0.6, Physical: 1.0, Mental: 1.1 },
      MID: { Goals: 0.8, Assists: 1.2, Passing: 1.3, Defense: 1.0, Physical: 0.9, Mental: 1.2 },
      DEF: { Goals: 0.5, Assists: 0.7, Passing: 1.1, Defense: 1.4, Physical: 1.2, Mental: 1.1 },
      GK: { Goals: 0.2, Assists: 0.3, Passing: 0.8, Defense: 1.3, Physical: 1.0, Mental: 1.3 },
    };

    const multipliers = positionMultipliers[player.position as keyof typeof positionMultipliers] || positionMultipliers.MID;

    return [
      { 
        subject: 'Goals', 
        value: Math.min(100, Math.max(0, baseValue * multipliers.Goals + (Math.random() - 0.5) * variance))
      },
      { 
        subject: 'Assists', 
        value: Math.min(100, Math.max(0, baseValue * multipliers.Assists + (Math.random() - 0.5) * variance))
      },
      { 
        subject: 'Passing', 
        value: Math.min(100, Math.max(0, baseValue * multipliers.Passing + (Math.random() - 0.5) * variance))
      },
      { 
        subject: 'Defense', 
        value: Math.min(100, Math.max(0, baseValue * multipliers.Defense + (Math.random() - 0.5) * variance))
      },
      { 
        subject: 'Physical', 
        value: Math.min(100, Math.max(0, baseValue * multipliers.Physical + (Math.random() - 0.5) * variance))
      },
      { 
        subject: 'Mental', 
        value: Math.min(100, Math.max(0, baseValue * multipliers.Mental + (Math.random() - 0.5) * variance))
      },
    ].map(item => ({ ...item, value: Math.round(item.value) }));
  };

  const data = generateRadarData(player);

  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar data={data}>
          <PolarGrid stroke="hsl(0, 0%, 30%)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: 'hsl(0, 0%, 100%)', fontSize: 10 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fill: 'hsl(0, 0%, 76%)', fontSize: 8 }}
          />
          <Radar 
            name="Performance" 
            dataKey="value" 
            stroke="hsl(142, 76%, 36%)" 
            fill="hsl(142, 76%, 36%)" 
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
}
