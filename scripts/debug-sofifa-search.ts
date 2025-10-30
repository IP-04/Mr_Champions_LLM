import { chromium } from 'playwright';
import fs from 'fs';

async function debugSearch() {
  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
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
  
  try {
    const testPlayer = 'Erling Haaland';
    const searchUrl = `https://sofifa.com/players?keyword=${encodeURIComponent(testPlayer)}`;
    
    console.log(`Searching: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait a bit for any dynamic content
    await page.waitForTimeout(5000);
    
    // Save HTML
    const html = await page.content();
    fs.writeFileSync('sofifa-search-results.html', html);
    console.log('Saved HTML to sofifa-search-results.html');
    
    // Try to find the table
    const tableExists = await page.evaluate(() => {
      return {
        hasTable: !!document.querySelector('table.table'),
        hasTbody: !!document.querySelector('table.table tbody'),
        rowCount: document.querySelectorAll('table.table tbody tr').length,
        bodyText: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log('Table info:', tableExists);
    
    // Take screenshot
    await page.screenshot({ path: 'sofifa-search-screenshot.png', fullPage: true });
    console.log('Saved screenshot');
    
    await browser.close();
    
  } catch (error) {
    console.error('Error:', error);
    await browser.close();
  }
}

debugSearch();
