import { readFile } from "node:fs/promises"
import path from "node:path"

import type { DashboardData, EventsFileData, StandingsFileData } from "@/lib/types"

const STANDINGS_FILE = path.join(process.cwd(), "data", "standings.json")
const EVENTS_FILE = path.join(process.cwd(), "data", "events.json")

export async function getDashboardData(): Promise<DashboardData> {
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
