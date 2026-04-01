import type { DashboardData, MatchEvent } from "@/lib/types"

export function isMatchOriginallyFinished(match: MatchEvent): boolean {
  return (
    match.statusType === "finished" ||
    match.status.toLowerCase() === "ended" ||
    match.status.toLowerCase() === "aet"
  )
}

function getPendingMatchIds(eventsByRound: Record<string, MatchEvent[]>): number[] {
  const ids: number[] = []
  for (const matches of Object.values(eventsByRound)) {
    for (const m of matches) {
      if (!isMatchOriginallyFinished(m)) ids.push(m.id)
    }
  }
  return [...new Set(ids)].sort((x, y) => x - y)
}

export function getAllPendingIds(data: DashboardData): number[] {
  const a = getPendingMatchIds(data.events.gironeA)
  const b = getPendingMatchIds(data.events.gironeB)
  return [...new Set([...a, ...b])].sort((x, y) => x - y)
}

/** Chiave per `key` sul componente: al cambio si reinizializza lo stato e si rilegge il localStorage. */
export function getSimulationPageResetKey(data: DashboardData): string {
  const ids = getAllPendingIds(data)
  return `${data.updatedAt}:${ids.length ? ids.join(",") : "none"}`
}
