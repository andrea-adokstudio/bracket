import type { DashboardData, EventsBucketKey, MatchEvent } from "@/lib/types"

/** Chiave stabile per bucket JSON da nome fase (es. ottavi-di-finale). */
export function slugifyRoundKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Gironi: chiave = giornata API. Playoff/playout: slug fase o slugificato da roundInfo.name. */
export function resolveEventStorageKey(
  bucket: EventsBucketKey,
  roundLabel: string | undefined,
  roundSlug: string | undefined,
  roundNum: number,
  fetchRoundNum: number,
): string {
  if (bucket === "gironeA" || bucket === "gironeB") {
    return String(fetchRoundNum)
  }
  const s = roundSlug?.trim()
  if (s) return s
  const lab = roundLabel?.trim()
  if (lab) return slugifyRoundKey(lab)
  return String(roundNum)
}

function minStartTimestamp(events: MatchEvent[] | undefined): number {
  if (!events?.length) return Number.POSITIVE_INFINITY
  return Math.min(...events.map((e) => e.startTimestamp))
}

/** Ordina chiavi bucket: numeriche come giornate; altrimenti per data minima partita. */
export function sortEventRoundKeys(
  keys: string[],
  eventsByRound: Record<string, MatchEvent[]>,
): string[] {
  return [...keys].sort((a, b) => {
    const digA = /^\d+$/.test(a)
    const digB = /^\d+$/.test(b)
    if (digA && digB) return Number(a) - Number(b)
    const ta = minStartTimestamp(eventsByRound[a])
    const tb = minStartTimestamp(eventsByRound[b])
    if (ta !== tb) return ta - tb
    return a.localeCompare(b)
  })
}

/** Etichetta selettore: nome fase SofaScore, altrimenti giornata, altrimenti chiave leggibile. */
export function formatRoundKeyLabel(key: string, events: MatchEvent[] | undefined): string {
  const fromEvent = events?.find((e) => e.roundLabel?.trim())?.roundLabel?.trim()
  if (fromEvent) return fromEvent
  if (/^\d+$/.test(key)) return `Giornata ${key}`
  return key.replace(/-/g, " ")
}

/**
 * Giornate per i gironi: da `events.json.rounds` e, in fallback, dalle chiavi numeriche di gironeA/B
 * (evita selettore vuoto se `rounds` è [] o non allineato al fetch).
 */
export function deriveGironeRoundNumbers(data: DashboardData): number[] {
  const merged = new Set<number>()
  for (const r of data.rounds) merged.add(r)
  for (const k of Object.keys(data.events.gironeA)) {
    if (/^\d+$/.test(k)) merged.add(Number(k))
  }
  for (const k of Object.keys(data.events.gironeB)) {
    if (/^\d+$/.test(k)) merged.add(Number(k))
  }
  return [...merged].sort((a, b) => a - b)
}

export function buildGironeRoundOptions(dataRounds: number[]): { value: string; label: string }[] {
  const ordered = [...new Set(dataRounds)].sort((a, b) => a - b)
  return ordered.map((r) => ({ value: String(r), label: `Giornata ${r}` }))
}

export function buildPhaseRoundOptions(
  eventsByRound: Record<string, MatchEvent[]>,
): { value: string; label: string }[] {
  const keys = sortEventRoundKeys(Object.keys(eventsByRound), eventsByRound)
  return keys.map((k) => ({
    value: k,
    label: formatRoundKeyLabel(k, eventsByRound[k]),
  }))
}
