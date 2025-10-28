import { chromium } from 'playwright';

async function testSimpleScraper() {
  console.log('🧪 Testing Simple Playwright Scraper with Anti-Detection\n');
  
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
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
  });
  
  const page = await context.newPage();
  
  // Block resources to speed up
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
    
    // Wait a bit for page to load
    await page.waitForTimeout(5000);
    
    // Check if we hit Cloudflare
    const content = await page.content();
    if (content.includes('Checking your browser') || content.includes('Just a moment')) {
      console.log('⚠️ Cloudflare challenge detected, waiting...');
      await page.waitForTimeout(10000);
    }
    
    // Extract name from title or h1
    const name = await page.textContent('h1').catch(() => 'Unknown');
    console.log(`✅ Name: ${name}`);
    
    // Extract overall rating from div.sub
    const overallDiv = await page.locator('div.sub').first();
    const overallEm = overallDiv.locator('em');
    const overallTitle = await overallEm.getAttribute('title').catch(() => null);
    const overallText = await overallEm.textContent().catch(() => '0');
    console.log(`✅ Overall (from title attr): ${overallTitle}`);
    console.log(`✅ Overall (from text): ${overallText}`);
    
    // Extract potential rating from second div.sub
    const potentialDiv = await page.locator('div.sub').nth(1);
    const potentialEm = potentialDiv.locator('em');
    const potentialTitle = await potentialEm.getAttribute('title').catch(() => null);
    const potentialText = await potentialEm.textContent().catch(() => '0');
    console.log(`✅ Potential (from title attr): ${potentialTitle}`);
    console.log(`✅ Potential (from text): ${potentialText}`);
    
    // Extract image
    const imageScript = await page.locator('script[type="application/ld+json"]').textContent().catch(() => '{}');
    if (imageScript && imageScript !== '{}') {
      try {
        const jsonLd = JSON.parse(imageScript);
        console.log(`✅ Face URL: ${jsonLd.image || 'Not found'}`);
        console.log(`✅ Name from JSON-LD: ${jsonLd.name || 'Not found'}`);
      } catch (e) {
        console.log('❌ Failed to parse JSON-LD');
      }
    }
    
    // Try to extract sections
    const h5s = await page.locator('h5').allTextContents();
    console.log(`\n📊 Found sections: ${h5s.join(', ')}`);
    
    // Try to find stats for attacking
    const attackingH5 = await page.locator('h5').filter({ hasText: /attacking/i }).first();
    if (await attackingH5.count() > 0) {
      console.log('\n⚽ Found attacking section');
      const container = await attackingH5.locator('..').first();
      const stats = await container.locator('p').allTextContents();
      console.log('Stats found:', stats.slice(0, 5));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed');
  }
}

testSimpleScraper();
