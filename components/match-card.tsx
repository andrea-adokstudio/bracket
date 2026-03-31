"use client"

import { MouseEvent, useState } from "react"
import { IconCalendar, IconDial } from "nucleo-glass"

import { TeamLogo } from "@/components/team-logo"
import { Accordion, AccordionContent, AccordionItem } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { MatchEvent } from "@/lib/types"

interface MatchCardProps {
  event: MatchEvent
  onTeamClick?: (teamId: number, teamName: string) => void
}

const STATUS_IT: Record<string, string> = {
  Ended: "Finita",
  AET: "Finita ai supplementari",
  "Not started": "Da giocare",
  "Non started": "Da giocare",
  Postponed: "Rinviata",
  Canceled: "Annullata",
  Cancelled: "Annullata",
  Suspended: "Sospesa",
  Interrupted: "Interrotta",
  AP: "Dopo supplementari",
}

function translateStatus(status: string): string {
  return STATUS_IT[status] ?? status
}

function capitalizeFirst(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function formatDateParts(timestamp: number): { dateLabel: string; timeLabel: string } {
  const date = new Date(timestamp * 1000)
  const dateLabel = capitalizeFirst(
    date.toLocaleDateString("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    }),
  )
  const timeLabel = date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return { dateLabel, timeLabel }
}

function getPeriodLabel(key: string): string {
  const periodMatch = key.match(/^period(\d+)$/)
  if (periodMatch) {
    const periodNumber = Number(periodMatch[1])
    return `${periodNumber}º quarto`
  }

  const overtimeMatch = key.match(/^overtime(\d+)?$/)
  if (overtimeMatch) {
    const overtimeNumber = overtimeMatch[1] ? Number(overtimeMatch[1]) : 1
    return overtimeNumber === 1 ? "Supplementare" : `Supplementare ${overtimeNumber}`
  }

  return key
}

function getScoreKeys(event: MatchEvent): string[] {
  const keys = new Set<string>([
    ...Object.keys(event.homeScore),
    ...Object.keys(event.awayScore),
  ])
  keys.delete("current")
  keys.delete("display")
  keys.delete("normaltime")

  return [...keys]
    .filter((key) => /^period\d+$/.test(key) || /^overtime(\d+)?$/.test(key))
    .sort((a, b) => {
      const pa = a.match(/^period(\d+)$/)
      const pb = b.match(/^period(\d+)$/)
      if (pa && pb) return Number(pa[1]) - Number(pb[1])
      if (pa) return -1
      if (pb) return 1

      const oa = a.match(/^overtime(\d+)?$/)
      const ob = b.match(/^overtime(\d+)?$/)
      if (oa && ob) return Number(oa[1] ?? "1") - Number(ob[1] ?? "1")
      if (oa) return -1
      if (ob) return 1
      return a.localeCompare(b)
    })
}

function getScoreClass(score: number | undefined, opponentScore: number | undefined): string {
  if (score == null || opponentScore == null) return "text-foreground"
  if (score > opponentScore) return "text-foreground"
  if (score < opponentScore) return "text-foreground/30"
  return "text-foreground"
}

export function MatchCard({ event, onTeamClick }: MatchCardProps) {
  const isFinished =
    event.statusType === "finished" || event.status === "Ended" || event.status === "AET"
  const scoreKeys = getScoreKeys(event)
  const { dateLabel, timeLabel } = formatDateParts(event.startTimestamp)
  const [isOpen, setIsOpen] = useState(false)

  const homeScore = event.homeScore.current
  const awayScore = event.awayScore.current
  const homeScoreClass = isFinished ? getScoreClass(homeScore, awayScore) : "text-foreground"
  const awayScoreClass = isFinished ? getScoreClass(awayScore, homeScore) : "text-foreground"

  function handleTeamNameClick(teamId: number, teamName: string, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    onTeamClick?.(teamId, teamName)
  }

  return (
    <Card
      className="cursor-pointer gap-2 py-0 pt-2"
      onClick={() => setIsOpen((prev) => !prev)}
    >
      <CardContent className="space-y-2 px-3 py-3 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-1.5">
          <Badge
            className={
              isFinished
                ? "bg-[#048C04] text-white hover:bg-[#048C04]/90"
                : "bg-[#B40404] text-white hover:bg-[#B40404]/90"
            }
          >
            {translateStatus(event.status)}
          </Badge>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <IconCalendar className="h-3 w-3 shrink-0" />
              {dateLabel}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <IconDial className="h-3 w-3 shrink-0" />
              {timeLabel}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogo teamId={event.homeTeam.id} teamName={event.homeTeam.name} className="h-6 w-6 shrink-0" />
              <button
                type="button"
                className="cursor-pointer truncate text-sm font-semibold hover:underline sm:text-base"
                onClick={(e) => handleTeamNameClick(event.homeTeam.id, event.homeTeam.name, e)}
              >
                {event.homeTeam.shortName ?? event.homeTeam.name}
              </button>
            </div>
            <span className={`text-lg font-bold tabular-nums ${homeScoreClass}`}>{homeScore}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TeamLogo teamId={event.awayTeam.id} teamName={event.awayTeam.name} className="h-6 w-6 shrink-0" />
              <button
                type="button"
                className="cursor-pointer truncate text-sm font-semibold hover:underline sm:text-base"
                onClick={(e) => handleTeamNameClick(event.awayTeam.id, event.awayTeam.name, e)}
              >
                {event.awayTeam.shortName ?? event.awayTeam.name}
              </button>
            </div>
            <span className={`text-lg font-bold tabular-nums ${awayScoreClass}`}>{awayScore}</span>
          </div>
        </div>

        {scoreKeys.length > 0 && (
          <Accordion
            type="single"
            collapsible
            value={isOpen ? "parziali" : ""}
            onValueChange={() => {}}
          >
            <AccordionItem value="parziali" className="border-b-0">
              <AccordionContent className="pb-0 pt-1" onClick={(e) => e.stopPropagation()}>
                <Separator className="mb-2" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {scoreKeys.map((key) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-bold">{getPeriodLabel(key)}</span>
                      <span className="tabular-nums">
                        {event.homeScore[key] ?? "-"} - {event.awayScore[key] ?? "-"}
                      </span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}
