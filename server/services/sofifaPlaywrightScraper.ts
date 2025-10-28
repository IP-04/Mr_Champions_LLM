import { chromium, Browser, Page } from 'playwright';

interface PlayerStats {
  // Basic Info
  player_id?: string;
  name?: string;
  age?: string;
  height?: string;
  weight?: string;
  birth_date?: string;
  player_face_url?: string;
  url?: string;
  
  // Ratings
  overall?: number;
  potential?: number;
  value?: number;
  wage?: number;
  release_clause?: number;
  
  // Profile
  preferred_foot?: string;
  weak_foot?: string;
  skill_moves?: string;
  work_rate?: string;
  body_type?: string;
  real_face?: string;
  
  // Club
  club_name?: string;
  club_id?: string;
  club_logo?: string;
  club_position?: string;
  club_jersey_number?: string;
  club_joined?: string;
  club_contract_valid_until?: string;
  
  // National Team
  country_name?: string;
  country_id?: string;
  country_flag?: string;
  country_position?: string;
  
  // Stats - Attacking
  attacking_crossing?: number;
  attacking_finishing?: number;
  attacking_heading_accuracy?: number;
  attacking_short_passing?: number;
  attacking_volleys?: number;
  
  // Stats - Skill
  skill_dribbling?: number;
  skill_curve?: number;
  skill_fk_accuracy?: number;
  skill_long_passing?: number;
  skill_ball_control?: number;
  
  // Stats - Movement
  movement_acceleration?: number;
  movement_sprint_speed?: number;
  movement_agility?: number;
  movement_reactions?: number;
  movement_balance?: number;
  
  // Stats - Power
  power_shot_power?: number;
  power_jumping?: number;
  power_stamina?: number;
  power_strength?: number;
  power_long_shots?: number;
  
  // Stats - Mentality
  mentality_aggression?: number;
  mentality_interceptions?: number;
  mentality_att_positioning?: number;
  mentality_vision?: number;
  mentality_penalties?: number;
  mentality_composure?: number;
  
  // Stats - Defending
  defending_defensive_awareness?: number;
  defending_standing_tackle?: number;
  defending_sliding_tackle?: number;
  
  // Stats - Goalkeeping
  goalkeeping_gk_diving?: number;
  goalkeeping_gk_handling?: number;
  goalkeeping_gk_kicking?: number;
  goalkeeping_gk_positioning?: number;
  goalkeeping_gk_reflexes?: number;
  
  // Other
  specialities?: string;
  play_styles?: string;
  
  [key: string]: any;
}

export class SofifaPlaywrightScraper {
  private browser: Browser | null = null;
  
  /**
   * Initialize the browser instance
   */
  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
        ]
      });
    }
  }
  
  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  
  /**
   * Extract player ID from SoFIFA URL
   */
  private extractPlayerId(url: string): string {
    const match = url.match(/\/player\/(\d+)/);
    return match ? match[1] : '';
  }
  
  /**
   * Clean text by removing extra whitespace
   */
  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
  
  /**
   * Extract number from text
   */
  private extractNumber(text: string): number {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }
  
  /**
   * Parse monetary value (e.g., "€22M" -> 22000000)
   */
  private parseValue(text: string): number {
    if (!text) return 0;
    
    const cleanedText = text.replace(/[€£$,]/g, '').trim();
    
    if (cleanedText.includes('M')) {
      return parseFloat(cleanedText.replace('M', '')) * 1000000;
    } else if (cleanedText.includes('K')) {
      return parseFloat(cleanedText.replace('K', '')) * 1000;
    }
    
    return parseFloat(cleanedText) || 0;
  }
  
  /**
   * Setup page with resource blocking and anti-detection
   */
  private async setupPage(page: Page): Promise<void> {
    // Set user agent
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    
    // Block unnecessary resources for faster scraping
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }
  
  /**
   * Navigate to URL with Cloudflare retry logic
   */
  private async navigateWithRetry(page: Page, url: string, maxRetries: number = 5): Promise<boolean> {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        const content = await page.content();
        
        // Check for Cloudflare challenge
        if (
          content.includes('Checking your browser') ||
          content.includes('Just a moment') ||
          content.includes('cf-browser-verification')
        ) {
          console.log(`Cloudflare challenge detected, waiting... (attempt ${retries + 1}/${maxRetries})`);
          await page.waitForTimeout(10000);
          retries++;
          continue;
        }
        
        // Success - page loaded
        return true;
      } catch (error) {
        console.error(`Navigation error (attempt ${retries + 1}/${maxRetries}):`, error);
        retries++;
        
        if (retries >= maxRetries) {
          return false;
        }
        
        await page.waitForTimeout(5000);
      }
    }
    
    return false;
  }
  
  /**
   * Scrape a single player from SoFIFA
   */
  async scrapePlayer(playerUrl: string): Promise<PlayerStats | null> {
    await this.init();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    try {
      await this.setupPage(page);
      
      console.log(`Scraping player: ${playerUrl}`);
      
      const success = await this.navigateWithRetry(page, playerUrl);
      
      if (!success) {
        console.error('Failed to navigate to player page after retries');
        return null;
      }
      
      // Extract all player data using page.evaluate with inline script
      const playerData: any = await page.evaluate(`(function() {
        var data = {};
        
        // Helper functions
        function cleanText(text) {
          if (!text) return '';
          return text.replace(/\s+/g, ' ').trim();
        }
        
        function extractNumber(text) {
          if (!text) return 0;
          var match = text.match(/\\d+/);
          return match ? parseInt(match[0]) : 0;
        }
        
        function parseValue(text) {
          if (!text) return 0;
          var cleanedText = text.replace(/[€£$,]/g, '').trim();
          if (cleanedText.includes('M')) {
            return parseFloat(cleanedText.replace('M', '')) * 1000000;
          } else if (cleanedText.includes('K')) {
            return parseFloat(cleanedText.replace('K', '')) * 1000;
          }
          return parseFloat(cleanedText) || 0;
        }
        
        // Extract from JSON-LD schema
        var jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript && jsonLdScript.textContent) {
          try {
            var jsonLd = JSON.parse(jsonLdScript.textContent);
            data.name = jsonLd.name || '';
            data.player_face_url = jsonLd.image || '';
            
            if (jsonLd.description) {
              var birthMatch = jsonLd.description.match(/born (\\d{1,2} \\w+ \\d{4})/i);
              if (birthMatch) {
                data.birth_date = birthMatch[1];
              }
            }
          } catch (e) {
            console.error('Failed to parse JSON-LD:', e);
          }
        }
        
        // Extract from meta description
        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          var content = metaDesc.getAttribute('content') || '';
          
          var ageMatch = content.match(/(\\d+) years old/);
          if (ageMatch) data.age = ageMatch[1];
          
          var heightMatch = content.match(/(\\d+cm)/);
          if (heightMatch) data.height = heightMatch[1];
          
          var weightMatch = content.match(/(\\d+kg)/);
          if (weightMatch) data.weight = weightMatch[1];
        }
        
        // Extract sections
        var sections = document.querySelectorAll('div[class*="col"]');
        
        for (var i = 0; i < sections.length; i++) {
          var col = sections[i];
          var heading = col.querySelector('h5');
          if (!heading) continue;
          
          var section = cleanText(heading.textContent).toLowerCase();
          
          if (section === 'profile') {
            var labels = col.querySelectorAll('p');
            for (var j = 0; j < labels.length; j++) {
              var p = labels[j];
              var labelEl = p.querySelector('label');
              if (!labelEl) continue;
              
              var labelText = cleanText(labelEl.textContent).toLowerCase();
              var valueText = cleanText(p.textContent.replace(labelEl.textContent, ''));
              
              if (labelText.includes('preferred foot')) {
                data.preferred_foot = valueText;
              } else if (labelText.includes('weak foot')) {
                data.weak_foot = valueText;
              } else if (labelText.includes('skill moves')) {
                data.skill_moves = valueText;
              } else if (labelText.includes('work rate')) {
                data.work_rate = valueText;
              } else if (labelText.includes('value') && !labelText.includes('release')) {
                data.value = parseValue(valueText);
              } else if (labelText.includes('wage')) {
                data.wage = parseValue(valueText);
              } else if (labelText.includes('release clause')) {
                data.release_clause = parseValue(valueText);
              }
            }
          } else if (section === 'club') {
            var teamLink = col.querySelector('a[href*="/team/"]');
            if (teamLink) {
              data.club_name = cleanText(teamLink.textContent);
              var teamHref = teamLink.getAttribute('href');
              if (teamHref) {
                var teamIdMatch = teamHref.match(/\\/team\\/(\\d+)\\//);
                data.club_id = teamIdMatch ? teamIdMatch[1] : '';
              }
              
              var logoImg = teamLink.querySelector('img');
              if (logoImg) {
                var logoSrc = logoImg.getAttribute('data-src') || logoImg.getAttribute('src');
                data.club_logo = logoSrc || '';
              }
            }
            
            var clubLabels = col.querySelectorAll('p');
            for (var k = 0; k < clubLabels.length; k++) {
              var p = clubLabels[k];
              var labelEl = p.querySelector('label');
              if (!labelEl) continue;
              
              var labelText = cleanText(labelEl.textContent).toLowerCase();
              var valueText = cleanText(p.textContent.replace(labelEl.textContent, ''));
              
              if (labelText.includes('position')) {
                data.club_position = valueText;
              } else if (labelText.includes('kit number')) {
                data.club_jersey_number = valueText;
              } else if (labelText.includes('joined')) {
                data.club_joined = valueText;
              }
            }
          } else if (section === 'national team') {
            var teamLink = col.querySelector('a[href*="/team/"]');
            if (teamLink) {
              data.country_name = cleanText(teamLink.textContent);
            }
          }
        }
        
        // Extract individual stats
        var statSections = ['attacking', 'skill', 'movement', 'power', 'mentality', 'defending', 'goalkeeping'];
        
        for (var s = 0; s < statSections.length; s++) {
          var sectionName = statSections[s];
          var h5Elements = document.querySelectorAll('h5');
          var sectionH5 = null;
          
          for (var h = 0; h < h5Elements.length; h++) {
            if (h5Elements[h].textContent && h5Elements[h].textContent.trim().toLowerCase() === sectionName) {
              sectionH5 = h5Elements[h];
              break;
            }
          }
          
          if (sectionH5) {
            var container = sectionH5.closest('div') || sectionH5.parentElement;
            
            if (container) {
              var statParagraphs = container.querySelectorAll('p');
              
              for (var p = 0; p < statParagraphs.length; p++) {
                var para = statParagraphs[p];
                var em = para.querySelector('em');
                var span = para.querySelector('span');
                
                if (em && span) {
                  var statValue = cleanText(em.textContent);
                  var statName = cleanText(span.textContent);
                  
                  var normalizedName = statName.toLowerCase()
                    .replace(/\\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '');
                  
                  if (normalizedName === 'att_position') {
                    normalizedName = 'att_positioning';
                  }
                  
                  var fullStatName = sectionName + '_' + normalizedName;
                  data[fullStatName] = extractNumber(statValue);
                }
              }
            }
          }
        }
        
        return data;
      })()`);
      
      // Add player_id and URL
      playerData.player_id = this.extractPlayerId(playerUrl);
      playerData.url = playerUrl;
      
      // Extract FIFA stats from embedded script (separate evaluation to avoid syntax issues)
      try {
        const scriptData = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script');
          for (let i = 0; i < scripts.length; i++) {
            const text = scripts[i].textContent || '';
            if (text.includes('POINT_PAC') && text.includes('POINT_SHO')) {
              // Extract the stats using string parsing
              const pac = text.match(/POINT_PAC\s*=\s*(\d+)/);
              const sho = text.match(/POINT_SHO\s*=\s*(\d+)/);
              const pas = text.match(/POINT_PAS\s*=\s*(\d+)/);
              const dri = text.match(/POINT_DRI\s*=\s*(\d+)/);
              const def = text.match(/POINT_DEF\s*=\s*(\d+)/);
              const phy = text.match(/POINT_PHY\s*=\s*(\d+)/);
              
              // Look for player positions which contain overall rating
              // Format: <em title="91">90+1</em> where title is the overall
              const result = {
                pace: pac ? parseInt(pac[1]) : 0,
                shooting: sho ? parseInt(sho[1]) : 0,
                passing: pas ? parseInt(pas[1]) : 0,
                dribbling: dri ? parseInt(dri[1]) : 0,
                defending: def ? parseInt(def[1]) : 0,
                physical: phy ? parseInt(phy[1]) : 0,
                overall: 0,
                potential: 0
              };
              
              return result;
            }
          }
          return null;
        });
        
        // Extract overall and potential from position ratings
        const ratings = await page.evaluate(() => {
          // Look for the highest rated position - that's the overall rating
          const posElements = document.querySelectorAll('div.pos em[title]');
          let maxOverall = 0;
          let potential = 0;
          
          for (let i = 0; i < posElements.length; i++) {
            const title = posElements[i].getAttribute('title');
            const rating = title ? parseInt(title) : 0;
            if (rating > maxOverall) {
              maxOverall = rating;
            }
          }
          
          // Try to get potential from the page
          // It might be in a similar structure or we can parse it differently
          
          return {
            overall: maxOverall,
            potential: potential
          };
        });
        
        console.log('Extracted FIFA stats from script:', scriptData);
        console.log('Extracted ratings:', ratings);
        
        if (scriptData) {
          playerData.fifa_pace = scriptData.pace;
          playerData.fifa_shooting = scriptData.shooting;
          playerData.fifa_passing = scriptData.passing;
          playerData.fifa_dribbling = scriptData.dribbling;
          playerData.fifa_defending = scriptData.defending;
          playerData.fifa_physical = scriptData.physical;
        }
        
        if (ratings && ratings.overall > 0) {
          playerData.overall = ratings.overall;
          if (ratings.potential > 0) {
            playerData.potential = ratings.potential;
          }
        }
      } catch (error) {
        console.log('Could not extract FIFA stats from script:', error);
      }
      
      console.log(`Successfully scraped player: ${playerData.name || 'Unknown'} (ID: ${playerData.player_id}, Overall: ${playerData.overall || 'N/A'})`);

      
      await context.close();
      return playerData as PlayerStats;
      
    } catch (error) {
      console.error('Error scraping player:', error);
      await context.close();
      return null;
    }
  }
  
  /**
   * Scrape multiple players
   */
  async scrapePlayers(playerUrls: string[]): Promise<PlayerStats[]> {
    const results: PlayerStats[] = [];
    
    for (const url of playerUrls) {
      const playerData = await this.scrapePlayer(url);
      if (playerData) {
        results.push(playerData);
      }
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }
}

// Export singleton instance
export const sofifaScraper = new SofifaPlaywrightScraper();
