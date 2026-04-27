"use client"

import { useEffect, useMemo, useState } from "react"
import {
  IconCalendar,
  IconCircleArrowLeft,
  IconCircleArrowRight,
  IconDial,
} from "nucleo-glass"

import { MatchCard } from "@/components/match-card"
import { RoundSelector } from "@/components/round-selector"
import { StandingsTable } from "@/components/standings-table"
import { TeamMatchesDrawer } from "@/components/team-matches-drawer"
import { TeamLogo } from "@/components/team-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { computeClassificationZones, computeResolvedStandings } from "@/lib/classification"
import {
  buildGironeRoundOptions,
  buildPhaseRoundOptions,
  deriveGironeRoundNumbers,
  sortEventRoundKeys,
} from "@/lib/event-rounds"
import { formatItalianDateParts } from "@/lib/format-italian-date"
import {
  CALENDAR_TAB_ORDER,
  type ClassificationResult,
  type DashboardData,
  type EventsBucketKey,
  type GroupKey,
  type StandingRow,
} from "@/lib/types"

interface SeasonDashboardProps {
  data: DashboardData
  view: "classifica" | "calendario"
}

const CLASSIFICA_TAB_ORDER: readonly EventsBucketKey[] = ["gironeA", "gironeB"]

const TAB_LABELS: Record<EventsBucketKey, string> = {
  playoffAB: "Playoff A/B",
  playoutAB: "Playout A/B",
  gironeA: "Girone A",
  gironeB: "Girone B",
}

function isStandingGroup(groupKey: EventsBucketKey): groupKey is GroupKey {
  return groupKey === "gironeA" || groupKey === "gironeB"
}

/** Tab calendario iniziale: primo bucket con partite (evita schermata vuota se playoff/playout non ancora in JSON). */
function firstCalendarTabWithData(data: DashboardData): EventsBucketKey {
  for (const key of CALENDAR_TAB_ORDER) {
    if (Object.keys(data.events[key]).length > 0) return key
  }
  return "gironeA"
}

function getClosestRoundKey(data: DashboardData, bucket: EventsBucketKey, nowMs: number): string {
  const evMap = data.events[bucket]
  if (isStandingGroup(bucket)) {
    const ordered = deriveGironeRoundNumbers(data)
    if (ordered.length === 0) return "1"
    let bestKey = String(ordered[0])
    let bestDist = Number.POSITIVE_INFINITY
    let anyWithEvents = false
    for (const r of ordered) {
      const sk = String(r)
      const events = evMap[sk] ?? []
      if (events.length === 0) continue
      anyWithEvents = true
      const avgMs =
        (events.reduce((acc, event) => acc + event.startTimestamp, 0) / events.length) * 1000
      const d = Math.abs(avgMs - nowMs)
      if (d < bestDist) {
        bestDist = d
        bestKey = sk
      }
    }
    return anyWithEvents ? bestKey : String(ordered[0])
  }

  const keys = sortEventRoundKeys(Object.keys(evMap), evMap)
  if (keys.length === 0) return ""
  let bestKey = keys[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const key of keys) {
    const events = evMap[key] ?? []
    if (events.length === 0) continue
    const avgMs =
      (events.reduce((acc, event) => acc + event.startTimestamp, 0) / events.length) * 1000
    const d = Math.abs(avgMs - nowMs)
    if (d < bestDist) {
      bestDist = d
      bestKey = key
    }
  }
  return bestKey
}

function GroupContent({
  groupKey,
  data,
  rows,
  classifications,
  selectedRoundKey,
  onRoundChange,
  onTeamClick,
  view,
}: {
  groupKey: EventsBucketKey
  data: DashboardData
  rows: StandingRow[]
  classifications: ClassificationResult[]
  selectedRoundKey: string
  onRoundChange: (roundKey: string) => void
  onTeamClick: (teamId: number, teamName: string, group: EventsBucketKey) => void
  view: "classifica" | "calendario"
}) {
  const gironeRoundNumbers = useMemo(() => deriveGironeRoundNumbers(data), [data])

  const roundOptions = useMemo(() => {
    if (isStandingGroup(groupKey)) {
      return buildGironeRoundOptions(gironeRoundNumbers)
    }
    return buildPhaseRoundOptions(data.events[groupKey])
  }, [data.events, gironeRoundNumbers, groupKey])

  const orderedRoundKeys = useMemo(() => roundOptions.map((o) => o.value), [roundOptions])

  useEffect(() => {
    if (roundOptions.length === 0) return
    if (!roundOptions.some((o) => o.value === selectedRoundKey)) {
      onRoundChange(roundOptions[0].value)
    }
    // onRoundChange è instabile (nuova funzione a ogni render del padre): dipendiamo solo da options/chiave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundOptions, selectedRoundKey])

  const matches = useMemo(
    () => data.events[groupKey][selectedRoundKey] ?? [],
    [data.events, groupKey, selectedRoundKey],
  )
  const isRoundCompleted =
    matches.length > 0 &&
    matches.every(
      (match) => match.statusType === "finished" || match.status === "Ended" || match.status === "AET",
    )
  const restLabel = isRoundCompleted ? "ha riposato" : "deve riposare"
  const restingTeams = useMemo(() => {
    if (!isStandingGroup(groupKey)) return []
    const teamsInRound = new Set<number>()
    for (const match of matches) {
      teamsInRound.add(match.homeTeam.id)
      teamsInRound.add(match.awayTeam.id)
    }

    return data.standings[groupKey]
      .filter((row) => !teamsInRound.has(row.team.id))
      .map((row) => row.team)
  }, [data.standings, groupKey, matches])
  const roundIndex = orderedRoundKeys.indexOf(selectedRoundKey)
  const canGoPrev = roundIndex > 0
  const canGoNext = roundIndex >= 0 && roundIndex < orderedRoundKeys.length - 1

  function goPrevRound() {
    if (!canGoPrev) return
    onRoundChange(orderedRoundKeys[roundIndex - 1])
  }

  function goNextRound() {
    if (!canGoNext) return
    onRoundChange(orderedRoundKeys[roundIndex + 1])
  }

  const showStandings = view === "classifica" && isStandingGroup(groupKey)
  const isGironeCalendar = view === "calendario" && isStandingGroup(groupKey)

  return (
    <div className="w-full space-y-4 overflow-x-hidden sm:space-y-6">
      {showStandings ? (
        <Card className="rounded-xl border border-border ring-0">
          <CardHeader className="px-3 pb-2 sm:px-6">
            <CardTitle>Classifica</CardTitle>
          </CardHeader>
          <CardContent className="px-1 pb-2 sm:px-3 sm:pb-4">
            <StandingsTable
              rows={rows}
              eventsByRound={data.events[groupKey]}
              rounds={gironeRoundNumbers}
              classifications={classifications}
              onTeamClick={(teamId, teamName) => onTeamClick(teamId, teamName, groupKey)}
            />
          </CardContent>
        </Card>
      ) : null}

      {view === "calendario" ? (
        <Card className="rounded-xl border border-border ring-0">
          <CardHeader className="flex flex-col gap-3 px-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <CardTitle>Calendario e risultati</CardTitle>
            {roundOptions.length > 0 ? (
              <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={goPrevRound}
                  disabled={!canGoPrev}
                  aria-label={isGironeCalendar ? "Giornata precedente" : "Round precedente"}
                  className="shrink-0"
                >
                  <IconCircleArrowLeft className="h-4 w-4" />
                </Button>
                <RoundSelector
                  options={roundOptions}
                  value={selectedRoundKey}
                  onChange={onRoundChange}
                  placeholder={isGironeCalendar ? "Giornata" : "Round"}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={goNextRound}
                  disabled={!canGoNext}
                  aria-label={isGironeCalendar ? "Giornata successiva" : "Round successivo"}
                  className="shrink-0"
                >
                  <IconCircleArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
            {roundOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun round o giornata disponibile.</p>
            ) : matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isGironeCalendar
                  ? "Nessuna partita per questa giornata."
                  : "Nessuna partita per questo round."}
              </p>
            ) : (
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {matches.map((event) => (
                  <MatchCard
                    key={event.id}
                    event={event}
                    onTeamClick={(teamId, teamName) => onTeamClick(teamId, teamName, groupKey)}
                  />
                ))}
                {restingTeams.map((team) => (
                  <Card
                    key={`rest-${team.id}`}
                    className="h-full border border-dashed border-border ring-0 gap-2 py-0"
                  >
                    <CardContent className="flex h-full min-h-0 flex-col items-center justify-center gap-2 px-3 py-3 text-center sm:px-4 sm:py-3">
                      <TeamLogo teamId={team.id} teamName={team.name} className="h-14 w-14" />
                      <p className="text-lg font-bold leading-tight">{team.shortName ?? team.name}</p>
                      <p className="text-sm text-muted-foreground">{restLabel}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function initialRoundState(data: DashboardData): Record<EventsBucketKey, string> {
  const now = Date.now()
  return {
    gironeA: getClosestRoundKey(data, "gironeA", now),
    gironeB: getClosestRoundKey(data, "gironeB", now),
    playoffAB: getClosestRoundKey(data, "playoffAB", now),
    playoutAB: getClosestRoundKey(data, "playoutAB", now),
  }
}

export function SeasonDashboard({ data, view }: SeasonDashboardProps) {
  const [roundByBucket, setRoundByBucket] = useState(() => initialRoundState(data))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [selectedTeamName, setSelectedTeamName] = useState("")
  const [selectedGroup, setSelectedGroup] = useState<EventsBucketKey>("gironeA")
  const { dateLabel: updatedDateLabel, timeLabel: updatedTimeLabel } = formatItalianDateParts(data.updatedAt)

  const tabOrder = view === "calendario" ? CALENDAR_TAB_ORDER : CLASSIFICA_TAB_ORDER
  const defaultTab =
    view === "calendario" ? firstCalendarTabWithData(data) : (tabOrder[0] ?? "gironeA")

  useEffect(() => {
    const id = window.setInterval(() => {
      setRoundByBucket(initialRoundState(data))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [data])

  const drawerRoundOptions = useMemo(
    () =>
      isStandingGroup(selectedGroup)
        ? buildGironeRoundOptions(deriveGironeRoundNumbers(data))
        : buildPhaseRoundOptions(data.events[selectedGroup]),
    [data, selectedGroup],
  )

  const resolvedStandingsByGroup = useMemo<Record<GroupKey, StandingRow[]>>(
    () => ({
      gironeA: computeResolvedStandings(data.standings.gironeA, data.events.gironeA),
      gironeB: computeResolvedStandings(data.standings.gironeB, data.events.gironeB),
    }),
    [data.events.gironeA, data.events.gironeB, data.standings.gironeA, data.standings.gironeB],
  )

  const classificationsByGroup = useMemo<Record<GroupKey, ClassificationResult[]>>(
    () => ({
      gironeA: computeClassificationZones(
        resolvedStandingsByGroup.gironeA,
        data.events.gironeA,
        28,
      ),
      gironeB: computeClassificationZones(
        resolvedStandingsByGroup.gironeB,
        data.events.gironeB,
        28,
      ),
    }),
    [data.events.gironeA, data.events.gironeB, resolvedStandingsByGroup.gironeA, resolvedStandingsByGroup.gironeB],
  )

  function handleTeamClick(teamId: number, teamName: string, group: EventsBucketKey) {
    setSelectedTeamId(teamId)
    setSelectedTeamName(teamName)
    setSelectedGroup(group)
    setDrawerOpen(true)
  }

  function setRoundForBucket(bucket: EventsBucketKey) {
    return (roundKey: string) => setRoundByBucket((prev) => ({ ...prev, [bucket]: roundKey }))
  }

  const gridColsClass =
    tabOrder.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:w-auto"

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Serie B Interregionale {data.seasonLabel}
          </h1>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
            <span>Ultimo aggiornamento:</span>
            <span className="inline-flex items-center gap-1">
              <IconCalendar className="h-3 w-3 shrink-0" />
              {updatedDateLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <IconDial className="h-3 w-3 shrink-0" />
              {updatedTimeLabel}
            </span>
          </p>
        </div>
      </div>

      <Tabs key={view} defaultValue={defaultTab} className="w-full space-y-4">
        <TabsList className={`grid w-full ${gridColsClass}`}>
          {tabOrder.map((key) => (
            <TabsTrigger key={key} value={key}>
              {TAB_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabOrder.map((key) => (
          <TabsContent key={key} value={key} className="w-full">
            <GroupContent
              groupKey={key}
              data={data}
              rows={isStandingGroup(key) ? resolvedStandingsByGroup[key] : []}
              classifications={isStandingGroup(key) ? classificationsByGroup[key] : []}
              selectedRoundKey={roundByBucket[key]}
              onRoundChange={setRoundForBucket(key)}
              onTeamClick={handleTeamClick}
              view={view}
            />
          </TabsContent>
        ))}
      </Tabs>

      <TeamMatchesDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        teamName={selectedTeamName}
        teamId={selectedTeamId}
        roundOptions={drawerRoundOptions}
        eventsByRound={data.events[selectedGroup]}
      />
    </div>
  )
}
