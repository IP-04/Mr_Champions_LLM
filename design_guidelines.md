# UCL Performance Predictor - Design Guidelines

## Design Approach
**Reference-Based**: Drawing from PrizePicks, DraftKings, and FanDuel's sports prediction interfaces. The design emphasizes data density with clear visual hierarchy, card-based information architecture, and glanceable metrics presentation optimized for quick decision-making.

## Typography System

**Primary Font**: Inter (Google Fonts)
- Hero/Display: 600 weight, 3xl to 6xl sizes
- Headers: 700 weight, xl to 3xl sizes
- Body: 400 weight, sm to base sizes
- Metrics/Stats: 700 weight, lg to 2xl sizes (tabular numbers)

**Secondary Font**: JetBrains Mono (Google Fonts) for odds, probabilities, and numerical data
- Stats/Numbers: 500-600 weight, base to xl sizes
- Ensures clear readability of numerical predictions

## Layout & Spacing System

**Tailwind Units**: Use 2, 3, 4, 6, 8, 12, 16, 24 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: py-12 to py-24
- Card gaps: gap-4 to gap-6
- Container max-width: max-w-7xl with px-4

## Navigation Structure

**Top Navigation Bar**: Sticky, dark with subtle border
- Logo left, main nav center (Matches, Players, Predictions, Leaderboard)
- User profile/balance display right
- Height: h-16
- Navigation items with active state indicators using neon green underline

**Secondary Tabs** (below hero): Horizontal scrollable pill navigation
- Match filters: Today, Tomorrow, This Week, Group Stage, Knockouts
- Pills with rounded-full, active state background treatment

## Hero Section

**Layout**: Full-width, height 60vh minimum
- Background: Featured match image with dark gradient overlay (from transparent to #121212)
- Content: Centered, max-w-4xl
- Headline emphasizing "Predict. Win. Dominate." messaging
- Live match countdown or featured prediction prompt
- CTA buttons with blur backdrop (backdrop-blur-lg)

**Images**: 
- Hero: Dynamic UCL match action shots or stadium atmosphere
- Format: 16:9 aspect ratio, high contrast images

## Card Components

**Match Prediction Cards**: Grid layout (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Card structure: rounded-xl, border with subtle glow effect
- Header: Team logos (64x64), team names, match time
- Body: Key metrics grid (2x2): Win Probability, Over/Under, BTTS, Clean Sheet
- Each metric: Icon, label, percentage/odds, confidence indicator bar
- Footer: "Make Prediction" CTA, match status badge
- Spacing: p-6, gap-4 between elements

**Player Performance Cards**: Horizontal cards in scrollable container
- Left: Player headshot (96x96, rounded)
- Center: Player name, position, team badge (32x32)
- Right: Stat predictions grid (Goals, Assists, Shots, Rating)
- Each stat: Label, predicted value, actual average
- Compact: p-4, flex layout

**Prediction Slip** (Sticky Sidebar on desktop, bottom drawer mobile):
- Fixed positioning, w-80 on desktop
- Header: "Your Predictions" with count badge
- List of selected predictions with remove option
- Total odds calculator
- Submit button (full-width, prominent)
- Clear all option

## Data Visualization

**Probability Displays**:
- Circular progress rings for percentages (0-100%)
- Linear bars for comparative metrics
- Gradient fills from dark to primary color
- Numbers in JetBrains Mono, center-aligned

**Stat Comparison Widgets**:
- Head-to-head team comparison bars
- Form indicators (last 5 matches as colored dots)
- Player vs. average charts using vertical bars

## Section Layout

**Matches Section**: 
- Filters row: flex, gap-3, mb-8
- Card grid: grid with appropriate columns
- Load more pattern with intersection observer

**Players Section**:
- Search/filter bar: sticky below nav
- Category tabs: Forwards, Midfielders, Defenders, Goalkeepers
- Horizontal scrollable rows per category
- Each row: flex, gap-4, overflow-x-auto

**Live Predictions Dashboard**:
- Split layout: 60% live matches feed, 40% trending predictions
- Real-time updating cards with pulse animations on data refresh
- Time-based sorting (soonest matches first)

**Leaderboard Section**:
- Table layout with alternating row treatment
- Columns: Rank, User, Streak, Accuracy %, Total Predictions, Points
- Top 3 highlighted with trophy icons
- User's position always visible (sticky or highlighted)

## Footer

**Structure**: Three-column layout (md:grid-cols-3)
- Column 1: Logo, tagline, social links
- Column 2: Quick links (About, Rules, FAQ, Support)
- Column 3: Newsletter signup, legal links
- Bottom bar: Copyright, terms, responsible gaming badge
- Spacing: pt-16, pb-8

## Images Inventory

1. **Hero**: UCL stadium atmosphere or dynamic match action (16:9)
2. **Team Logos**: All UCL participating teams (SVG format, white versions for dark theme)
3. **Player Headshots**: Circular crops, consistent lighting
4. **Background Patterns**: Subtle hexagonal or geometric patterns for card backgrounds
5. **Trophy/Badge Icons**: UCL trophy, achievement badges for leaderboard

## Icon Library
**Heroicons** (CDN) for all UI icons:
- Outline style for navigation and secondary actions
- Solid style for active states and primary actions
- Sports-specific: Trophy, chart-bar, fire (streak), star (rating)

## Accessibility
- All interactive cards: focus-visible states with neon green outline
- Form inputs: Consistent height (h-12), clear labels, error states
- Contrast ratios maintained despite dark theme
- Keyboard navigation for prediction slip and card selection