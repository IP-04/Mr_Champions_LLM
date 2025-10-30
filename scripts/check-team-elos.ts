import { db } from "../db";
import { teams } from "../shared/schema";
import { inArray } from "drizzle-orm";

async function checkTeamElos() {
  const teamNames = ['Arsenal', 'Chelsea', 'Slavia Praha', 'Qarabag', 'Villarreal', 'Bodo/Glimt', 'Real Madrid', 'Liverpool'];
  
  const teamData = await db.select({
    name: teams.name,
    elo: teams.elo
  })
  .from(teams)
  .where(inArray(teams.name, teamNames));
  
  console.log('Team ELO Ratings:');
  teamData.sort((a, b) => (b.elo || 0) - (a.elo || 0));
  teamData.forEach(t => {
    console.log(`${t.name}: ${t.elo || 'N/A'}`);
  });
  
  const maxElo = Math.max(...teamData.map(t => t.elo || 0));
  const minElo = Math.min(...teamData.map(t => t.elo || 0));
  console.log(`\nELO Range: ${minElo} - ${maxElo} (difference: ${maxElo - minElo})`);
}

checkTeamElos().then(() => process.exit(0));
