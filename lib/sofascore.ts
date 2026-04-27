import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fetch as undiciFetch, ProxyAgent } from "undici"

import {
  normalizeGroupedEvents,
  type DashboardData,
  type EventsBucketKey,
  type EventsFileData,
  type GroupKey,
  type GroupedEvents,
  type GroupedStandings,
  type MatchScore,
  type MatchEvent,
  type StandingRow,
  type StandingsFileData,
} from "@/lib/types"
import { resolveEventStorageKey } from "@/lib/event-rounds"

const TOURNAMENT_ID = 27700
const SEASON_ID = 77655
const SEASON_LABEL = "25/26"
const API_BASES = ["https://www.sofascore.com/api/v1", "https://api.sofascore.app/api/v1"] as const
const REQUEST_RETRIES = 3
const RETRY_DELAY_MS = 1200
const REQUEST_TIMEOUT_MS = 25_000
const ROUND_CONCURRENCY = 1
const ROUND_RETRY_STATUS = new Set([403, 429, 502, 503, 504])
const ROUND_RETRIES = 4
const ROUND_RETRY_BASE_DELAY_MS = 1400
const ROUND_JITTER_MIN_MS = 350
const ROUND_JITTER_MAX_MS = 900

/** Allineato a richieste XHR dal sito (riduce 403 da WAF su IP datacenter / client “nudi”). */
const SOFASCORE_WEB_ORIGIN = "https://www.sofascore.com"
const SOFASCORE_TOURNAMENT_PATH = `/it/basketball/tournament/italy/serie-b-interregionale/${TOURNAMENT_ID}`
const SOFASCORE_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

/** Cookie raccolti dalla visita alle pagine HTML (molte API rispondono 403 senza Cookie). */
let sessionCookieHeader: string | undefined

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

/** Sempre undici: stesso stack e `getSetCookie` coerente (Node fetch varia tra versioni). */
function sofascoreRequest(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  const dispatcher = getSofascoreProxyAgent()
  return undiciFetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers,
    ...(dispatcher ? { dispatcher } : {}),
    signal,
  }) as unknown as Promise<Response>
}

function mergeSetCookieIntoJar(response: Response, jar: Map<string, string>): void {
  const raw = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof raw.getSetCookie !== "function") return
  for (const line of raw.getSetCookie()) {
    const pair = line.split(";")[0]?.trim()
    if (!pair?.includes("=")) continue
    const eq = pair.indexOf("=")
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (name) jar.set(name, value)
  }
}

function cookieJarToHeader(jar: Map<string, string>): string | undefined {
  if (jar.size === 0) return undefined
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
}

function getApiHeaders(): Record<string, string> {
  const refererPage = `${SOFASCORE_WEB_ORIGIN}${SOFASCORE_TOURNAMENT_PATH}`
  const envCookie = process.env.SOFASCORE_COOKIE?.trim()
  const cookie = envCookie || sessionCookieHeader

  const h: Record<string, string> = {
    "User-Agent": SOFASCORE_CHROME_UA,
    Accept: "application/json",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    Referer: refererPage,
    Origin: SOFASCORE_WEB_ORIGIN,
    "X-Requested-With": "XMLHttpRequest",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  }
  if (cookie) h.Cookie = cookie
  return h
}

async function primeSofascoreSessionOnce(): Promise<void> {
  if (sofascoreSessionPrimed) return
  sofascoreSessionPrimed = true
  const jar = new Map<string, string>()
  const htmlHeaders: Record<string, string> = {
    "User-Agent": SOFASCORE_CHROME_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
    Referer: `${SOFASCORE_WEB_ORIGIN}/`,
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
  }
  const pages = [`${SOFASCORE_WEB_ORIGIN}/`, `${SOFASCORE_WEB_ORIGIN}${SOFASCORE_TOURNAMENT_PATH}`]
  try {
    for (const pageUrl of pages) {
      const res = await sofascoreRequest(pageUrl, {
        ...htmlHeaders,
        Referer: pageUrl === pages[0] ? `${SOFASCORE_WEB_ORIGIN}/` : `${SOFASCORE_WEB_ORIGIN}/`,
      })
      mergeSetCookieIntoJar(res, jar)
      await res.arrayBuffer().catch(() => {})
    }
    sessionCookieHeader = cookieJarToHeader(jar)
  } catch {
    /* pagina opzionale: può restare solo SOFASCORE_COOKIE / proxy */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getApiBasesForCurrentNetwork(): readonly string[] {
  // Con proxy anti-bot (ScraperAPI), sofascore.app mostra instabilita maggiore rispetto a sofascore.com.
  if (getSofascoreProxyAgent()) {
    return [API_BASES[0]]
  }
  return API_BASES
}

const GROUP_LABEL_TO_KEY: Record<string, GroupKey> = {
  "Division A": "gironeA",
  "Division B": "gironeB",
}

async function fetchJson<T>(endpoint: string): Promise<T> {
  await primeSofascoreSessionOnce()

  let lastError = "errore sconosciuto"
  const bases = getApiBasesForCurrentNetwork()

  for (const base of bases) {
    for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt++) {
      const url = `${base}${endpoint}`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const response = await sofascoreRequest(url, getApiHeaders(), controller.signal)

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
      } finally {
        clearTimeout(timer)
      }

      if (attempt < REQUEST_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }

  const hint403 =
    lastError.includes("403") || lastError.includes("Forbidden")
      ? " Suggerimenti: esporta SOFASCORE_COOKIE con il valore dell’header Cookie preso da DevTools (Network, richiesta verso api/v1), oppure usa HTTPS_PROXY (IP residenziale / servizio anti-bot)."
      : ""
  throw new Error(`${lastError}${hint403}`)
}

function extractGroupKey(groupName?: string): GroupKey | null {
  if (!groupName) return null
  return GROUP_LABEL_TO_KEY[groupName] ?? null
}

/**
 * Fasi playoff / playout incrociate A–B (stesso unique tournament 27700 della pagina SofaScore).
 * Va valutata prima del girone: spesso `groupName` resta "Division A/B" anche in seconda fase.
 */
function classifyCrossGroupBucket(meta: {
  tournament?: { name?: string; slug?: string; groupName?: string }
  tournamentStage?: { name?: string; slug?: string }
  seasonStage?: { name?: string; slug?: string }
  roundInfo?: { name?: string; slug?: string; type?: string }
}): "playoffAB" | "playoutAB" | null {
  const parts = [
    meta.tournamentStage?.slug,
    meta.tournamentStage?.name,
    meta.seasonStage?.slug,
    meta.seasonStage?.name,
    meta.roundInfo?.slug,
    meta.roundInfo?.name,
    meta.roundInfo?.type,
    meta.tournament?.name,
    meta.tournament?.slug,
    meta.tournament?.groupName,
  ]
  const haystack = parts
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .join(" ")
    .toLowerCase()

  if (!haystack.trim()) return null

  if (
    /\bplayout\b/.test(haystack) ||
    /\brelegation\b/.test(haystack) ||
    haystack.includes("retrocess") ||
    haystack.includes("retroced") ||
    haystack.includes("salvezza") ||
    haystack.includes("mantenimento") ||
    haystack.includes("spareggi salvezza") ||
    /\btabellone\s*[cd]\b/.test(haystack) ||
    haystack.includes("tabellone-c") ||
    haystack.includes("tabellone-d")
  ) {
    return "playoutAB"
  }

  if (
    /\bplayoff\b/.test(haystack) ||
    /\bplay-offs\b/.test(haystack) ||
    haystack.includes("play off") ||
    haystack.includes("post season") ||
    haystack.includes("postseason") ||
    haystack.includes("qualificat") ||
    /\btabellone\s*[ab]\b/.test(haystack) ||
    haystack.includes("tabellone-a") ||
    haystack.includes("tabellone-b") ||
    /\bknockout\b/.test(haystack) ||
    /\b(elimination|eliminazione)\b/.test(haystack) ||
    /\b(quarter|semi)-?final/.test(haystack) ||
    haystack.includes("quarti di finale") ||
    haystack.includes("semifinali") ||
    (/\bfinale\b/.test(haystack) &&
      (/\b(conference|conf\.|playoff|tabellone)\b/.test(haystack) || haystack.includes("finale di")))
  ) {
    return "playoffAB"
  }

  return null
}

function resolveEventsBucket(event: {
  tournament?: { name?: string; slug?: string; groupName?: string }
  tournamentStage?: { name?: string; slug?: string }
  seasonStage?: { name?: string; slug?: string }
  /** Variante API: stessa semantica di `seasonStage` */
  stage?: { name?: string; slug?: string }
  roundInfo?: { round?: number; name?: string; slug?: string; type?: string }
}): EventsBucketKey | null {
  const phaseBucket = classifyCrossGroupBucket({
    tournament: event.tournament,
    tournamentStage: event.tournamentStage,
    seasonStage: event.seasonStage ?? event.stage,
    roundInfo: event.roundInfo,
  })
  if (phaseBucket) return phaseBucket
  const division = extractGroupKey(event.tournament?.groupName)
  if (division) return division
  return null
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
  const grouped: GroupedEvents = {
    gironeA: {},
    gironeB: {},
    playoffAB: {},
    playoutAB: {},
  }
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
        tournament?: { name?: string; slug?: string; groupName?: string }
        tournamentStage?: { name?: string; slug?: string }
        seasonStage?: { name?: string; slug?: string }
        stage?: { name?: string; slug?: string }
        roundInfo?: { round: number; name?: string; slug?: string; type?: string }
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
        const bucket = resolveEventsBucket(event)
        if (!bucket) continue

        const groupLabel =
          event.tournament?.groupName?.trim() ||
          [
            event.seasonStage?.name,
            event.stage?.name,
            event.tournamentStage?.name,
            event.roundInfo?.name,
            event.tournament?.name,
          ]
            .filter(Boolean)
            .join(" — ") ||
          bucket

        const roundLabelRaw = event.roundInfo?.name?.trim()
        const roundSlugRaw = event.roundInfo?.slug?.trim()
        const roundNum = event.roundInfo?.round ?? round

        const normalized: MatchEvent = {
          id: event.id,
          round: roundNum,
          startTimestamp: event.startTimestamp,
          status: event.status.description,
          statusType: event.status.type,
          groupName: groupLabel,
          roundLabel: roundLabelRaw || undefined,
          roundSlug: roundSlugRaw || undefined,
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

        const storageKey = resolveEventStorageKey(
          bucket,
          roundLabelRaw,
          roundSlugRaw,
          roundNum,
          round,
        )

        if (!grouped[bucket][storageKey]) {
          grouped[bucket][storageKey] = []
        }
        grouped[bucket][storageKey].push(normalized)
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
  const events = normalizeGroupedEvents(await fetchEventsByRound(rounds))
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
  const events = normalizeGroupedEvents(await fetchEventsByRound(rounds))
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
