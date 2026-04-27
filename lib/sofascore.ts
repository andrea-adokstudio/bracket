import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fetch as undiciFetch, ProxyAgent } from "undici"

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
const API_BASES = ["https://api.sofascore.app/api/v1", "https://www.sofascore.com/api/v1"] as const
const REQUEST_RETRIES = 3
const RETRY_DELAY_MS = 1200
const ROUND_CONCURRENCY = 1
const ROUND_RETRY_STATUS = new Set([403, 429, 502, 503, 504])
const ROUND_RETRIES = 4
const ROUND_RETRY_BASE_DELAY_MS = 1400
const ROUND_JITTER_MIN_MS = 350
const ROUND_JITTER_MAX_MS = 900

/** Allineato a richieste XHR dal sito (riduce 403 da WAF su IP datacenter / client “nudi”). */
const SOFASCORE_WEB_ORIGIN = "https://www.sofascore.com"
const SOFASCORE_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

const SOFASCORE_JSON_HEADERS: Record<string, string> = {
  "User-Agent": SOFASCORE_CHROME_UA,
  Accept: "application/json",
  "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
  Referer: `${SOFASCORE_WEB_ORIGIN}/`,
  Origin: SOFASCORE_WEB_ORIGIN,
}

let sofascoreSessionPrimed = false

let cachedProxyUrl: string | undefined
let cachedProxyAgent: ProxyAgent | undefined

function getSofascoreProxyAgent(): ProxyAgent | undefined {
  const url = (process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? "").trim()
  if (!url) return undefined
  if (cachedProxyUrl !== url) {
    cachedProxyUrl = url
    // ScraperAPI (e simili) intercettano HTTPS: il certificato presentato non corrisponde a sofascore.
    cachedProxyAgent = new ProxyAgent({
      uri: url,
      requestTls: { rejectUnauthorized: false },
    })
  }
  return cachedProxyAgent
}

/**
 * Con proxy: undici + ProxyAgent (routing affidabile da CI).
 * Senza proxy: fetch nativo (stesso stack TLS di prima, meno divergenze rispetto al browser).
 */
function sofascoreRequest(url: string, headers: Record<string, string>): Promise<Response> {
  const dispatcher = getSofascoreProxyAgent()
  if (dispatcher) {
    return undiciFetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers,
      dispatcher,
    }) as unknown as Promise<Response>
  }
  return fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers,
  })
}

async function primeSofascoreSessionOnce(): Promise<void> {
  if (sofascoreSessionPrimed) return
  sofascoreSessionPrimed = true
  try {
    await sofascoreRequest(`${SOFASCORE_WEB_ORIGIN}/`, {
      "User-Agent": SOFASCORE_CHROME_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    })
  } catch {
    /* cookie/WAF opzionali: le API possono funzionare comunque */
  }
}

function sofascoreFetch(url: string): Promise<Response> {
  return sofascoreRequest(url, SOFASCORE_JSON_HEADERS)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const GROUP_LABEL_TO_KEY: Record<string, GroupKey> = {
  "Division A": "gironeA",
  "Division B": "gironeB",
}

async function fetchJson<T>(endpoint: string): Promise<T> {
  await primeSofascoreSessionOnce()

  let lastError = "errore sconosciuto"

  for (const base of API_BASES) {
    for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt++) {
      const url = `${base}${endpoint}`
      try {
        const response = await sofascoreFetch(url)

        if (!response.ok) {
          const body = await response.text().catch(() => "")
          lastError = `Richiesta fallita ${endpoint}: ${response.status} ${body.slice(0, 200)}`
        } else {
          const text = await response.text()
          if (!text) {
            lastError = `Risposta vuota ${endpoint} (base: ${base}, tentativo: ${attempt})`
          } else {
            return JSON.parse(text) as T
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        lastError = `Errore rete ${endpoint} (base: ${base}, tentativo: ${attempt}): ${message}`
      }

      if (attempt < REQUEST_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }

  throw new Error(lastError)
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

async function fetchRoundEvents(round: number): Promise<{ events: unknown[] }> {
  const endpoint = `/unique-tournament/${TOURNAMENT_ID}/season/${SEASON_ID}/events/round/${round}`
  let lastError = "errore sconosciuto"

  for (let attempt = 1; attempt <= ROUND_RETRIES; attempt++) {
    try {
      return await fetchJson<{ events: unknown[] }>(endpoint)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastError = message
      const statusMatch = message.match(/: (\d{3})\b/)
      const statusCode = statusMatch ? Number(statusMatch[1]) : null
      const shouldRetry = statusCode !== null && ROUND_RETRY_STATUS.has(statusCode)
      if (!shouldRetry || attempt >= ROUND_RETRIES) break
      const backoff = ROUND_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
      await sleep(backoff + randomInt(ROUND_JITTER_MIN_MS, ROUND_JITTER_MAX_MS))
    }
  }

  throw new Error(`Round ${round} non recuperato: ${lastError}`)
}

async function fetchEventsByRound(rounds: number[]): Promise<GroupedEvents> {
  const grouped: GroupedEvents = { gironeA: {}, gironeB: {} }
  for (let i = 0; i < rounds.length; i += ROUND_CONCURRENCY) {
    const chunk = rounds.slice(i, i + ROUND_CONCURRENCY)
    const roundPayloads = await Promise.all(
      chunk.map(async (round) => {
        const payload = await fetchRoundEvents(round)
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

    // Piccolo jitter tra round/chunk per ridurre pattern ripetitivi sul proxy.
    await sleep(randomInt(ROUND_JITTER_MIN_MS, ROUND_JITTER_MAX_MS))
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
