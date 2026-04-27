export type GroupKey = "gironeA" | "gironeB"

/** Raggruppamento calendario: gironi + incroci playoff/playout tra A e B */
export type EventsBucketKey = GroupKey | "playoffAB" | "playoutAB"

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
  /** Etichetta torneo/girone lato SofaScore (es. Division A, fasi playoff). */
  groupName: string
  /** Nome fase turno SofaScore (es. "Ottavi di finale") — playoff/playout. */
  roundLabel?: string
  /** Slug fase turno dall'API, se presente. */
  roundSlug?: string
  homeTeam: TeamInfo
  awayTeam: TeamInfo
  homeScore: MatchScore
  awayScore: MatchScore
}

export type GroupedStandings = Record<GroupKey, StandingRow[]>
export type GroupedEvents = Record<EventsBucketKey, Record<string, MatchEvent[]>>

/** Ordine tab calendario: playoff/playout prima dei gironi. */
export const CALENDAR_TAB_ORDER: readonly EventsBucketKey[] = [
  "playoffAB",
  "playoutAB",
  "gironeA",
  "gironeB",
] as const

export function normalizeGroupedEvents(raw: GroupedEvents | Partial<GroupedEvents> | undefined): GroupedEvents {
  return {
    gironeA: raw?.gironeA ?? {},
    gironeB: raw?.gironeB ?? {},
    playoffAB: raw?.playoffAB ?? {},
    playoutAB: raw?.playoutAB ?? {},
  }
}

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
  /** Evidenzia la gara (es. semifinali che mandano alla finale di Conference) */
  star?: boolean
  /** Icona badge-sparkle nel titolo (es. finale di Conference) */
  badgeSparkle?: boolean
}

export interface BracketRound {
  name: string
  matches: BracketMatch[]
}

export interface BracketData {
  tabelloneA: BracketRound[]
  tabelloneB: BracketRound[]
  finaleConference: BracketRound[]
  tabelloneC: BracketRound[]
  tabelloneD: BracketRound[]
}
