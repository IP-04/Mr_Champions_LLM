import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

async function debugPageStructure() {
  console.log('🔍 Debugging SoFIFA Page Structure\n');
  
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
  
  const url = 'https://sofifa.com/player/209331/mohamed-salah/250048';
  
  console.log(`📍 Navigating to: ${url}\n`);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Get the full HTML
    const html = await page.content();
    
    // Save to file for inspection
    writeFileSync('sofifa-page.html', html);
    console.log('✅ Saved page HTML to sofifa-page.html\n');
    
    // Run debug queries
    const debug = await page.evaluate(() => {
      const results = {
        divSubCount: 0,
        divSubElements: [] as string[],
        emWithTitle: [] as any[],
        overallRatingElements: [] as string[],
        gridElements: [] as string[],
      };
      
      // 1. Count div.sub
      const divSubs = document.querySelectorAll('div.sub');
      results.divSubCount = divSubs.length;
      
      // 2. Get div.sub HTML (first 3)
      divSubs.forEach((div, i) => {
        if (i < 3) {
          results.divSubElements.push(div.outerHTML.substring(0, 300));
        }
      });
      
      // 3. Get em[title] elements
      const emElements = document.querySelectorAll('em[title]');
      emElements.forEach((em, i) => {
        if (i < 5) {
          results.emWithTitle.push({
            title: em.getAttribute('title'),
            text: em.textContent?.trim(),
            parent: em.parentElement?.className || ''
          });
        }
      });
      
      // 4. Look for "Overall rating" text
      const allElements = Array.from(document.querySelectorAll('*'));
      const overallElements = allElements.filter(el => 
        el.textContent && el.textContent.includes('Overall rating')
      );
      overallElements.forEach((el, i) => {
        if (i < 3) {
          results.overallRatingElements.push(el.outerHTML.substring(0, 500));
        }
      });
      
      // 5. Look in div.grid structure
      const gridDivs = document.querySelectorAll('div.grid');
      gridDivs.forEach((grid, i) => {
        if (i < 2) {
          results.gridElements.push(grid.outerHTML.substring(0, 500));
        }
      });
      
      return results;
    });
    
    console.log('📊 Debug Results:\n');
    console.log(`div.sub count: ${debug.divSubCount}`);
    
    if (debug.divSubElements.length > 0) {
      console.log('\ndiv.sub elements:');
      debug.divSubElements.forEach((html, i) => {
        console.log(`[${i}]: ${html}\n`);
      });
    }
    
    if (debug.emWithTitle.length > 0) {
      console.log('\nem[title] elements:');
      debug.emWithTitle.forEach((em, i) => {
        console.log(`[${i}]: title="${em.title}", text="${em.text}", parent="${em.parent}"`);
      });
    }
    
    if (debug.overallRatingElements.length > 0) {
      console.log('\nElements containing "Overall rating":');
      debug.overallRatingElements.forEach((html, i) => {
        console.log(`[${i}]: ${html}\n`);
      });
    }
    
    if (debug.gridElements.length > 0) {
      console.log('\ndiv.grid elements:');
      debug.gridElements.forEach((html, i) => {
        console.log(`[${i}]: ${html}\n`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed');
    console.log('💡 Check sofifa-page.html for the full page structure');
  }
}

debugPageStructure();
