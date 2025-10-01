import { RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

export function RadarChart() {
  const data = [
    { subject: 'Goals', value: 85 },
    { subject: 'Assists', value: 70 },
    { subject: 'Passing', value: 92 },
    { subject: 'Dribbling', value: 88 },
    { subject: 'Defense', value: 45 },
    { subject: 'Physical', value: 78 },
  ];

  return (
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar data={data}>
          <PolarGrid stroke="hsl(0, 0%, 30%)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: 'hsl(0, 0%, 100%)', fontSize: 11 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fill: 'hsl(0, 0%, 76%)' }}
          />
          <Radar 
            name="Performance" 
            dataKey="value" 
            stroke="hsl(150, 100%, 50%)" 
            fill="hsl(150, 100%, 50%)" 
            fillOpacity={0.2}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
}
