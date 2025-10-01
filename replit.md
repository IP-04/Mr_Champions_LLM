# UCL Performance Predictor

## Overview

The UCL Performance Predictor is a web application that provides AI-powered predictions for UEFA Champions League 2025-26 matches and player performances. The platform combines match outcome forecasting (win/draw/loss probabilities, expected goals) with player-level performance predictions, presented in a PrizePicks-inspired dark theme interface with UEFA Champions League styling.

The application serves as a fantasy sports prediction platform where users can view upcoming fixtures, analyze player statistics, make picks on player performance projections, and compete on leaderboards based on prediction accuracy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**React SPA with Vite**: The client is built as a single-page application using React 18 with TypeScript, bundled by Vite for fast development and optimized production builds. The application uses a file-based routing approach via Wouter for lightweight client-side navigation.

**UI Component System**: The interface leverages shadcn/ui components built on Radix UI primitives, providing accessible and customizable UI elements. The design system uses Tailwind CSS with custom CSS variables for theming, enabling a dark-mode-first PrizePicks-style aesthetic with neon green primary colors and purple secondary accents.

**State Management**: TanStack Query (React Query) handles all server state, data fetching, caching, and synchronization. The application uses a centralized query client configuration with custom query functions that handle API requests and error states consistently across all data fetching operations.

**Mobile-First Responsive Design**: The layout prioritizes mobile viewports with a bottom navigation bar for primary navigation, card-based content presentation, and touch-optimized interactions. The design scales gracefully to tablet and desktop sizes.

### Backend Architecture

**Express Server**: A Node.js Express server handles API routing and serves the built frontend in production. The server implements middleware for JSON parsing, request logging with duration tracking, and error handling.

**Storage Abstraction Layer**: The backend uses an interface-based storage pattern (`IStorage`) that currently implements an in-memory storage solution (`MemStorage`) with mock data. This abstraction allows for easy swapping to database-backed persistence without changing API route handlers.

**API Design**: RESTful API endpoints follow resource-based conventions:
- `/api/matches` - Match fixtures and predictions
- `/api/players` - Player forecasts with position filtering
- `/api/feature-importance/:matchId` - Model explanation data
- `/api/leaderboard` - User rankings and accuracy metrics
- `/api/picks` - User prediction selections

The API returns JSON responses with appropriate HTTP status codes and error messages.

### Data Schema & Database Design

**Drizzle ORM with PostgreSQL**: The application is configured to use Drizzle ORM with PostgreSQL (via Neon serverless driver) for production data persistence. The schema is defined in TypeScript with Zod validation integration.

**Core Data Models**:
- **Matches**: Store fixture details, team information, prediction probabilities (home/draw/away), expected goals, and confidence intervals
- **Players**: Track player details, team affiliation, position, performance projections, and statistical averages
- **Feature Importance**: Capture model explainability data linking features to specific match predictions
- **Leaderboard**: Maintain user rankings, accuracy percentages, and point totals
- **User Picks**: Record user predictions with pick type, stat lines, and over/under selections

The schema uses varchar primary keys (UUIDs or custom IDs), real/float types for probability and statistical data, and text fields for descriptive content.

### External Dependencies

**UI Framework & Styling**:
- **Radix UI**: Headless component primitives for accessibility (dialogs, dropdowns, tooltips, etc.)
- **Tailwind CSS**: Utility-first CSS framework with custom configuration for dark theme
- **shadcn/ui**: Pre-built component library following the "New York" style variant
- **Recharts**: Chart visualization library for radar charts and statistical displays
- **Embla Carousel**: Touch-enabled carousel for horizontal scrolling content
- **Lucide React**: Icon library for UI elements

**Data Fetching & Forms**:
- **TanStack Query**: Server state management and data synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition

**Development Tools**:
- **TypeScript**: Static type checking across the full stack
- **Vite**: Build tool with HMR and optimized bundling
- **Drizzle Kit**: Database migration and schema management tooling
- **Replit Development Plugins**: Runtime error overlay, cartographer, and dev banner for Replit environment

**Database & Session**:
- **@neondatabase/serverless**: PostgreSQL client optimized for serverless/edge environments
- **Drizzle ORM**: Type-safe SQL query builder and ORM
- **connect-pg-simple**: PostgreSQL session store (configured but not actively used in current implementation)

**Planned External Data Sources** (from project documentation):
- **football-data.org API**: Primary source for UCL fixtures, standings, lineups (REST v4, free tier)
- **StatsBomb Open Data**: Event data for pre-training xG models
- **API-Football** (optional paid upgrade): Richer live events and player statistics

The current implementation uses mock data in memory but is architected to integrate with these external APIs for real match and player data once the prediction models are deployed.