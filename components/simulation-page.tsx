"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DashboardData, GroupKey, MatchEvent, StandingRow } from "@/lib/types"
import { IconCalendar, IconDial } from "nucleo-glass"

import { BracketView } from "@/components/bracket-view"
import { StandingsTable } from "@/components/standings-table"
import { TeamLogo } from "@/components/team-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildBracketData } from "@/lib/bracket"
import { computeClassificationZones, computeResolvedStandings } from "@/lib/classification"
import { formatItalianDateParts } from "@/lib/format-italian-date"
import { getFinishedScoreOpacityClass } from "@/lib/score-opacity"
import { getAllPendingIds, isMatchOriginallyFinished } from "@/lib/simulation-helpers"
import { cn } from "@/lib/utils"

const SIMULATION_STORAGE_KEY = "simulation-scores"

function formatScoreDiff(scoresFor: number, scoresAgainst: number): string {
  const d = scoresFor - scoresAgainst
  if (d > 0) return `+${d}`
  if (d < 0) return `${d}`
  return "0"
}

function mergeSimulatedEvents(
  grouped: Record<string, MatchEvent[]>,
  committed: Record<number, { home: number; away: number }>,
): Record<string, MatchEvent[]> {
  const out: Record<string, MatchEvent[]> = {}
  for (const [round, matches] of Object.entries(grouped)) {
    out[round] = matches.map((m) => {
      const s = committed[m.id]
      if (!s || isMatchOriginallyFinished(m)) return m
      if (s.home === s.away) return m
      if (!Number.isInteger(s.home) || !Number.isInteger(s.away) || s.home <= 0 || s.away <= 0) return m
      return {
        ...m,
        homeScore: { ...m.homeScore, current: s.home },
        awayScore: { ...m.awayScore, current: s.away },
        status: "Ended",
        statusType: "finished",
      }
    })
  }
  return out
}

function applySimulationToStandings(
  baseRows: StandingRow[],
  originalEventsByRound: Record<string, MatchEvent[]>,
  committed: Record<number, { home: number; away: number }>,
): StandingRow[] {
  const rows = baseRows.map((r) => ({
    ...r,
    team: { ...r.team },
  }))
  const byId = new Map(rows.map((r) => [r.team.id, r]))

  const allMatches = Object.values(originalEventsByRound).flat()
  for (const match of allMatches) {
    const s = committed[match.id]
    if (!s || isMatchOriginallyFinished(match)) continue
    if (s.home === s.away) continue
    if (!Number.isInteger(s.home) || !Number.isInteger(s.away) || s.home <= 0 || s.away <= 0) continue

    const home = byId.get(match.homeTeam.id)
    const away = byId.get(match.awayTeam.id)
    if (!home || !away) continue

    home.matches += 1
    away.matches += 1
    home.scoresFor += s.home
    home.scoresAgainst += s.away
    away.scoresFor += s.away
    away.scoresAgainst += s.home
    if (s.home > s.away) {
      home.wins += 1
      home.points += 2
      away.losses += 1
    } else {
      away.wins += 1
      away.points += 2
      home.losses += 1
    }
    home.scoreDiffFormatted = formatScoreDiff(home.scoresFor, home.scoresAgainst)
    away.scoreDiffFormatted = formatScoreDiff(away.scoresFor, away.scoresAgainst)
  }

  return rows
}

function loadCommittedFromStorage(): Record<number, { home: number; away: number }> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(SIMULATION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { home: number; away: number }>
    const out: Record<number, { home: number; away: number }> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k)
      if (
        !Number.isFinite(id) ||
        typeof v?.home !== "number" ||
        typeof v?.away !== "number" ||
        !Number.isInteger(v.home) ||
        !Number.isInteger(v.away) ||
        v.home <= 0 ||
        v.away <= 0 ||
        v.home === v.away
      ) {
        continue
      }
      out[id] = { home: v.home, away: v.away }
    }
    return out
  } catch {
    return {}
  }
}

function buildDraftsFromPendingAndCommitted(
  pendingIds: number[],
  committed: Record<number, { home: number; away: number }>,
): Record<number, { home: string; away: string }> {
  const out: Record<number, { home: string; away: string }> = {}
  for (const id of pendingIds) {
    const c = committed[id]
    out[id] = c ? { home: String(c.home), away: String(c.away) } : { home: "", away: "" }
  }
  return out
}

function extractCommittedFromDrafts(
  drafts: Record<number, { home: string; away: string }>,
): Record<number, { home: number; away: number }> {
  const out: Record<number, { home: number; away: number }> = {}
  for (const [idStr, d] of Object.entries(drafts)) {
    const id = Number(idStr)
    if (!Number.isFinite(id)) continue
    const h = Number.parseInt(d.home.trim(), 10)
    const a = Number.parseInt(d.away.trim(), 10)
    if (!Number.isFinite(h) || !Number.isFinite(a) || !Number.isInteger(h) || !Number.isInteger(a))
      continue
    if (h <= 0 || a <= 0) continue
    if (h === a) continue
    out[id] = { home: h, away: a }
  }
  return out
}

function committedSnapshot(m: Record<number, { home: number; away: number }>): string {
  const keys = Object.keys(m)
    .map((k) => Number(k))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)
  if (keys.length === 0) return ""
  return keys.map((id) => `${id}:${m[id].home},${m[id].away}`).join("|")
}

const scoreInputClass =
  "min-h-10 min-w-[3.25rem] max-w-[4.5rem] shrink-0 rounded-md border border-border bg-background px-2 py-1 text-center text-lg font-bold tabular-nums outline-none ring-offset-background placeholder:font-bold placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"

interface SimulationPageProps {
  data: DashboardData
}

export function SimulationPage({ data }: SimulationPageProps) {
  const [drafts, setDrafts] = useState<Record<number, { home: string; away: string }>>(() =>
    buildDraftsFromPendingAndCommitted(getAllPendingIds(data), loadCommittedFromStorage()),
  )

  /** Stesso riferimento se i punteggi “committati” non cambiano: evita ricalcoli enormi a ogni tasto. */
  const stableCommittedRef = useRef<{ snap: string; data: Record<number, { home: number; away: number }> }>(
    { snap: "", data: {} },
  )
  const committed = useMemo(() => {
    const fresh = extractCommittedFromDrafts(drafts)
    const snap = committedSnapshot(fresh)
    if (snap === stableCommittedRef.current.snap) {
      return stableCommittedRef.current.data
    }
    stableCommittedRef.current = { snap, data: fresh }
    return fresh
  }, [drafts])

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (Object.keys(committed).length === 0) {
          window.localStorage.removeItem(SIMULATION_STORAGE_KEY)
        } else {
          window.localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(committed))
        }
      } catch {
        // ignore quota / private mode
      }
    }, 300)
    return () => window.clearTimeout(t)
  }, [committed])

  const mergedGironeA = useMemo(
    () => mergeSimulatedEvents(data.events.gironeA, committed),
    [data.events.gironeA, committed],
  )
  const mergedGironeB = useMemo(
    () => mergeSimulatedEvents(data.events.gironeB, committed),
    [data.events.gironeB, committed],
  )

  const adjustedStandingsA = useMemo(
    () => applySimulationToStandings(data.standings.gironeA, data.events.gironeA, committed),
    [data.standings.gironeA, data.events.gironeA, committed],
  )
  const adjustedStandingsB = useMemo(
    () => applySimulationToStandings(data.standings.gironeB, data.events.gironeB, committed),
    [data.standings.gironeB, data.events.gironeB, committed],
  )

  const resolvedA = useMemo(
    () => computeResolvedStandings(adjustedStandingsA, mergedGironeA),
    [adjustedStandingsA, mergedGironeA],
  )
  const resolvedB = useMemo(
    () => computeResolvedStandings(adjustedStandingsB, mergedGironeB),
    [adjustedStandingsB, mergedGironeB],
  )

  const classificationsA = useMemo(
    () => computeClassificationZones(resolvedA, mergedGironeA, 28),
    [resolvedA, mergedGironeA],
  )
  const classificationsB = useMemo(
    () => computeClassificationZones(resolvedB, mergedGironeB, 28),
    [resolvedB, mergedGironeB],
  )

  const bracket = useMemo(() => buildBracketData(resolvedA, resolvedB), [resolvedA, resolvedB])

  const simulatedCount = Object.keys(committed).length

  const { dateLabel: updatedDateLabel, timeLabel: updatedTimeLabel } = formatItalianDateParts(
    data.updatedAt,
  )

  const updateDraft = useCallback((id: number, field: "home" | "away", value: string) => {
    const cleaned = value.replace(/\D/g, "")
    setDrafts((prev) => {
      const current = prev[id] ?? { home: "", away: "" }
      const nextRow = { ...current, [field]: cleaned }
      const h = Number.parseInt(nextRow.home.trim(), 10)
      const a = Number.parseInt(nextRow.away.trim(), 10)
      const homeNonEmpty = nextRow.home.trim() !== ""
      const awayNonEmpty = nextRow.away.trim() !== ""
      if (homeNonEmpty && awayNonEmpty) {
        if (
          Number.isFinite(h) &&
          Number.isFinite(a) &&
          Number.isInteger(h) &&
          Number.isInteger(a) &&
          h >= 0 &&
          a >= 0 &&
          h === a
        ) {
          return prev
        }
      }
      return { ...prev, [id]: nextRow }
    })
  }, [])

  const handleClear = useCallback(() => {
    stableCommittedRef.current = { snap: "", data: {} }
    setDrafts(buildDraftsFromPendingAndCommitted(getAllPendingIds(data), {}))
    try {
      window.localStorage.removeItem(SIMULATION_STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [data])

  function renderMatchInputs(groupKey: GroupKey) {
    const eventsByRound = data.events[groupKey]
    const sections = data.rounds.map((round) => {
      const matches = (eventsByRound[String(round)] ?? []).filter((m) => !isMatchOriginallyFinished(m))
      if (matches.length === 0) return null
      return (
            <div key={round} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Giornata {round}</h3>
              <div className="space-y-3">
                {matches.map((m) => {
                  const draft = drafts[m.id] ?? { home: "", away: "" }
                  const isDone = Boolean(committed[m.id])
                  const h = Number.parseInt(draft.home.trim(), 10)
                  const a = Number.parseInt(draft.away.trim(), 10)
                  const bothScoredPositive =
                    draft.home.trim() !== "" &&
                    draft.away.trim() !== "" &&
                    Number.isFinite(h) &&
                    Number.isFinite(a) &&
                    Number.isInteger(h) &&
                    Number.isInteger(a) &&
                    h > 0 &&
                    a > 0 &&
                    h !== a
                  const homeScoreClass = bothScoredPositive
                    ? getFinishedScoreOpacityClass(h, a)
                    : "opacity-100"
                  const awayScoreClass = bothScoredPositive
                    ? getFinishedScoreOpacityClass(a, h)
                    : "opacity-100"
                  const { dateLabel, timeLabel } = formatItalianDateParts(m.startTimestamp * 1000)
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                        isDone ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <IconCalendar className="h-3 w-3 shrink-0" />
                            {dateLabel}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <IconDial className="h-3 w-3 shrink-0" />
                            {timeLabel}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <TeamLogo
                                teamId={m.homeTeam.id}
                                teamName={m.homeTeam.name}
                                className="h-7 w-7 shrink-0"
                              />
                              <span className="truncate text-sm font-semibold">
                                {m.homeTeam.shortName ?? m.homeTeam.name}
                              </span>
                            </div>
                            <input
                              id={`sim-match-${m.id}-home`}
                              name={`sim_match_${m.id}_home`}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="00"
                              aria-label={`Punteggio casa ${m.homeTeam.shortName ?? m.homeTeam.name}`}
                              className={cn(scoreInputClass, homeScoreClass)}
                              value={draft.home}
                              onChange={(e) => updateDraft(m.id, "home", e.target.value)}
                            />
                          </div>
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <TeamLogo
                                teamId={m.awayTeam.id}
                                teamName={m.awayTeam.name}
                                className="h-7 w-7 shrink-0"
                              />
                              <span className="truncate text-sm font-semibold">
                                {m.awayTeam.shortName ?? m.awayTeam.name}
                              </span>
                            </div>
                            <input
                              id={`sim-match-${m.id}-away`}
                              name={`sim_match_${m.id}_away`}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="00"
                              aria-label={`Punteggio trasferta ${m.awayTeam.shortName ?? m.awayTeam.name}`}
                              className={cn(scoreInputClass, awayScoreClass)}
                              value={draft.away}
                              onChange={(e) => updateDraft(m.id, "away", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
    })
    if (!sections.some(Boolean)) {
      return <p className="text-sm text-muted-foreground">Nessuna partita da simulare in questo girone.</p>
    }
    return <div className="space-y-6">{sections}</div>
  }

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Simulazione · Serie B Interregionale {data.seasonLabel}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inserisci i risultati delle partite da giocare: classifica e tabellone si aggiornano in base alla
            simulazione. Dati reali aggiornati al{" "}
            <span className="inline-flex items-center gap-1">
              <IconCalendar className="h-3 w-3 shrink-0" />
              {updatedDateLabel}
            </span>{" "}
            <span className="inline-flex items-center gap-1">
              <IconDial className="h-3 w-3 shrink-0" />
              {updatedTimeLabel}
            </span>
            .
          </p>
          <p className="mt-1 text-sm font-medium">
            Partite simulate: {simulatedCount}
            {simulatedCount > 0 ? " (salvate su questo dispositivo)" : null}
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          disabled={simulatedCount === 0}
          onClick={handleClear}
          className="shrink-0 border-transparent bg-[#B40404] text-white hover:bg-[#B40404]/90 hover:text-white focus-visible:border-[#B40404] focus-visible:ring-[#B40404]/40"
        >
          Svuota
        </Button>
      </div>

      <Tabs defaultValue="gironeA" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="gironeA">Girone A</TabsTrigger>
          <TabsTrigger value="gironeB">Girone B</TabsTrigger>
        </TabsList>

        <TabsContent value="gironeA" className="w-full space-y-4">
          <Card className="rounded-xl border border-border ring-0">
            <CardHeader className="px-3 pb-2 sm:px-6">
              <CardTitle>Partite da simulare</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              {renderMatchInputs("gironeA")}
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-border ring-0">
            <CardHeader className="px-3 pb-2 sm:px-6">
              <CardTitle>Classifica simulata</CardTitle>
            </CardHeader>
            <CardContent className="px-1 pb-2 sm:px-3 sm:pb-4">
              <StandingsTable
                rows={resolvedA}
                eventsByRound={mergedGironeA}
                rounds={data.rounds}
                classifications={classificationsA}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gironeB" className="w-full space-y-4">
          <Card className="rounded-xl border border-border ring-0">
            <CardHeader className="px-3 pb-2 sm:px-6">
              <CardTitle>Partite da simulare</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
              {renderMatchInputs("gironeB")}
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-border ring-0">
            <CardHeader className="px-3 pb-2 sm:px-6">
              <CardTitle>Classifica simulata</CardTitle>
            </CardHeader>
            <CardContent className="px-1 pb-2 sm:px-3 sm:pb-4">
              <StandingsTable
                rows={resolvedB}
                eventsByRound={mergedGironeB}
                rounds={data.rounds}
                classifications={classificationsB}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="rounded-xl border border-border ring-0">
        <CardHeader className="px-3 pb-2 sm:px-6">
          <CardTitle>Playoff e Playout</CardTitle>
          <CardDescription>
            Tabellone simulato: incroci aggiornati in base alla classifica simulata. Stesse regole descritte per il
            tabellone ufficiale.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <BracketView data={bracket} />
        </CardContent>
      </Card>
    </div>
  )
}
