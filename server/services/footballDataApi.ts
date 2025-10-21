interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    winner: string | null;
    duration: string;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };
  venue: string | null;
}

interface FootballDataTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address: string;
  website: string;
  founded: number;
  clubColors: string;
  venue: string;
  squad: Array<{
    id: number;
    name: string;
    position: string;
    dateOfBirth: string;
    nationality: string;
  }>;
}

interface FootballDataResponse<T> {
  matches?: T[];
  teams?: T[];
}

const API_BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "CL"; // Champions League

export class FootballDataApiService {
  private apiKey: string;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetchFromApi<T>(endpoint: string, retryCount = 0): Promise<FootballDataResponse<T>> {
    // Rate limiting - ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`Rate limiting: waiting ${delay}ms before request to ${endpoint}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;

    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log(`Request #${this.requestCount}: ${endpoint}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          "X-Auth-Token": this.apiKey,
        },
      });

      if (response.status === 429) {
        // Rate limited - implement exponential backoff
        if (retryCount < 3) {
          const backoffDelay = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
          console.log(`Rate limited (429). Retrying in ${backoffDelay}ms... (attempt ${retryCount + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return this.fetchFromApi(endpoint, retryCount + 1);
        } else {
          throw new Error(`Football Data API rate limit exceeded after 3 retries: ${response.status} ${response.statusText}`);
        }
      }

      if (!response.ok) {
        throw new Error(`Football Data API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Success: ${endpoint} - ${JSON.stringify(data).length} bytes`);
      return data;
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('rate limit')) {
        throw error; // Re-throw rate limit errors
      }
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async getChampionsLeagueMatches(): Promise<FootballDataMatch[]> {
    const data = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches`);
    return data.matches || [];
  }

  async getChampionsLeagueTeams(): Promise<FootballDataTeam[]> {
    // Try current season first, fallback to without season parameter
    try {
      const currentSeason = new Date().getFullYear();
      const data = await this.fetchFromApi<FootballDataTeam>(`/competitions/${COMPETITION_CODE}/teams?season=${currentSeason}`);
      return data.teams || [];
    } catch (error) {
      console.warn('Failed to fetch teams with season parameter, trying without season...');
      const data = await this.fetchFromApi<FootballDataTeam>(`/competitions/${COMPETITION_CODE}/teams`);
      return data.teams || [];
    }
  }

  async getUpcomingMatches(): Promise<FootballDataMatch[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches?status=SCHEDULED&dateFrom=${today}`);
      return data.matches || [];
    } catch (error) {
      console.warn('Failed to fetch upcoming matches with date filter, trying all scheduled matches...');
      const data = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches?status=SCHEDULED`);
      return data.matches || [];
    }
  }

  async getTodayMatches(): Promise<FootballDataMatch[]> {
    const today = new Date().toISOString().split('T')[0];
    const data = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches?dateFrom=${today}&dateTo=${today}`);
    return data.matches || [];
  }

  /**
   * Fetch detailed team information including full squad
   */
  async getTeamById(teamId: number): Promise<FootballDataTeam | null> {
    try {
      const data = await this.fetchFromApi<FootballDataTeam>(`/teams/${teamId}`);
      return data as any; // The team endpoint returns the team directly, not wrapped
    } catch (error) {
      console.error(`Failed to fetch team ${teamId}:`, error);
      return null;
    }
  }

  /**
   * Get all matches with better error handling and logging
   */
  async getAllMatches(): Promise<FootballDataMatch[]> {
    try {
      console.log(`Fetching matches from: /competitions/${COMPETITION_CODE}/matches`);
      const data = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches`);
      console.log(`API returned ${data.matches?.length || 0} matches`);
      
      // Log first match for debugging
      if (data.matches && data.matches.length > 0) {
        console.log('Sample match structure:', JSON.stringify(data.matches[0], null, 2));
      }
      
      return data.matches || [];
    } catch (error) {
      console.error('Error fetching all matches:', error);
      return [];
    }
  }

  /**
   * Debug method to inspect API response structure
   */
  async debugApiResponse(): Promise<void> {
    try {
      console.log('=== COMPREHENSIVE API DEBUG ===');
      console.log('API Key configured:', !!this.apiKey);
      console.log('Competition Code:', COMPETITION_CODE);
      
      // Test competition info
      console.log('\n1. Competition Info:');
      const compData = await this.fetchFromApi(`/competitions/${COMPETITION_CODE}`);
      console.log('Competition response:', JSON.stringify(compData, null, 2));
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test matches endpoint with different approaches
      console.log('\n2. Matches Endpoint Tests:');
      
      try {
        console.log('Testing: /competitions/CL/matches');
        const matchesResponse = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches`);
        console.log(`Matches found: ${matchesResponse.matches?.length || 0}`);
        
        if (matchesResponse.matches && matchesResponse.matches.length > 0) {
          console.log('First match structure:');
          console.log(JSON.stringify(matchesResponse.matches[0], null, 2));
          
          // Check if team data exists
          const firstMatch = matchesResponse.matches[0];
          console.log('Home team exists:', !!firstMatch.homeTeam);
          console.log('Away team exists:', !!firstMatch.awayTeam);
          console.log('Home team name:', firstMatch.homeTeam?.name);
          console.log('Away team name:', firstMatch.awayTeam?.name);
        }
      } catch (error) {
        console.error('Matches endpoint error:', error);
      }
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test teams endpoint
      console.log('\n3. Teams Endpoint Tests:');
      
      try {
        console.log('Testing: /competitions/CL/teams');
        const teamsResponse = await this.fetchFromApi<FootballDataTeam>(`/competitions/${COMPETITION_CODE}/teams`);
        console.log(`Teams found: ${teamsResponse.teams?.length || 0}`);
        
        if (teamsResponse.teams && teamsResponse.teams.length > 0) {
          console.log('First team structure:');
          console.log(JSON.stringify(teamsResponse.teams[0], null, 2));
        }
      } catch (error) {
        console.error('Teams endpoint error:', error);
      }
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test individual team endpoint
      console.log('\n4. Individual Team Test (Real Madrid - ID 86):');
      
      try {
        const teamResponse = await this.fetchFromApi(`/teams/86`);
        console.log('Individual team response structure:');
        console.log('Keys:', Object.keys(teamResponse));
        console.log('Has squad?:', !!(teamResponse as any).squad);
        console.log('Squad length:', (teamResponse as any).squad?.length || 0);
        
        if ((teamResponse as any).squad) {
          console.log('First squad member:', JSON.stringify((teamResponse as any).squad[0], null, 2));
        }
      } catch (error) {
        console.error('Individual team endpoint error:', error);
      }
      
    } catch (error) {
      console.error('API Debug failed:', error);
    }
  }

  /**
   * Enhanced debug method specifically for match data issues
   */
  async debugMatchStructure(): Promise<void> {
    try {
      console.log('\n=== MATCH STRUCTURE DEBUG ===');
      
      const response = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches`);
      
      if (!response.matches || response.matches.length === 0) {
        console.log('No matches returned from API');
        return;
      }
      
      console.log(`Total matches: ${response.matches.length}`);
      
      // Analyze match statuses
      const statusCounts = response.matches.reduce((acc, match) => {
        acc[match.status] = (acc[match.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('Match status distribution:', statusCounts);
      
      // Find matches with missing team data
      const matchesWithMissingTeams = response.matches.filter(match => 
        !match.homeTeam?.name || !match.awayTeam?.name
      );
      
      console.log(`Matches with missing team data: ${matchesWithMissingTeams.length}`);
      
      if (matchesWithMissingTeams.length > 0) {
        console.log('Sample match with missing teams:');
        console.log(JSON.stringify(matchesWithMissingTeams[0], null, 2));
      }
      
      // Find matches with complete team data
      const matchesWithCompleteTeams = response.matches.filter(match => 
        match.homeTeam?.name && match.awayTeam?.name
      );
      
      console.log(`Matches with complete team data: ${matchesWithCompleteTeams.length}`);
      
      if (matchesWithCompleteTeams.length > 0) {
        console.log('Sample match with complete teams:');
        console.log(JSON.stringify(matchesWithCompleteTeams[0], null, 2));
      }
      
      // Check upcoming vs past matches
      const now = new Date();
      const upcomingMatches = response.matches.filter(match => new Date(match.utcDate) > now);
      const pastMatches = response.matches.filter(match => new Date(match.utcDate) <= now);
      
      console.log(`Upcoming matches: ${upcomingMatches.length}`);
      console.log(`Past matches: ${pastMatches.length}`);
      
    } catch (error) {
      console.error('Match structure debug failed:', error);
    }
  }
}

export const footballDataApi = new FootballDataApiService(process.env.FOOTBALL_DATA_API_KEY || "");
