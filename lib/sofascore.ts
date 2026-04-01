import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  DashboardData,
  EventsFileData,
  GroupKey,
  GroupedEvents,
  GroupedStandings,
  MatchScore,
  MatchEvent,
  StandingRow,
  StandingsFileData,
} from "@/lib/types"

const TOURNAMENT_ID = 27700
const SEASON_ID = 77655
const SEASON_LABEL = "25/26"
const API_BASE = "https://api.sofascore.app/api/v1"

const GROUP_LABEL_TO_KEY: Record<string, GroupKey> = {
  "Division A": "gironeA",
  "Division B": "gironeB",
}

async function fetchJson<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, { cache: "no-store" })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Richiesta fallita ${endpoint}: ${response.status} ${body.slice(0, 200)}`)
  }

  const text = await response.text()
  if (!text) {
    throw new Error(`Risposta vuota ${endpoint}`)
  }

  return JSON.parse(text) as T
}

function extractGroupKey(groupName?: string): GroupKey | null {
  if (!groupName) return null
  return GROUP_LABEL_TO_KEY[groupName] ?? null
}

function normalizeScore(
  score:
    | {
      current?: number
      [key: string]: number | undefined
    }
    | undefined,
): MatchScore {
  const normalized: MatchScore = {
    current: score?.current ?? 0,
  }

  if (!score) return normalized

  for (const [key, value] of Object.entries(score)) {
    if (key === "current") continue
    if (typeof value === "number") {
      normalized[key] = value
    }
  }

  return normalized
}

async function fetchStandings(): Promise<GroupedStandings> {
  const payload = await fetchJson<{
    standings: Array<{
      rows: Array<{
        position: number
        matches: number
        wins: number
        losses: number
        points: number
        scoresFor: number
        scoresAgainst: number
        scoreDiffFormatted: string
        team: { id: number; name: string; slug: string; shortName?: string }
      }>
      tournament?: { groupName?: string }
    }>
  }>(`/unique-tournament/${TOURNAMENT_ID}/season/${SEASON_ID}/standings/total`)

  const grouped: GroupedStandings = { gironeA: [], gironeB: [] }

  for (const standing of payload.standings) {
    const groupKey = extractGroupKey(standing.tournament?.groupName)
    if (!groupKey) continue

    grouped[groupKey] = standing.rows.map(
      (row): StandingRow => ({
        position: row.position,
        matches: row.matches,
        wins: row.wins,
        losses: row.losses,
        points: row.points,
        scoresFor: row.scoresFor,
        scoresAgainst: row.scoresAgainst,
        scoreDiffFormatted: row.scoreDiffFormatted,
        team: {
          id: row.team.id,
          name: row.team.name,
          slug: row.team.slug,
          shortName: row.team.shortName,
        },
      }),
    )
  }

  return grouped
}

async function fetchRounds(): Promise<number[]> {
  const payload = await fetchJson<{ rounds: Array<{ round: number }> }>(
    `/unique-tournament/${TOURNAMENT_ID}/season/${SEASON_ID}/rounds`,
  )
  return payload.rounds.map((item) => item.round)
}

async function fetchEventsByRound(rounds: number[]): Promise<GroupedEvents> {
  const grouped: GroupedEvents = { gironeA: {}, gironeB: {} }
  const concurrency = 6
  for (let i = 0; i < rounds.length; i += concurrency) {
    const chunk = rounds.slice(i, i + concurrency)
    const roundPayloads = await Promise.all(
      chunk.map(async (round) => {
        const payload = await fetchJson<{ events: unknown[] }>(
          `/unique-tournament/${TOURNAMENT_ID}/season/${SEASON_ID}/events/round/${round}`,
        )
        return { round, payload }
      }),
    )

    for (const { round, payload } of roundPayloads) {
      const roundEvents = payload.events as Array<{
        id: number
        startTimestamp: number
        status: { description: string; type: string }
        tournament?: { groupName?: string }
        roundInfo?: { round: number }
        homeTeam: { id: number; name: string; slug: string; shortName?: string }
        awayTeam: { id: number; name: string; slug: string; shortName?: string }
        homeScore?: {
          current?: number
          [key: string]: number | undefined
        }
        awayScore?: {
          current?: number
          [key: string]: number | undefined
        }
      }>

      for (const event of roundEvents) {
        const groupKey = extractGroupKey(event.tournament?.groupName)
        if (!groupKey) continue

        const normalized: MatchEvent = {
          id: event.id,
          round: event.roundInfo?.round ?? round,
          startTimestamp: event.startTimestamp,
          status: event.status.description,
          statusType: event.status.type,
          groupName: event.tournament?.groupName as "Division A" | "Division B",
          homeTeam: {
            id: event.homeTeam.id,
            name: event.homeTeam.name,
            slug: event.homeTeam.slug,
            shortName: event.homeTeam.shortName,
          },
          awayTeam: {
            id: event.awayTeam.id,
            name: event.awayTeam.name,
            slug: event.awayTeam.slug,
            shortName: event.awayTeam.shortName,
          },
          homeScore: normalizeScore(event.homeScore),
          awayScore: normalizeScore(event.awayScore),
        }

        if (!grouped[groupKey][String(round)]) {
          grouped[groupKey][String(round)] = []
        }
        grouped[groupKey][String(round)].push(normalized)
      }
    }
  }

  return grouped
}

/** Dati live da Sofascore (per ambienti senza filesystem persistente, es. Vercel). */
export async function fetchLiveDashboardData(): Promise<DashboardData> {
  const standings = await fetchStandings()
  const rounds = await fetchRounds()
  const events = await fetchEventsByRound(rounds)
  const updatedAt = new Date().toISOString()

  return {
    seasonLabel: SEASON_LABEL,
    updatedAt,
    rounds,
    standings,
    events,
  }
}

export async function fetchAndSaveSofascoreData() {
  const standings = await fetchStandings()
  const rounds = await fetchRounds()
  const events = await fetchEventsByRound(rounds)
  const updatedAt = new Date().toISOString()

  const standingsPayload: StandingsFileData = {
    tournamentId: TOURNAMENT_ID,
    seasonId: SEASON_ID,
    seasonLabel: SEASON_LABEL,
    updatedAt,
    standings,
  }

  const eventsPayload: EventsFileData = {
    tournamentId: TOURNAMENT_ID,
    seasonId: SEASON_ID,
    seasonLabel: SEASON_LABEL,
    updatedAt,
    rounds,
    events,
  }

  const outputDir = path.join(process.cwd(), "data")
  await mkdir(outputDir, { recursive: true })
  await writeFile(
    path.join(outputDir, "standings.json"),
    JSON.stringify(standingsPayload, null, 2),
    "utf8",
  )
  await writeFile(path.join(outputDir, "events.json"), JSON.stringify(eventsPayload, null, 2), "utf8")

  return {
    updatedAt,
    roundsCount: rounds.length,
  }
}
