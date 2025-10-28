import { playerDataScraper } from '../server/services/playerDataScraper.js';

async function testScraper() {
  console.log('🧪 Testing SoFIFA scraper...\n');
  
  try {
    // Test with a single popular player
    const testPlayer = { name: 'Erling Haaland', team: 'Manchester City' };
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${testPlayer.name} (${testPlayer.team})`);
    console.log('='.repeat(60));
    
    const stats = await playerDataScraper.searchPlayer(testPlayer.name, testPlayer.team);
    
    if (stats) {
      console.log('\n✅ SUCCESS!');
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log('\n❌ FAILED to fetch player data');
    }
    
    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testScraper();
