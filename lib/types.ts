export type GroupKey = "gironeA" | "gironeB"

export type TournamentGroupName = "Division A" | "Division B"

export interface TeamInfo {
  id: number
  name: string
  slug: string
  shortName?: string
}

export interface StandingRow {
  position: number
  matches: number
  wins: number
  losses: number
  points: number
  scoresFor: number
  scoresAgainst: number
  scoreDiffFormatted: string
  team: TeamInfo
}

export interface MatchScore {
  current: number
  period1?: number
  period2?: number
  period3?: number
  period4?: number
  overtime?: number
  [key: string]: number | undefined
}

export interface MatchEvent {
  id: number
  round: number
  startTimestamp: number
  status: string
  statusType: string
  groupName: TournamentGroupName
  homeTeam: TeamInfo
  awayTeam: TeamInfo
  homeScore: MatchScore
  awayScore: MatchScore
}

export type GroupedStandings = Record<GroupKey, StandingRow[]>
export type GroupedEvents = Record<GroupKey, Record<string, MatchEvent[]>>

export interface StandingsFileData {
  seasonId: number
  tournamentId: number
  seasonLabel: string
  updatedAt: string
  standings: GroupedStandings
}

export interface EventsFileData {
  seasonId: number
  tournamentId: number
  seasonLabel: string
  rounds: number[]
  updatedAt: string
  events: GroupedEvents
}

export interface DashboardData {
  seasonLabel: string
  updatedAt: string
  rounds: number[]
  standings: GroupedStandings
  events: GroupedEvents
}

export type ClassificationZone =
  | "playoff-assured"
  | "playoff-zone"
  | "safe"
  | "playout-zone"
  | "relegated"

export interface ClassificationResult {
  teamId: number
  currentRank: number
  bestPossibleRank: number
  worstPossibleRank: number
  zone: ClassificationZone
}

export type BracketGroup = "A" | "B"

export interface BracketMatch {
  label: string
  homeTeam: TeamInfo | null
  awayTeam: TeamInfo | null
  homePosition?: number
  awayPosition?: number
  homeGroup?: BracketGroup
  awayGroup?: BracketGroup
  homePlaceholder?: string
  awayPlaceholder?: string
}

export interface BracketRound {
  name: string
  matches: BracketMatch[]
}

export interface BracketData {
  tabelloneA: BracketRound[]
  tabelloneB: BracketRound[]
  finaleConference: BracketRound[]
  tabelloneC: BracketMatch[]
  tabelloneD: BracketMatch[]
}
