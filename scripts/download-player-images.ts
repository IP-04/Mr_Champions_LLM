import { db } from "../db";
import { players } from "../shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

/**
 * Download player images from SoFIFA and save locally
 */
async function downloadPlayerImages() {
  console.log('📥 Downloading player images...\n');
  
  // Create directories for images
  const publicDir = path.join(process.cwd(), 'client', 'public');
  const imagesDir = path.join(publicDir, 'player-images');
  
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`✅ Created directory: ${imagesDir}\n`);
  }
  
  try {
    // Get players with SoFIFA images
    const allPlayers = await db.select().from(players);
    const playersWithPhotos = allPlayers.filter(p => p.playerFaceUrl && p.playerFaceUrl.includes('sofifa'));
    
    console.log(`📊 Found ${playersWithPhotos.length} players with SoFIFA photos\n`);
    
    if (playersWithPhotos.length === 0) {
      console.log('⚠️  No players have SoFIFA photos yet.');
      console.log('   Run the sync first: POST /api/admin/sync-players');
      process.exit(0);
    }
    
    let downloadCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const player of playersWithPhotos) {
      const imageUrl = player.playerFaceUrl!;
      const fileName = `${player.id}.png`;
      const filePath = path.join(imagesDir, fileName);
      
      // Skip if already downloaded
      if (fs.existsSync(filePath)) {
        skipCount++;
        continue;
      }
      
      try {
        console.log(`⬇️  Downloading: ${player.name}...`);
        
        await downloadImage(imageUrl, filePath);
        
        // Update database to use local path
        const localUrl = `/player-images/${fileName}`;
        await db.update(players)
          .set({ imageUrl: localUrl })
          .where(eq(players.id, player.id));
        
        downloadCount++;
        console.log(`   ✅ Saved to: ${localUrl}`);
        
        // Small delay to be nice to the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Download Summary:`);
    console.log(`   ✅ Downloaded: ${downloadCount}`);
    console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`\n💡 Images saved to: ${imagesDir}`);
    console.log(`   Database updated with local paths: /player-images/*.png`);
    console.log(`\n🔄 Refresh your browser to see the images!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(filepath);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        if (response.headers.location) {
          downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        } else {
          reject(new Error(`Redirect without location: ${response.statusCode}`));
        }
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

downloadPlayerImages();
