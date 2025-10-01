# UCL Champions League Match + Player Performance Predictor

A sophisticated web application that provides AI-powered predictions for UEFA Champions League 2025-26 matches and player performances, featuring real-time data integration, interactive forecasting visuals, and a PrizePicks-inspired user interface.

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🏆 Project Overview

This application combines match outcome forecasting (win/draw/loss probabilities, expected goals) with player-level performance predictions in a modern, responsive web interface. Users can view upcoming Champions League fixtures, analyze detailed player statistics, and interact with carousel-based player forecast cards.

### Key Features

- **Real-time Match Data**: Integration with Football Data API for live Champions League fixtures
- **Player Performance Forecasts**: ML-powered predictions for goals, assists, shots, and ratings
- **Interactive UI**: Carousel and grid views for player cards with responsive design
- **Team Statistics**: Comprehensive team stats including formation, possession, and shot data
- **Dual View Modes**: Switch between carousel and grid layouts for optimal viewing experience

## 🏗️ System Architecture

### Frontend Stack

- **React 18** - Modern React with TypeScript for type safety
- **Vite** - Fast build tool and development server
- **Wouter** - Lightweight client-side routing
- **TanStack Query** - Server state management and caching
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components built on Radix UI
- **Embla Carousel** - Touch-friendly carousel component
- **Lucide React** - Modern icon library

### Backend Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe JavaScript
- **Drizzle ORM** - Type-safe SQL toolkit
- **PostgreSQL** - Production database (via Neon serverless)
- **Football Data API** - Real Champions League data source

### Development Tools

- **TSX** - TypeScript execution engine
- **ESBuild** - Fast JavaScript bundler
- **Cross-env** - Cross-platform environment variables
- **Drizzle Kit** - Database migrations and management

## 📊 Database Schema

### Core Tables

```sql
-- Matches table for Champions League fixtures
matches (
  id VARCHAR PRIMARY KEY,
  homeTeam TEXT NOT NULL,
  awayTeam TEXT NOT NULL,
  homeTeamCrest TEXT NOT NULL,
  awayTeamCrest TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  venue TEXT NOT NULL,
  stage TEXT NOT NULL,
  homeWinProb REAL NOT NULL,
  drawProb REAL NOT NULL,
  awayWinProb REAL NOT NULL,
  homeXg REAL NOT NULL,
  awayXg REAL NOT NULL,
  confidence REAL NOT NULL
)

-- Players table for performance data
players (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT NOT NULL,
  imageUrl TEXT NOT NULL,
  goalsPrediction REAL NOT NULL,
  assistsPrediction REAL NOT NULL,
  shotsPrediction REAL NOT NULL,
  passesPrediction REAL NOT NULL,
  tacklesPrediction REAL NOT NULL,
  ratingPrediction REAL NOT NULL,
  confidence REAL NOT NULL
)

-- Feature importance for ML model explanations
featureImportance (
  id VARCHAR PRIMARY KEY,
  matchId VARCHAR NOT NULL,
  feature TEXT NOT NULL,
  importance REAL NOT NULL,
  impact TEXT NOT NULL
)
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **PostgreSQL** database (or Neon account)
- **Football Data API key**

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/IP-04/Mr_Champions_LLM.git
cd Mr_Champions_LLM
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
Create a `.env` file in the root directory:
```env
# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# Football Data API
FOOTBALL_DATA_API_KEY="your_football_data_api_key"

# Application Environment
NODE_ENV="development"
PORT=5000

# Optional: Additional configuration
REPL_ID="your_repl_id"
REPL_SLUG="your_repl_slug"
```

4. **Database Setup**
```bash
# Push schema to database
npm run db:push
```

5. **Start Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
Mr_Champions_LLM/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/        # shadcn/ui components
│   │   │   ├── header.tsx # Navigation header
│   │   │   ├── player-card.tsx # Player forecast cards
│   │   │   └── match-card.tsx  # Match display cards
│   │   ├── pages/         # Route components
│   │   │   ├── home.tsx   # Homepage with matches
│   │   │   ├── players.tsx # Player forecasts page
│   │   │   ├── match-detail.tsx # Detailed match view
│   │   │   └── leaderboard.tsx  # User rankings
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility functions
│   │   └── main.tsx       # Application entry point
│   └── index.html         # HTML template
├── server/                # Backend Express application
│   ├── services/          # Business logic services
│   │   ├── footballDataApi.ts   # Football Data API integration
│   │   ├── dataSync.ts          # Data synchronization
│   │   └── predictionService.ts # ML prediction logic
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database abstraction layer
│   └── vite.ts            # Vite development integration
├── db/                    # Database configuration
│   └── index.ts           # Drizzle ORM setup
├── shared/                # Shared TypeScript types
│   └── schema.ts          # Database schema & types
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── drizzle.config.ts      # Database migration config
```

## 🔌 API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/matches` | List all Champions League matches |
| `GET` | `/api/matches/:id` | Get specific match details |
| `GET` | `/api/matches/:id/stats` | Get team statistics for match |
| `GET` | `/api/matches/:id/player-forecasts` | Get player predictions for match |
| `GET` | `/api/players` | List all players with forecasts |
| `GET` | `/api/players?position=:pos` | Filter players by position |
| `GET` | `/api/feature-importance/:matchId` | Get ML model feature importance |
| `GET` | `/api/leaderboard` | Get user rankings and accuracy metrics |

### Response Examples

**Match Details** (`/api/matches/:id`)
```json
{
  "id": "match-551952",
  "homeTeam": "Man City",
  "awayTeam": "PSG",
  "date": "2025-03-15T20:00:00Z",
  "venue": "Etihad Stadium",
  "status": "SCHEDULED",
  "odds": {
    "home": 2.1,
    "draw": 3.4,
    "away": 3.2
  }
}
```

**Player Forecast** (`/api/matches/:id/player-forecasts`)
```json
[
  {
    "playerId": 1,
    "name": "Erling Haaland",
    "position": "ST",
    "team": "Man City",
    "forecasts": {
      "goals": 1.2,
      "assists": 0.3,
      "rating": 8.4,
      "shots": 4.1,
      "passes": 35.2,
      "passAccuracy": 0.85
    },
    "featureImportance": [
      {
        "feature": "form",
        "importance": 0.34
      }
    ]
  }
]
```

## 🎨 UI Components

### Player Cards

The application features sophisticated player forecast cards with:

- **Dual View Modes**: Carousel and grid layouts
- **Team Color Coding**: Blue for home team, purple for away team
- **Interactive Elements**: Betting buttons for over/under predictions
- **Responsive Design**: Adapts from 1 column (mobile) to 4 columns (desktop)

### Carousel Implementation

Using Embla Carousel for smooth, touch-friendly navigation:

```typescript
const [emblaRef, emblaApi] = useEmblaCarousel({ 
  loop: false,
  dragFree: true,
  containScroll: "trimSnaps",
  slidesToScroll: 1,
  align: "start"
});
```

### Match Detail Views

Comprehensive match pages with tabbed interface:
- **Overview**: Match predictions and team stats
- **Lineups**: Starting XI with player ratings
- **Players**: Interactive player forecast cards
- **Analysis**: ML model insights and key matchups

## 🔄 Data Integration

### Football Data API

Real-time Champions League data integration:

```typescript
// Sync matches from Football Data API
const syncChampionsLeagueMatches = async () => {
  const response = await fetch(
    'https://api.football-data.org/v4/competitions/CL/matches',
    {
      headers: {
        'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY
      }
    }
  );
  const data = await response.json();
  // Process and store match data
};
```

### Data Synchronization

Automated data sync on server startup:
- Fetches latest Champions League fixtures
- Updates team and player information
- Generates ML-powered predictions
- Seeds database with fallback data if API unavailable

## 🧪 Machine Learning Features

### Prediction Models

- **Match Outcome Prediction**: Win/draw/loss probabilities using team form, head-to-head records, and current season performance
- **Player Performance Forecasting**: Goals, assists, shots, rating predictions based on historical data and opponent analysis
- **Feature Importance Analysis**: Explainable AI showing which factors influence predictions most

### Model Inputs

- Team form (last 5 matches)
- Head-to-head historical results
- Player statistics (goals, assists, shots per game)
- Venue advantage/disadvantage
- Injury and suspension status
- Current season performance metrics

## 🎯 Performance Optimizations

### Frontend Optimizations

- **Code Splitting**: Dynamic imports for route-based code splitting
- **Image Optimization**: Lazy loading for player and team images
- **Query Caching**: TanStack Query for efficient data caching
- **Bundle Analysis**: Optimized dependencies and tree shaking

### Backend Optimizations

- **Database Indexing**: Strategic indexes on frequently queried fields
- **API Rate Limiting**: Intelligent caching to minimize external API calls
- **Connection Pooling**: PostgreSQL connection pooling for scalability
- **Response Compression**: Gzip compression for API responses

## 🔒 Security Features

- **Environment Variables**: Sensitive data stored in environment variables
- **Input Validation**: Zod schema validation for all API inputs
- **SQL Injection Prevention**: Drizzle ORM parameterized queries
- **CORS Configuration**: Proper cross-origin resource sharing setup

## 🚀 Deployment

### Environment Variables

Required for production deployment:

```env
DATABASE_URL="your_production_database_url"
FOOTBALL_DATA_API_KEY="your_api_key"
NODE_ENV="production"
PORT=5000
```

### Build Process

```bash
# Install dependencies
npm ci

# Build application
npm run build

# Start production server
npm start
```

## 🧪 Testing

### Running Tests

```bash
# Run type checking
npm run check

# Run development server with hot reload
npm run dev
```

## 📈 Monitoring & Analytics

- **Request Logging**: Detailed API request logging with response times
- **Error Tracking**: Comprehensive error handling and logging
- **Performance Metrics**: Response time monitoring for all endpoints

## 🔮 Future Enhancements

### Planned Features

- **User Authentication**: Full user accounts with prediction history
- **Live Match Updates**: Real-time score updates during matches
- **Advanced Analytics**: More detailed statistical analysis
- **Mobile App**: React Native version for iOS/Android
- **Betting Integration**: Integration with sports betting APIs
- **Social Features**: User following and prediction sharing

### Technical Improvements

- **GraphQL API**: Migration from REST to GraphQL for better data fetching
- **Real-time Updates**: WebSocket integration for live data
- **Caching Layer**: Redis for improved performance
- **Microservices**: Service-oriented architecture for scalability

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Football Data API](https://www.football-data.org/) for Champions League data
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Radix UI](https://www.radix-ui.com/) for accessible component primitives
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations
- [Neon](https://neon.tech/) for serverless PostgreSQL hosting

## 📞 Support

For support and questions:
- Create an issue in this repository
- Contact the development team
- Check the documentation for common solutions

---

**Built with ❤️ for Champions League fans and fantasy sports enthusiasts**