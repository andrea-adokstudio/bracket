import { readFile } from "node:fs/promises"
import path from "node:path"

import { deriveGironeRoundNumbers } from "@/lib/event-rounds"
import { normalizeGroupedEvents, type DashboardData, type EventsFileData, type StandingsFileData } from "@/lib/types"

const STANDINGS_FILE = path.join(process.cwd(), "data", "standings.json")
const EVENTS_FILE = path.join(process.cwd(), "data", "events.json")

export async function getDashboardData(): Promise<DashboardData> {
  const [standingsRaw, eventsRaw] = await Promise.all([
    readFile(STANDINGS_FILE, "utf8"),
    readFile(EVENTS_FILE, "utf8"),
  ])

  const standings = JSON.parse(standingsRaw) as StandingsFileData
  const eventsFile = JSON.parse(eventsRaw) as EventsFileData
  const groupedEvents = normalizeGroupedEvents(eventsFile.events)

  const partial: DashboardData = {
    seasonLabel: standings.seasonLabel,
    updatedAt: standings.updatedAt,
    rounds: eventsFile.rounds,
    standings: standings.standings,
    events: groupedEvents,
  }

  return {
    ...partial,
    rounds: deriveGironeRoundNumbers(partial),
  }
}
