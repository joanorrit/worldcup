export interface MatchdayAdvancingTeamMatch {
  flagSrc: string;
  team: string;
}

export interface MatchdayGuess {
  player: string;
  homeGoals: string;
  awayGoals: string;
  homePenaltyGoals: string;
  awayPenaltyGoals: string;
  homeTeam: string;
  awayTeam: string;
  teamsMatch: boolean;
  resultMatch: boolean | null;
  signMatch: boolean | null;
  advancingTeamMatch: MatchdayAdvancingTeamMatch | null;
}

export interface MatchdayMatch {
  id: string;
  dateKey: string;
  utcDate: string;
  displayTime: string | null;
  status: string;
  stage: string;
  group: string | null;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  guesses: MatchdayGuess[];
}

export interface MatchdayView {
  dateKey: string;
  matches: MatchdayMatch[];
}

export interface HomepageMatchdayData {
  generatedAt: string | null;
  initialDateKey: string | null;
  matchdays: MatchdayView[];
  source: string;
  todayDateKey: string;
  timeZone: string;
}
