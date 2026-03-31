import { readFile } from "node:fs/promises"
import path from "node:path"

import { unstable_noStore as noStore } from "next/cache"

import type { DashboardData, EventsFileData, StandingsFileData } from "@/lib/types"
import { fetchLiveDashboardData } from "@/lib/sofascore"

const STANDINGS_FILE = path.join(process.cwd(), "data", "standings.json")
const EVENTS_FILE = path.join(process.cwd(), "data", "events.json")

export async function getDashboardData(): Promise<DashboardData> {
  const isVercel = process.env.VERCEL === "1"
  if (isVercel) {
    noStore()
    try {
      return await fetchLiveDashboardData()
    } catch {
      // Fallback to bundled JSON if live upstream is temporarily unavailable.
    }
  }

  const [standingsRaw, eventsRaw] = await Promise.all([
    readFile(STANDINGS_FILE, "utf8"),
    readFile(EVENTS_FILE, "utf8"),
  ])

  const standings = JSON.parse(standingsRaw) as StandingsFileData
  const events = JSON.parse(eventsRaw) as EventsFileData

  return {
    seasonLabel: standings.seasonLabel,
    updatedAt: standings.updatedAt,
    rounds: events.rounds,
    standings: standings.standings,
    events: events.events,
  }
}
