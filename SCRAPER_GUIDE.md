# SoFIFA Player Data Integration

This system automatically scrapes player images, overall ratings, and FIFA stats from SoFIFA.com and integrates them into your app.

## Features

✅ **Automatic player data scraping** from SoFIFA
✅ **Real FIFA player images** - High quality player faces
✅ **Accurate overall ratings** - Real FIFA ratings (40-99)
✅ **Detailed radar stats** - Pace, Shooting, Passing, Dribbling, Defending, Physical
✅ **Background sync** - Weekly automatic updates
✅ **Manual sync endpoints** - Trigger syncs on demand
✅ **Rate limiting** - Respectful scraping with 2-3 second delays

## How It Works

### Automatic Background Sync

The system automatically syncs player data:
- **Every Sunday at 3 AM UTC** - Full player stats sync
- **Daily at 6 AM UTC** - Match data sync

### Manual Sync

You can trigger syncs manually through API endpoints:

#### 1. Sync All Players
```bash
POST /api/admin/sync-players
```

Response:
```json
{
  "message": "Player sync started in background",
  "status": "processing"
}
```

#### 2. Sync Players for Specific Match
```bash
POST /api/admin/sync-match-players/:matchId
```

Example:
```bash
POST /api/admin/sync-match-players/match-123
```

Response:
```json
{
  "message": "Player sync started for match match-123",
  "status": "processing"
}
```

## Testing the Scraper

Test the scraper with sample players:

```bash
npx tsx scripts/test-scraper.ts
```

This will scrape data for Mbappé, Haaland, and Salah.

## Database Schema

The system adds two new fields to the `players` table:

```typescript
{
  radarStats: {
    pace: number;      // 40-99
    shooting: number;  // 40-99
    passing: number;   // 40-99
    dribbling: number; // 40-99
    defending: number; // 40-99
    physical: number;  // 40-99
  },
  sofifaId: string;    // SoFIFA player ID
}
```

## Usage in Components

### RadarChart Component

The `RadarChart` component now uses real FIFA stats:

```tsx
<RadarChart player={player} />
```

If `player.radarStats` exists, it displays real FIFA stats.
Otherwise, it falls back to estimated stats based on position and overall rating.

### Match Detail Page

When you click on a player card, the modal shows:
- Real player image from SoFIFA
- Accurate overall rating
- FIFA-style radar chart with real stats
- Position-specific attribute breakdown

## Rate Limiting

The scraper implements respectful rate limiting:
- **2-3 seconds** between individual player requests
- **Random jitter** to avoid detection
- **Background processing** to avoid blocking the app

## Error Handling

If scraping fails for a player:
- Falls back to estimated stats based on position
- Uses placeholder image (initials avatar)
- Logs error for debugging
- Continues with remaining players

## Scraper Configuration

The scraper can be customized in `server/services/playerDataScraper.ts`:

```typescript
// Adjust position multipliers for stat estimation
const positionMultipliers = {
  'ST': { pace: 1.1, shooting: 1.3, ... },
  'CM': { pace: 0.9, shooting: 0.8, ... },
  // etc.
};

// Adjust stat clamping
const estimatedStat = Math.min(99, Math.max(40, baseStat));
```

## Troubleshooting

### Players not showing images

1. Check if player exists in SoFIFA database
2. Verify team name matches SoFIFA (e.g., "Man City" vs "Manchester City")
3. Check server logs for scraping errors

### Stats not updating

1. Check if background sync is running: Look for cron job logs
2. Manually trigger sync: `POST /api/admin/sync-players`
3. Verify database migration ran: Check for `radar_stats` column

### Scraper getting blocked

1. Increase delay between requests (change `2000` to `5000` in scraper)
2. Add more random jitter
3. Change User-Agent string in scraper headers

## Example Output

When scraping Mbappé:

```json
{
  "name": "Kylian Mbappé",
  "overall": 91,
  "position": "ST",
  "imageUrl": "https://cdn.sofifa.net/players/231/747/25_120.png",
  "team": "Real Madrid",
  "sofifaId": "231747",
  "pace": 97,
  "shooting": 89,
  "passing": 80,
  "dribbling": 92,
  "defending": 36,
  "physical": 76
}
```

## Production Deployment

When deploying to production:

1. **Set environment variables** for database connection
2. **Enable background jobs** - Ensure cron jobs are running
3. **Monitor scraping errors** - Set up logging/alerting
4. **Consider caching** - Cache SoFIFA data to reduce requests
5. **Legal compliance** - Only use for personal/educational purposes

## Legal Notice

⚠️ This scraper is for **personal and educational use only**.
- Respect SoFIFA's terms of service
- Implement rate limiting (already done)
- Do not use scraped data commercially
- Consider SoFIFA's robots.txt rules

## Support

If you encounter issues:
1. Check server logs: `npm run dev` and look for scraper errors
2. Test scraper: `npx tsx scripts/test-scraper.ts`
3. Verify database schema: Check for new columns in `players` table
4. Check TypeScript errors: `npm run check`
