import { sofifaScraper } from "../server/services/sofifaPlaywrightScraper";

async function testScraper() {
  console.log('🧪 Testing SoFIFA Playwright Scraper\n');
  
  // Test with a known player - Mohamed Salah (Liverpool)
  const testUrl = 'https://sofifa.com/player/279173/franco-mastantuono/260007/';
  
  console.log(`📍 Scraping: ${testUrl}\n`);
  
  try {
    const playerData = await sofifaScraper.scrapePlayer(testUrl);
    
    if (!playerData) {
      console.log('❌ Failed to scrape player data');
      return;
    }
    
    console.log('\n✅ Successfully scraped player data!\n');
    console.log('=== BASIC INFO ===');
    console.log(`Name: ${playerData.name}`);
    console.log(`Age: ${playerData.age}`);
    console.log(`Height: ${playerData.height}`);
    console.log(`Weight: ${playerData.weight}`);
    console.log(`Player Face URL: ${playerData.player_face_url}`);
    
    console.log('\n=== RATINGS ===');
    console.log(`Overall: ${playerData.overall}`);
    console.log(`Potential: ${playerData.potential}`);
    console.log(`Value: €${playerData.value ? (playerData.value / 1000000).toFixed(1) + 'M' : 'N/A'}`);
    console.log(`Wage: €${playerData.wage ? (playerData.wage / 1000).toFixed(0) + 'K' : 'N/A'}`);
    
    console.log('\n=== PROFILE ===');
    console.log(`Preferred Foot: ${playerData.preferred_foot}`);
    console.log(`Weak Foot: ${playerData.weak_foot}`);
    console.log(`Skill Moves: ${playerData.skill_moves}`);
    console.log(`Work Rate: ${playerData.work_rate}`);
    
    console.log('\n=== CLUB ===');
    console.log(`Club: ${playerData.club_name}`);
    console.log(`Position: ${playerData.club_position}`);
    console.log(`Jersey Number: ${playerData.club_jersey_number}`);
    console.log(`Joined: ${playerData.club_joined}`);
    
    console.log('\n=== NATIONAL TEAM ===');
    console.log(`Country: ${playerData.country_name}`);
    console.log(`Position: ${playerData.country_position}`);
    
    console.log('\n=== ATTACKING STATS ===');
    console.log(`Crossing: ${playerData.attacking_crossing}`);
    console.log(`Finishing: ${playerData.attacking_finishing}`);
    console.log(`Heading Accuracy: ${playerData.attacking_heading_accuracy}`);
    console.log(`Short Passing: ${playerData.attacking_short_passing}`);
    console.log(`Volleys: ${playerData.attacking_volleys}`);
    
    console.log('\n=== SKILL STATS ===');
    console.log(`Dribbling: ${playerData.skill_dribbling}`);
    console.log(`Curve: ${playerData.skill_curve}`);
    console.log(`FK Accuracy: ${playerData.skill_fk_accuracy}`);
    console.log(`Long Passing: ${playerData.skill_long_passing}`);
    console.log(`Ball Control: ${playerData.skill_ball_control}`);
    
    console.log('\n=== MOVEMENT STATS ===');
    console.log(`Acceleration: ${playerData.movement_acceleration}`);
    console.log(`Sprint Speed: ${playerData.movement_sprint_speed}`);
    console.log(`Agility: ${playerData.movement_agility}`);
    console.log(`Reactions: ${playerData.movement_reactions}`);
    console.log(`Balance: ${playerData.movement_balance}`);
    
    console.log('\n=== POWER STATS ===');
    console.log(`Shot Power: ${playerData.power_shot_power}`);
    console.log(`Jumping: ${playerData.power_jumping}`);
    console.log(`Stamina: ${playerData.power_stamina}`);
    console.log(`Strength: ${playerData.power_strength}`);
    console.log(`Long Shots: ${playerData.power_long_shots}`);
    
    console.log('\n=== MENTALITY STATS ===');
    console.log(`Aggression: ${playerData.mentality_aggression}`);
    console.log(`Interceptions: ${playerData.mentality_interceptions}`);
    console.log(`Positioning: ${playerData.mentality_att_positioning}`);
    console.log(`Vision: ${playerData.mentality_vision}`);
    console.log(`Penalties: ${playerData.mentality_penalties}`);
    console.log(`Composure: ${playerData.mentality_composure}`);
    
    console.log('\n=== DEFENDING STATS ===');
    console.log(`Defensive Awareness: ${playerData.defending_defensive_awareness}`);
    console.log(`Standing Tackle: ${playerData.defending_standing_tackle}`);
    console.log(`Sliding Tackle: ${playerData.defending_sliding_tackle}`);
    
    if (playerData.specialities) {
      console.log('\n=== SPECIALITIES ===');
      console.log(playerData.specialities);
    }
    
    if (playerData.play_styles) {
      console.log('\n=== PLAY STYLES ===');
      console.log(playerData.play_styles);
    }
    
    // Calculate FIFA 6 main attributes
    console.log('\n=== FIFA 6 MAIN ATTRIBUTES ===');
    const pace = playerData.fifa_pace || Math.round(((playerData.movement_acceleration || 0) + (playerData.movement_sprint_speed || 0)) / 2);
    const shooting = playerData.fifa_shooting || Math.round(((playerData.attacking_finishing || 0) + (playerData.power_shot_power || 0)) / 2);
    const passing = playerData.fifa_passing || Math.round(((playerData.attacking_short_passing || 0) + (playerData.skill_long_passing || 0)) / 2);
    const dribbling = playerData.fifa_dribbling || Math.round(((playerData.skill_dribbling || 0) + (playerData.skill_ball_control || 0)) / 2);
    const defending = playerData.fifa_defending || Math.round(((playerData.defending_defensive_awareness || 0) + (playerData.defending_standing_tackle || 0)) / 2);
    const physical = playerData.fifa_physical || Math.round(((playerData.power_strength || 0) + (playerData.power_stamina || 0)) / 2);
    
    console.log(`⚡ Pace: ${pace}`);
    console.log(`🎯 Shooting: ${shooting}`);
    console.log(`📊 Passing: ${passing}`);
    console.log(`⚽ Dribbling: ${dribbling}`);
    console.log(`🛡️ Defending: ${defending}`);
    console.log(`💪 Physical: ${physical}`);
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await sofifaScraper.close();
    console.log('\n🏁 Test completed');
  }
}

// Run test
testScraper();
