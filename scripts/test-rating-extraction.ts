import { chromium } from 'playwright';

async function testRatingExtraction() {
  console.log('🧪 Testing Overall Rating Extraction\n');
  
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
  
  // Block resources
  await page.route('**/*', route => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });
  
  const url = 'https://sofifa.com/player/209331/mohamed-salah/250048';
  
  console.log(`📍 Navigating to: ${url}\n`);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Check for block
    const title = await page.title();
    if (title.includes('blocked')) {
      console.log('❌ Page is blocked');
      await browser.close();
      return;
    }
    
    console.log(`📄 Page title: ${title}\n`);
    
    // Method 1: Try div.sub with em
    console.log('Method 1: Using div.sub > em');
    const divSubCount = await page.locator('div.sub').count();
    console.log(`Found ${divSubCount} div.sub elements`);
    
    if (divSubCount >= 2) {
      const overall = await page.locator('div.sub').nth(0).locator('em').textContent();
      const potential = await page.locator('div.sub').nth(1).locator('em').textContent();
      console.log(`Overall: ${overall}`);
      console.log(`Potential: ${potential}`);
    }
    
    // Method 2: Look for em with title attribute
    console.log('\nMethod 2: Using em[title]');
    const emWithTitle = await page.locator('em[title]').all();
    console.log(`Found ${emWithTitle.length} em elements with title`);
    
    for (let i = 0; i < Math.min(5, emWithTitle.length); i++) {
      const title = await emWithTitle[i].getAttribute('title');
      const text = await emWithTitle[i].textContent();
      console.log(`  em[${i}]: title="${title}", text="${text}"`);
    }
    
    // Method 3: Extract via evaluate
    console.log('\nMethod 3: Using page.evaluate');
    const ratings = await page.evaluate(() => {
      const divSubs = document.querySelectorAll('div.sub');
      const results = [];
      
      for (let i = 0; i < Math.min(3, divSubs.length); i++) {
        const em = divSubs[i].querySelector('em');
        if (em) {
          results.push({
            title: em.getAttribute('title'),
            text: em.textContent,
            parent: divSubs[i].textContent
          });
        }
      }
      
      return results;
    });
    
    console.log('Ratings found:', JSON.stringify(ratings, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed');
  }
}

testRatingExtraction();
