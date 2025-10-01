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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetchFromApi<T>(endpoint: string): Promise<FootballDataResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Football Data API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getChampionsLeagueMatches(): Promise<FootballDataMatch[]> {
    const data = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches`);
    return data.matches || [];
  }

  async getChampionsLeagueTeams(): Promise<FootballDataTeam[]> {
    const data = await this.fetchFromApi<FootballDataTeam>(`/competitions/${COMPETITION_CODE}/teams`);
    return data.teams || [];
  }

  async getUpcomingMatches(): Promise<FootballDataMatch[]> {
    const data = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches?status=SCHEDULED`);
    return data.matches || [];
  }

  async getTodayMatches(): Promise<FootballDataMatch[]> {
    const today = new Date().toISOString().split('T')[0];
    const data = await this.fetchFromApi<FootballDataMatch>(`/competitions/${COMPETITION_CODE}/matches?dateFrom=${today}&dateTo=${today}`);
    return data.matches || [];
  }
}

export const footballDataApi = new FootballDataApiService(process.env.FOOTBALL_DATA_API_KEY || "");
