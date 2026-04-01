"use client"

import type { DashboardData, GroupKey, GroupedEvents, GroupedStandings, MatchEvent, MatchScore, StandingRow } from "@/lib/types"

const TOURNAMENT_ID = 27700
const SEASON_ID = 77655
const SEASON_LABEL = "25/26"
const API_BASE = "/sofascore-proxy"

const GROUP_LABEL_TO_KEY: Record<string, GroupKey> = {
  "Division A": "gironeA",
  "Division B": "gironeB",
}

async function fetchJson<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { accept: "application/json, text/plain, */*" },
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Richiesta fallita ${endpoint}: ${response.status}`)
  }
  return (await response.json()) as T
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
  const normalized: MatchScore = { current: score?.current ?? 0 }
  if (!score) return normalized
  for (const [key, value] of Object.entries(score)) {
    if (key !== "current" && typeof value === "number") normalized[key] = value
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
    const payloads = await Promise.all(
      chunk.map(async (round) => {
        const payload = await fetchJson<{ events: unknown[] }>(
          `/unique-tournament/${TOURNAMENT_ID}/season/${SEASON_ID}/events/round/${round}`,
        )
        return { round, payload }
      }),
    )

    for (const { round, payload } of payloads) {
      const roundEvents = payload.events as Array<{
        id: number
        startTimestamp: number
        status: { description: string; type: string }
        tournament?: { groupName?: string }
        roundInfo?: { round: number }
        homeTeam: { id: number; name: string; slug: string; shortName?: string }
        awayTeam: { id: number; name: string; slug: string; shortName?: string }
        homeScore?: { current?: number; [key: string]: number | undefined }
        awayScore?: { current?: number; [key: string]: number | undefined }
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
        if (!grouped[groupKey][String(round)]) grouped[groupKey][String(round)] = []
        grouped[groupKey][String(round)].push(normalized)
      }
    }
  }
  return grouped
}

export async function fetchLiveDashboardDataClient(): Promise<DashboardData> {
  const standings = await fetchStandings()
  const rounds = await fetchRounds()
  const events = await fetchEventsByRound(rounds)
  return {
    seasonLabel: SEASON_LABEL,
    updatedAt: new Date().toISOString(),
    rounds,
    standings,
    events,
  }
}
