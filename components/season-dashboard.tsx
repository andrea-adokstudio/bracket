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
import { formatItalianDateParts } from "@/lib/format-italian-date"
import type { ClassificationResult, DashboardData, GroupKey, MatchEvent, StandingRow } from "@/lib/types"

interface SeasonDashboardProps {
  data: DashboardData
}

function getClosestRound(data: DashboardData, groupKey: GroupKey, nowMs: number): number {
  const entries = Object.entries(data.events[groupKey])
  if (entries.length === 0) return data.rounds.at(-1) ?? 1

  let bestRound = Number(entries[0][0])
  let bestDistance = Number.POSITIVE_INFINITY

  for (const [roundKey, events] of entries) {
    if (events.length === 0) continue
    const avgTimestampMs =
      events.reduce((acc, event) => acc + event.startTimestamp * 1000, 0) / events.length
    const distance = Math.abs(avgTimestampMs - nowMs)
    if (distance < bestDistance) {
      bestDistance = distance
      bestRound = Number(roundKey)
    }
  }

  return bestRound
}

function GroupContent({
  groupKey,
  data,
  rows,
  classifications,
  selectedRound,
  onRoundChange,
  onTeamClick,
}: {
  groupKey: GroupKey
  data: DashboardData
  rows: StandingRow[]
  classifications: ClassificationResult[]
  selectedRound: number
  onRoundChange: (round: number) => void
  onTeamClick: (teamId: number, teamName: string, group: GroupKey) => void
}) {
  const matches = useMemo(
    () => data.events[groupKey][String(selectedRound)] ?? [],
    [data.events, groupKey, selectedRound],
  )
  const isRoundCompleted =
    matches.length > 0 &&
    matches.every(
      (match) => match.statusType === "finished" || match.status === "Ended" || match.status === "AET",
    )
  const restLabel = isRoundCompleted ? "ha riposato" : "deve riposare"
  const restingTeams = useMemo(() => {
    const teamsInRound = new Set<number>()
    for (const match of matches) {
      teamsInRound.add(match.homeTeam.id)
      teamsInRound.add(match.awayTeam.id)
    }

    return data.standings[groupKey]
      .filter((row) => !teamsInRound.has(row.team.id))
      .map((row) => row.team)
  }, [data.standings, groupKey, matches])
  const roundIndex = data.rounds.findIndex((round) => round === selectedRound)
  const canGoPrev = roundIndex > 0
  const canGoNext = roundIndex >= 0 && roundIndex < data.rounds.length - 1

  function goPrevRound() {
    if (!canGoPrev) return
    onRoundChange(data.rounds[roundIndex - 1])
  }

  function goNextRound() {
    if (!canGoNext) return
    onRoundChange(data.rounds[roundIndex + 1])
  }

  return (
    <div className="w-full space-y-4 overflow-x-hidden sm:space-y-6">
      <Card className="rounded-xl border border-border ring-0">
        <CardHeader className="px-3 pb-2 sm:px-6">
          <CardTitle>Classifica</CardTitle>
        </CardHeader>
        <CardContent className="px-1 pb-2 sm:px-3 sm:pb-4">
          <StandingsTable
            rows={rows}
            eventsByRound={data.events[groupKey]}
            classifications={classifications}
            onTeamClick={(teamId, teamName) => onTeamClick(teamId, teamName, groupKey)}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border ring-0">
        <CardHeader className="flex flex-col gap-3 px-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <CardTitle>Calendario e risultati</CardTitle>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={goPrevRound}
              disabled={!canGoPrev}
              aria-label="Giornata precedente"
              className="shrink-0"
            >
              <IconCircleArrowLeft className="h-4 w-4" />
            </Button>
            <RoundSelector rounds={data.rounds} value={selectedRound} onChange={onRoundChange} />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={goNextRound}
              disabled={!canGoNext}
              aria-label="Giornata successiva"
              className="shrink-0"
            >
              <IconCircleArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna partita per questa giornata.</p>
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
                <Card key={`rest-${team.id}`} className="h-full border-dashed gap-2 py-0">
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
    </div>
  )
}

export function SeasonDashboard({ data }: SeasonDashboardProps) {
  const [roundA, setRoundA] = useState(() => getClosestRound(data, "gironeA", Date.now()))
  const [roundB, setRoundB] = useState(() => getClosestRound(data, "gironeB", Date.now()))
  const [dashboardData, setDashboardData] = useState(data)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [selectedTeamName, setSelectedTeamName] = useState("")
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>("gironeA")
  const { dateLabel: updatedDateLabel, timeLabel: updatedTimeLabel } = formatItalianDateParts(
    dashboardData.updatedAt,
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now()
      setRoundA(getClosestRound(dashboardData, "gironeA", now))
      setRoundB(getClosestRound(dashboardData, "gironeB", now))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [dashboardData])

  useEffect(() => {
    function onDashboardUpdate(event: Event) {
      const customEvent = event as CustomEvent<DashboardData>
      if (!customEvent.detail) return
      setDashboardData(customEvent.detail)
      const now = Date.now()
      setRoundA(getClosestRound(customEvent.detail, "gironeA", now))
      setRoundB(getClosestRound(customEvent.detail, "gironeB", now))
    }
    window.addEventListener("dashboard-data-updated", onDashboardUpdate)
    return () => window.removeEventListener("dashboard-data-updated", onDashboardUpdate)
  }, [])

  const selectedTeamMatches = useMemo<MatchEvent[]>(() => {
    if (!selectedTeamId) return []
    const matchesByRound = dashboardData.events[selectedGroup]
    const allMatches = Object.values(matchesByRound).flat()
    return allMatches.filter(
      (match) => match.homeTeam.id === selectedTeamId || match.awayTeam.id === selectedTeamId,
    )
  }, [dashboardData.events, selectedGroup, selectedTeamId])

  const resolvedStandingsByGroup = useMemo<Record<GroupKey, StandingRow[]>>(
    () => ({
      gironeA: computeResolvedStandings(dashboardData.standings.gironeA, dashboardData.events.gironeA),
      gironeB: computeResolvedStandings(dashboardData.standings.gironeB, dashboardData.events.gironeB),
    }),
    [
      dashboardData.events.gironeA,
      dashboardData.events.gironeB,
      dashboardData.standings.gironeA,
      dashboardData.standings.gironeB,
    ],
  )

  const classificationsByGroup = useMemo<Record<GroupKey, ClassificationResult[]>>(
    () => ({
      gironeA: computeClassificationZones(
        resolvedStandingsByGroup.gironeA,
        dashboardData.events.gironeA,
        28,
      ),
      gironeB: computeClassificationZones(
        resolvedStandingsByGroup.gironeB,
        dashboardData.events.gironeB,
        28,
      ),
    }),
    [
      dashboardData.events.gironeA,
      dashboardData.events.gironeB,
      resolvedStandingsByGroup.gironeA,
      resolvedStandingsByGroup.gironeB,
    ],
  )

  function handleTeamClick(teamId: number, teamName: string, group: GroupKey) {
    setSelectedTeamId(teamId)
    setSelectedTeamName(teamName)
    setSelectedGroup(group)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Serie B Interregionale {dashboardData.seasonLabel}
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

      <Tabs defaultValue="gironeA" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="gironeA">Girone A</TabsTrigger>
          <TabsTrigger value="gironeB">Girone B</TabsTrigger>
        </TabsList>

        <TabsContent value="gironeA" className="w-full">
          <GroupContent
            groupKey="gironeA"
            data={dashboardData}
            rows={resolvedStandingsByGroup.gironeA}
            classifications={classificationsByGroup.gironeA}
            selectedRound={roundA}
            onRoundChange={setRoundA}
            onTeamClick={handleTeamClick}
          />
        </TabsContent>
        <TabsContent value="gironeB" className="w-full">
          <GroupContent
            groupKey="gironeB"
            data={dashboardData}
            rows={resolvedStandingsByGroup.gironeB}
            classifications={classificationsByGroup.gironeB}
            selectedRound={roundB}
            onRoundChange={setRoundB}
            onTeamClick={handleTeamClick}
          />
        </TabsContent>
      </Tabs>

      <TeamMatchesDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        teamName={selectedTeamName}
        teamId={selectedTeamId}
        matches={selectedTeamMatches}
      />
    </div>
  )
}
