import { db } from "../db";
import { players } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { chromium } from 'playwright';

interface SofifaSearchResult {
  name: string;
  url: string;
  team: string;
  overall: number;
}

class SofifaSearcher {
  private browser: any = null;
  private context: any = null;

  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ]
    });
    
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
  }

  async close() {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  async searchPlayer(playerName: string, playerTeam: string): Promise<string | null> {
    if (!this.context) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    const page = await this.context.newPage();
    
    // Block resources for speed
    await page.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
    try {
      const searchUrl = `https://sofifa.com/players?keyword=${encodeURIComponent(playerName)}`;
      console.log(`  🔍 Searching: ${searchUrl}`);
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Check for Cloudflare
      const content = await page.content();
      if (content.includes('Checking your browser')) {
        console.log('  ⏳ Waiting for Cloudflare...');
        await page.waitForTimeout(10000);
      }
      
      // Check if we landed directly on a player page (SoFIFA does this for exact matches)
      const currentUrl = page.url();
      if (currentUrl.includes('/player/')) {
        console.log(`  ✅ Direct match found at ${currentUrl}`);
        await page.close();
        return currentUrl;
      }
      
      // Otherwise, extract search results from table
      const results = await page.evaluate(() => {
        const rows = document.querySelectorAll('table.table tbody tr');
        const players = [];
        
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const row = rows[i];
          const link = row.querySelector('td a[href*="/player/"]');
          const teamCell = row.querySelector('td a[href*="/team/"]');
          const overallCell = row.querySelector('td em');
          
          if (link) {
            players.push({
              name: link.textContent?.trim() || '',
              url: 'https://sofifa.com' + link.getAttribute('href'),
              team: teamCell?.textContent?.trim() || '',
              overall: overallCell ? parseInt(overallCell.textContent?.trim() || '0') : 0
            });
          }
        }
        
        return players;
      });
      
      console.log(`  📊 Found ${results.length} results`);
      
      if (results.length === 0) {
        await page.close();
        return null;
      }
      
      // Try to find best match
      // 1. Exact name match
      let bestMatch = results.find(r => 
        r.name.toLowerCase() === playerName.toLowerCase()
      );
      
      // 2. Name contains search term or search term contains name
      if (!bestMatch) {
        bestMatch = results.find(r => 
          r.name.toLowerCase().includes(playerName.toLowerCase()) ||
          playerName.toLowerCase().includes(r.name.toLowerCase())
        );
      }
      
      // 3. Same team
      if (!bestMatch && playerTeam) {
        bestMatch = results.find(r => 
          r.team.toLowerCase().includes(playerTeam.toLowerCase()) ||
          playerTeam.toLowerCase().includes(r.team.toLowerCase())
        );
      }
      
      // 4. Just take first result
      if (!bestMatch) {
        bestMatch = results[0];
      }
      
      console.log(`  ✅ Matched: ${bestMatch.name} (${bestMatch.team}) - OVR ${bestMatch.overall}`);
      
      await page.close();
      return bestMatch.url;
      
    } catch (error) {
      console.error(`  ❌ Error searching for ${playerName}:`, error.message);
      await page.close();
      return null;
    }
  }
}

async function searchPlayerOnSofifa(playerName: string, playerTeam: string): Promise<string | null> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });
  
  const page = await context.newPage();
  
  // Block resources for speed
  await page.route('**/*', route => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });
  
  try {
    const searchUrl = `https://sofifa.com/players?keyword=${encodeURIComponent(playerName)}`;
    console.log(`  🔍 Searching: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Check for Cloudflare
    const content = await page.content();
    if (content.includes('Checking your browser')) {
      console.log('  ⏳ Waiting for Cloudflare...');
      await page.waitForTimeout(10000);
    }
    
    // Check if we landed directly on a player page (SoFIFA does this for exact matches)
    const currentUrl = page.url();
    if (currentUrl.includes('/player/')) {
      console.log(`  ✅ Direct match found at ${currentUrl}`);
      await browser.close();
      return currentUrl;
    }
    
    // Otherwise, extract search results from table
    const results = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.table tbody tr');
      const players = [];
      
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const row = rows[i];
        const link = row.querySelector('td a[href*="/player/"]');
        const teamCell = row.querySelector('td a[href*="/team/"]');
        const overallCell = row.querySelector('td em');
        
        if (link) {
          players.push({
            name: link.textContent?.trim() || '',
            url: 'https://sofifa.com' + link.getAttribute('href'),
            team: teamCell?.textContent?.trim() || '',
            overall: overallCell ? parseInt(overallCell.textContent?.trim() || '0') : 0
          });
        }
      }
      
      return players;
    });
    
    console.log(`  📊 Found ${results.length} results`);
    
    if (results.length === 0) {
      await browser.close();
      return null;
    }
    
    // Try to find best match
    // 1. Exact name match
    let bestMatch = results.find(r => 
      r.name.toLowerCase() === playerName.toLowerCase()
    );
    
    // 2. Name contains search term or search term contains name
    if (!bestMatch) {
      bestMatch = results.find(r => 
        r.name.toLowerCase().includes(playerName.toLowerCase()) ||
        playerName.toLowerCase().includes(r.name.toLowerCase())
      );
    }
    
    // 3. Same team
    if (!bestMatch && playerTeam) {
      bestMatch = results.find(r => 
        r.team.toLowerCase().includes(playerTeam.toLowerCase()) ||
        playerTeam.toLowerCase().includes(r.team.toLowerCase())
      );
    }
    
    // 4. Just take first result
    if (!bestMatch) {
      bestMatch = results[0];
    }
    
    console.log(`  ✅ Matched: ${bestMatch.name} (${bestMatch.team}) - OVR ${bestMatch.overall}`);
    
    await browser.close();
    return bestMatch.url;
    
  } catch (error) {
    console.error(`  ❌ Error searching for ${playerName}:`, error);
    await browser.close();
    return null;
  }
}

async function assignSofifaUrls() {
  console.log('🔗 Assigning SoFIFA URLs to Top 15 Players per Team\n');
  
  const searcher = new SofifaSearcher();
  
  try {
    console.log('🌐 Initializing browser...');
    await searcher.init();
    
    // Get all players grouped by team
    const allPlayers = await db.select().from(players);
    
    if (allPlayers.length === 0) {
      console.log('No players found in database');
      await searcher.close();
      return;
    }
    
    // Group players by team
    const playersByTeam = allPlayers.reduce((acc, player) => {
      if (!acc[player.team]) {
        acc[player.team] = [];
      }
      acc[player.team].push(player);
      return acc;
    }, {} as Record<string, typeof allPlayers>);
    
    console.log(`📋 Found ${Object.keys(playersByTeam).length} teams\n`);
    
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    
    // Process each team
    for (const [team, teamPlayers] of Object.entries(playersByTeam)) {
      console.log(`\n🏆 Processing ${team} (${teamPlayers.length} players)`);
      
      // Sort by expectedContribution (most important players first)
      const sortedPlayers = teamPlayers
        .sort((a, b) => b.expectedContribution - a.expectedContribution)
        .slice(0, 15); // Top 15 only
      
      console.log(`  📌 Selected top ${sortedPlayers.length} players\n`);
      
      for (const player of sortedPlayers) {
        // Skip if already has URL
        if (player.sofifaUrl) {
          console.log(`  ⏭️  ${player.name} - Already has URL, skipping`);
          totalSkipped++;
          continue;
        }
        
        console.log(`  🔄 Processing: ${player.name}`);
        
        // Search for player on SoFIFA
        const sofifaUrl = await searcher.searchPlayer(player.name, player.team);
        
        if (sofifaUrl) {
          // Update player with SoFIFA URL
          await db.update(players)
            .set({ sofifaUrl: sofifaUrl })
            .where(eq(players.id, player.id));
          
          console.log(`  💾 Saved URL for ${player.name}`);
          totalUpdated++;
        } else {
          console.log(`  ⚠️  Could not find URL for ${player.name}`);
          totalFailed++;
        }
        
        // Rate limiting: 3-5 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
      }
    }
    
    console.log('\n\n📈 Summary:');
    console.log(`  ✅ URLs assigned: ${totalUpdated}`);
    console.log(`  ⏭️  Skipped (already had URL): ${totalSkipped}`);
    console.log(`  ❌ Failed to find: ${totalFailed}`);
    console.log(`\n✨ Done! You can now run the sync to fetch player stats.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await searcher.close();
  }
}

// Run the script
assignSofifaUrls();
