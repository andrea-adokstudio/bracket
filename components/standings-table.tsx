"use client"

import type { CSSProperties, ReactNode } from "react"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { TeamLogo } from "@/components/team-logo"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { applyTiebreaker } from "@/lib/classification"
import { getFinishedScoreOpacityClass } from "@/lib/score-opacity"
import { cn } from "@/lib/utils"
import type { ClassificationResult, MatchEvent, StandingRow, TeamInfo } from "@/lib/types"
import {
  IconArrowsBoldOppositeDirection,
  IconBan,
  IconCalendar,
  IconCircleArrowRight,
  IconDial,
  IconHouse,
  IconPaperPlane,
} from "nucleo-glass"

/** Separatore · tra statistiche compatte (mobile): ben visibile su sfondi gialli/arancioni. */
const STANDINGS_STAT_DOT_CLASS =
  "select-none font-semibold text-neutral-950 dark:text-neutral-100"

/** Stile unico per i titoli colonna (testo dentro il th). */
const COLUMN_HEADER_TEXT =
  "whitespace-nowrap text-xs font-semibold text-foreground sm:text-sm"

function columnHeaderLabel(label: ReactNode, align: "left" | "right" | "center"): ReactNode {
  return (
    <div
      className={cn(
        COLUMN_HEADER_TEXT,
        align === "left" && "text-left",
        align === "right" && "text-right",
        align === "center" && "text-center",
      )}
    >
      {label}
    </div>
  )
}

function teamColumnMinWidth(rows: StandingRow[]): string {
  let maxLen = 0
  for (const r of rows) {
    const s = r.team.shortName ?? r.team.name
    if (s.length > maxLen) maxLen = s.length
  }
  return `calc(${Math.max(maxLen, 4)}ch + 2.25rem)`
}

interface StandingsTableProps {
  rows: StandingRow[]
  eventsByRound: Record<string, MatchEvent[]>
  /** Giornate in ordine (per calcolo riposi e carosello Forma) */
  rounds?: number[]
  classifications?: ClassificationResult[]
  onTeamClick?: (teamId: number, teamName: string) => void
}

interface TiedTeamDialogData {
  points: number
  orderedRows: Array<{
    row: StandingRow
    directPoints: number
    directDiff: number
  }>
  directMatches: MatchEvent[]
  pendingMatches: MatchEvent[]
}

function getStandingRowClass(row: StandingRow, classification?: ClassificationResult): string {
  if (classification?.zone === "playoff-assured") return "bg-[#048C04]/30 hover:bg-[#048C04]/30"
  if (classification?.zone === "playoff-zone") return "bg-[#FBD104]/30 hover:bg-[#FBD104]/30"
  if (classification?.zone === "relegated") return "bg-[#B40404]/30 hover:bg-[#B40404]/30"
  if (classification?.zone === "playout-zone") return "bg-[#F48424]/30 hover:bg-[#F48424]/30"
  if (row.position <= 8) return "bg-[#FBD104]/30 hover:bg-[#FBD104]/30"
  if (row.position >= 11 && row.position <= 15) return "bg-[#F48424]/30 hover:bg-[#F48424]/30"
  return "hover:bg-transparent"
}

function getPositionBadgeClass(row: StandingRow, classification?: ClassificationResult): string {
  if (row.position === 15) return "bg-[#B40404] text-white"
  if (row.position <= 8) return "bg-[#FBD104] text-black"
  if (row.position >= 11 && row.position <= 14) return "bg-[#F48424] text-white"
  if (classification?.zone === "playoff-assured") return "bg-[#048C04] text-white"
  return "bg-muted text-foreground"
}

function getTieBorderClass(badgeClass: string): string {
  if (badgeClass.includes("text-black")) return "border-2 border-black/30"
  if (badgeClass.includes("text-white")) return "border-2 border-white/40"
  return "border-2 border-foreground/30"
}

function renderStandingsPositionBadge(
  row: StandingRow,
  tiedCountByPoints: Map<number, number>,
  classificationByTeamId: Map<number, ClassificationResult>,
  onPositionClick: (r: StandingRow) => void,
  /** Evita id SVG duplicati: badge anche nella colonna # (desktop) e nella cella squadra (mobile). */
  tieIconInstance: "desktop" | "mobile" = "desktop",
): ReactNode {
  const hasTie = (tiedCountByPoints.get(row.points) ?? 0) > 1
  const badgeClass = getPositionBadgeClass(row, classificationByTeamId.get(row.team.id))
  const badgeBase =
    "inline-flex items-center justify-center rounded-full font-semibold h-7 min-w-7 px-1.5 text-xs sm:h-8 sm:min-w-8 sm:px-2 sm:text-sm"
  const tieSuffix = tieIconInstance === "mobile" ? "m" : "d"
  return hasTie ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="relative inline-flex">
          <button
            type="button"
            onClick={() => onPositionClick(row)}
            className={`${badgeBase} ${badgeClass} ${getTieBorderClass(badgeClass)}`}
          >
            {row.position}
          </button>
          <IconArrowsBoldOppositeDirection
            uniqueId={`tie-pos-${row.team.id}-${tieSuffix}`}
            aria-hidden
            className="pointer-events-none absolute -right-1 -top-1 z-10 h-3.5 w-3.5 rotate-270 sm:h-4 sm:w-4 shrink-0"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="z-100 max-w-xs">
        Apri classifica avulsa
      </TooltipContent>
    </Tooltip>
  ) : (
    <span className={`${badgeBase} ${badgeClass}`}>{row.position}</span>
  )
}

function isMatchFinished(match: MatchEvent): boolean {
  return (
    match.statusType === "finished" ||
    match.status.toLowerCase() === "ended" ||
    match.status.toLowerCase() === "aet"
  )
}

function getOpponentForTeam(match: MatchEvent, teamId: number): TeamInfo {
  return match.homeTeam.id === teamId ? match.awayTeam : match.homeTeam
}

function getRoundsOrdered(
  rounds: readonly number[] | undefined,
  eventsByRound: Record<string, MatchEvent[]>,
): number[] {
  if (rounds && rounds.length > 0) {
    return [...rounds].sort((a, b) => a - b)
  }
  return [...new Set(Object.keys(eventsByRound).map((k) => Number(k)))].sort((a, b) => a - b)
}

function getTeamMatchOutcome(match: MatchEvent, teamId: number): "win" | "loss" | "draw" {
  const h = match.homeScore.current ?? 0
  const a = match.awayScore.current ?? 0
  if (h === a) return "draw"
  const isHome = match.homeTeam.id === teamId
  if (isHome) return h > a ? "win" : "loss"
  return a > h ? "win" : "loss"
}

type EnrichedSlot =
  | { kind: "rest"; round: number }
  | {
      kind: "match"
      round: number
      opponent: TeamInfo
      outcome: "win" | "loss" | "draw" | "upcoming"
      match: MatchEvent
    }

type CarouselItem =
  | { type: "divider" }
  | { type: "slot"; slot: EnrichedSlot }

type ScheduleCarouselEntry = {
  items: CarouselItem[]
  /** Indice del separatore nell'array `items`, o null se assente (stagione finita o nessuna partita giocata). */
  dividerIndex: number | null
}

/** Forma: ultime N giornate passate; le future sono tutte le rimanenti (scroll orizzontale). */
const FORMA_PAST_SLOTS = 5

function slotsToCarouselItems(slots: EnrichedSlot[]): CarouselItem[] {
  return slots.map((slot) => ({ type: "slot", slot }))
}

interface WinLossHomeAway {
  homeWins: number
  homeLosses: number
  awayWins: number
  awayLosses: number
  draws: number
}

function computeWinLossHomeAwayByTeamId(
  eventsByRound: Record<string, MatchEvent[]>,
  teamIds: readonly number[],
): Map<number, WinLossHomeAway> {
  const map = new Map<number, WinLossHomeAway>()
  for (const id of teamIds) {
    map.set(id, { homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0, draws: 0 })
  }
  for (const matches of Object.values(eventsByRound)) {
    for (const m of matches) {
      if (!isMatchFinished(m)) continue
      const hid = m.homeTeam.id
      const aid = m.awayTeam.id
      for (const teamId of [hid, aid]) {
        if (!map.has(teamId)) continue
        const o = getTeamMatchOutcome(m, teamId)
        if (o === "draw") {
          map.get(teamId)!.draws += 1
          continue
        }
        const atHome = m.homeTeam.id === teamId
        const s = map.get(teamId)!
        if (atHome) {
          if (o === "win") s.homeWins += 1
          else s.homeLosses += 1
        } else {
          if (o === "win") s.awayWins += 1
          else s.awayLosses += 1
        }
      }
    }
  }
  return map
}

function WinLossHomeAwayTooltipBody({
  stats,
  uniqueKey,
}: {
  stats: WinLossHomeAway
  uniqueKey: string
}) {
  return (
    <div className="flex flex-col gap-1.5 text-left text-xs">
      <div className="flex items-center gap-2 tabular-nums">
        <IconHouse uniqueId={`wl-house-${uniqueKey}`} aria-hidden className="h-4 w-4 shrink-0" />
        <span>
          {stats.homeWins}V / {stats.homeLosses}P
        </span>
      </div>
      <div className="flex items-center gap-2 tabular-nums">
        <IconPaperPlane
          uniqueId={`wl-away-${uniqueKey}`}
          aria-hidden
          className="h-4 w-4 shrink-0"
        />
        <span>
          {stats.awayWins}V / {stats.awayLosses}P
        </span>
      </div>
      {stats.draws > 0 ? <span className="tabular-nums">Pareggi: {stats.draws}</span> : null}
    </div>
  )
}

/**
 * Riposo “passato”: al massimo una partita della giornata può avere data/ora ancora futura
 * (recupero fuori calendario); tutte le altre hanno già startTimestamp nel passato.
 */
function isRoundAlmostAllMatchesScheduledInPast(
  round: number,
  eventsByRound: Record<string, MatchEvent[]>,
  nowMs: number,
): boolean {
  const matches = eventsByRound[String(round)] ?? []
  if (matches.length === 0) return false
  const pastCount = matches.filter((m) => m.startTimestamp * 1000 < nowMs).length
  const required = Math.max(1, matches.length - 1)
  return pastCount >= required
}

/** A sinistra della freccia: solo partite con risultato; riposo solo se la giornata è “quasi” passata. */
function slotGoesLeftOfFormaDivider(
  slot: EnrichedSlot,
  round: number,
  eventsByRound: Record<string, MatchEvent[]>,
  nowMs: number,
): boolean {
  if (slot.kind === "match") return slot.outcome !== "upcoming"
  return isRoundAlmostAllMatchesScheduledInPast(round, eventsByRound, nowMs)
}

function slotForTeamRoundEnriched(
  round: number,
  teamId: number,
  eventsByRound: Record<string, MatchEvent[]>,
): EnrichedSlot {
  const matches = eventsByRound[String(round)] ?? []
  const m = matches.find((x) => x.homeTeam.id === teamId || x.awayTeam.id === teamId)
  if (!m) return { kind: "rest", round }
  const opponent = getOpponentForTeam(m, teamId)
  if (!isMatchFinished(m)) {
    return { kind: "match", round, opponent, outcome: "upcoming", match: m }
  }
  return {
    kind: "match",
    round,
    opponent,
    outcome: getTeamMatchOutcome(m, teamId),
    match: m,
  }
}

function buildScheduleCarouselByTeamId(
  eventsByRound: Record<string, MatchEvent[]>,
  rounds: readonly number[] | undefined,
  teamIds: readonly number[],
  nowMs: number,
): Map<number, ScheduleCarouselEntry> {
  const roundsOrdered = getRoundsOrdered(rounds, eventsByRound)
  const map = new Map<number, ScheduleCarouselEntry>()

  for (const teamId of teamIds) {
    const fullSlots: EnrichedSlot[] = roundsOrdered.map((r) =>
      slotForTeamRoundEnriched(r, teamId, eventsByRound),
    )

    const leftSlots: EnrichedSlot[] = []
    const rightSlots: EnrichedSlot[] = []
    for (let i = 0; i < fullSlots.length; i++) {
      const round = roundsOrdered[i]!
      const slot = fullSlots[i]!
      if (slotGoesLeftOfFormaDivider(slot, round, eventsByRound, nowMs)) {
        leftSlots.push(slot)
      } else {
        rightSlots.push(slot)
      }
    }

    const hasUpcomingMatch = rightSlots.some((s) => s.kind === "match" && s.outcome === "upcoming")

    let items: CarouselItem[]
    let dividerIndex: number | null = null

    if (leftSlots.length === 0) {
      items = slotsToCarouselItems(rightSlots)
    } else if (rightSlots.length === 0) {
      const pastStart = Math.max(0, leftSlots.length - FORMA_PAST_SLOTS)
      items = slotsToCarouselItems(leftSlots.slice(pastStart))
    } else if (!hasUpcomingMatch) {
      const pastStart = Math.max(0, leftSlots.length - FORMA_PAST_SLOTS)
      items = slotsToCarouselItems(leftSlots.slice(pastStart))
    } else {
      const pastTake = leftSlots.slice(-FORMA_PAST_SLOTS)
      items = [...slotsToCarouselItems(pastTake), { type: "divider" }, ...slotsToCarouselItems(rightSlots)]
      dividerIndex = pastTake.length
    }

    map.set(teamId, { items, dividerIndex })
  }
  return map
}

function scheduleSlotLogoClass(slot: EnrichedSlot): string {
  if (slot.kind === "rest") return ""
  if (slot.outcome === "win") return "border border-[#048C04]/60 bg-[#048C04]/35"
  if (slot.outcome === "loss") return "border border-[#B40404]/60 bg-[#B40404]/35"
  if (slot.outcome === "draw") return "border border-[#FBD104]/50 bg-[#FBD104]/25"
  /* Stesso bordo della tabella (border-border); bg-background per allineamento tema chiaro/scuro */
  return "border border-border bg-background"
}

function formatScheduleTooltip(s: EnrichedSlot): string {
  if (s.kind === "rest") return `G${s.round} · Riposo`
  const m = s.match
  const home = m.homeTeam.shortName ?? m.homeTeam.name
  const away = m.awayTeam.shortName ?? m.awayTeam.name
  if (s.outcome === "upcoming") {
    return `${home} - ${away} · G${s.round}`
  }
  const hs = m.homeScore.current ?? 0
  const as = m.awayScore.current ?? 0
  return `${home} - ${away} · ${hs}-${as} · G${s.round}`
}

function carouselItemsContentKey(items: CarouselItem[]): string {
  return items
    .map((it) =>
      it.type === "divider"
        ? "D"
        : it.slot.kind === "rest"
          ? `R${it.slot.round}`
          : `M${it.slot.round}-${it.slot.match.id}-${it.slot.outcome}`,
    )
    .join("|")
}

const scheduleFormTooltipContentClass =
  "z-100 max-w-none whitespace-nowrap text-left"

const ScheduleSlotWithTooltip = memo(function ScheduleSlotWithTooltip({
  teamId,
  slot,
  carouselVariant = "desktop",
}: {
  teamId: number
  slot: EnrichedSlot
  /** Evita id SVG duplicati con il secondo carosello Forma (mobile) montato nello stesso documento. */
  carouselVariant?: "desktop" | "mobile"
}) {
  const label = formatScheduleTooltip(slot)
  const svgSuffix = carouselVariant === "mobile" ? "m" : "d"
  if (slot.kind === "rest") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={0}
            className="relative z-10 inline-flex h-5 w-5 cursor-default items-center justify-center rounded-sm border border-border bg-muted p-0 touch-manipulation"
            aria-label={label}
          >
            <IconBan
              uniqueId={`ban-${teamId}-r${slot.round}-${svgSuffix}`}
              aria-hidden
              className="pointer-events-none h-3 w-3 text-muted-foreground"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className={scheduleFormTooltipContentClass}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }
  const logoClass = scheduleSlotLogoClass(slot)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          className={cn(
            "relative z-10 inline-flex h-5 w-5 shrink-0 cursor-default rounded-sm bg-transparent p-0 touch-manipulation",
            logoClass,
          )}
          aria-label={label}
        >
          <TeamLogo
            teamId={slot.opponent.id}
            teamName={slot.opponent.name}
            className="pointer-events-none h-full w-full rounded-sm border-0 bg-transparent shadow-none ring-0"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className={scheduleFormTooltipContentClass}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
},
(prev, next) => {
  if (prev.teamId !== next.teamId) return false
  if (prev.carouselVariant !== next.carouselVariant) return false
  const a = prev.slot
  const b = next.slot
  if (a.round !== b.round || a.kind !== b.kind) return false
  if (a.kind === "rest" && b.kind === "rest") return true
  if (a.kind === "match" && b.kind === "match") {
    return (
      a.match.id === b.match.id &&
      a.outcome === b.outcome &&
      a.opponent.id === b.opponent.id &&
      a.match.homeScore.current === b.match.homeScore.current &&
      a.match.awayScore.current === b.match.awayScore.current
    )
  }
  return false
})

const ScheduleCarouselRow = memo(function ScheduleCarouselRow({
  teamId,
  items,
  dividerIndex,
  variant = "desktop",
}: {
  teamId: number
  items: CarouselItem[]
  dividerIndex: number | null
  /** `desktop`: solo da sm in su (colonna tabella). `mobile`: solo sotto sm (sotto stats compatte). */
  variant?: "desktop" | "mobile"
}) {
  const [emblaApi, setEmblaApi] = useState<CarouselApi | null>(null)
  const itemsContentKey = carouselItemsContentKey(items)

  useEffect(() => {
    if (!emblaApi || dividerIndex === null) return
    emblaApi.reInit()
    const id = requestAnimationFrame(() => {
      emblaApi.scrollTo(dividerIndex, true)
    })
    return () => cancelAnimationFrame(id)
  }, [emblaApi, dividerIndex, itemsContentKey])

  if (items.length === 0) return null

  return (
    <div
      className={cn(
        "w-full min-w-0",
        variant === "mobile" ? "sm:hidden" : "hidden sm:block",
      )}
    >
      <Carousel
        opts={{ align: "center", dragFree: true }}
        setApi={setEmblaApi}
        className="w-full min-w-0"
      >
        <CarouselContent className="-ml-1">
          {items.map((item, i) => (
            <CarouselItem
              key={
                item.type === "divider"
                  ? `d-${i}`
                  : item.slot.kind === "rest"
                    ? `r-${item.slot.round}`
                    : `m-${item.slot.match.id}-${item.slot.round}`
              }
              className="pointer-events-auto shrink-0 grow-0 basis-auto pl-1"
            >
              {item.type === "divider" ? (
                <span className="mx-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
                  <IconCircleArrowRight
                    uniqueId={`forma-now-${teamId}-${variant}`}
                    aria-hidden
                    className="h-3.5 w-3.5"
                  />
                </span>
              ) : (
                <ScheduleSlotWithTooltip
                  teamId={teamId}
                  slot={item.slot}
                  carouselVariant={variant}
                />
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  )
}, (prev, next) => {
  if (prev.teamId !== next.teamId) return false
  if (prev.variant !== next.variant) return false
  if (prev.dividerIndex !== next.dividerIndex) return false
  return carouselItemsContentKey(prev.items) === carouselItemsContentKey(next.items)
})

function getColumns(
  tiedCountByPoints: Map<number, number>,
  classificationByTeamId: Map<number, ClassificationResult>,
  onPositionClick: (row: StandingRow) => void,
  onTeamClick: ((teamId: number, teamName: string) => void) | undefined,
  scheduleCarouselByTeamId: Map<number, ScheduleCarouselEntry>,
  winLossHomeAwayByTeamId: Map<number, WinLossHomeAway>,
): ColumnDef<StandingRow>[] {
  return [
  {
    accessorKey: "position",
    meta: {
      className: "hidden sm:table-cell",
      headClassName: "min-w-max px-1.5 text-center sm:px-2",
      cellClassName: "w-9 px-1.5 text-center sm:w-12 sm:px-2",
    },
    header: () => columnHeaderLabel("#", "center"),
    cell: ({ row }) =>
      renderStandingsPositionBadge(
        row.original,
        tiedCountByPoints,
        classificationByTeamId,
        onPositionClick,
        "desktop",
      ),
  },
  {
    id: "team",
    meta: {
      headClassName:
        "min-w-max px-1.5 text-left sm:min-w-[var(--standings-team-min)] sm:px-2",
      cellClassName:
        "min-w-0 max-w-none whitespace-normal sm:min-w-[var(--standings-team-min)] sm:pr-0.5",
    },
    header: () => columnHeaderLabel("Squadra", "left"),
    cell: ({ row }) => {
      const label = row.original.team.shortName ?? row.original.team.name
      const fullName = row.original.team.name
      const nameButton = (
        <button
          type="button"
          onClick={() => onTeamClick?.(row.original.team.id, row.original.team.name)}
          className="w-full truncate text-left text-sm font-bold leading-tight sm:text-base sm:font-normal group-hover:font-bold"
        >
          {label}
        </button>
      )
      const logoTooltip = (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex shrink-0 cursor-default">
              <TeamLogo
                teamId={row.original.team.id}
                teamName={row.original.team.name}
                className="h-9 w-9 shrink-0 sm:h-6 sm:w-6"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="z-100 max-w-xs">
            {fullName}
          </TooltipContent>
        </Tooltip>
      )
      const mobileStatsRow = (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] tabular-nums">
          <span className="text-muted-foreground">
            G{" "}
            <span className="font-semibold text-foreground">{row.original.matches}</span>
          </span>
          <span className={STANDINGS_STAT_DOT_CLASS} aria-hidden>
            ·
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="cursor-default text-left text-muted-foreground">
                V/S{" "}
                <span className="font-semibold text-foreground">
                  {row.original.wins}/{row.original.losses}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="z-100 max-w-xs text-left">
              <WinLossHomeAwayTooltipBody
                uniqueKey={String(row.original.team.id)}
                stats={
                  winLossHomeAwayByTeamId.get(row.original.team.id) ?? {
                    homeWins: 0,
                    homeLosses: 0,
                    awayWins: 0,
                    awayLosses: 0,
                    draws: 0,
                  }
                }
              />
            </TooltipContent>
          </Tooltip>
          <span className={STANDINGS_STAT_DOT_CLASS} aria-hidden>
            ·
          </span>
          <span className="text-muted-foreground">
            Diff{" "}
            <span className="font-semibold text-foreground">{row.original.scoreDiffFormatted}</span>
          </span>
        </div>
      )
      const mobileForma = (() => {
        const formaEntry = scheduleCarouselByTeamId.get(row.original.team.id)
        if (!formaEntry?.items.length) return null
        return (
          <div className="mt-2 w-full min-w-0">
            <ScheduleCarouselRow
              variant="mobile"
              teamId={row.original.team.id}
              items={formaEntry.items}
              dividerIndex={formaEntry.dividerIndex}
            />
          </div>
        )
      })()
      const nameBlock =
        label !== fullName ? (
          <Tooltip>
            <TooltipTrigger asChild>{nameButton}</TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="z-100 max-w-xs">
              {fullName}
            </TooltipContent>
          </Tooltip>
        ) : (
          nameButton
        )
      return (
        <>
          <div className="flex w-full min-w-0 flex-col sm:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex shrink-0 items-center justify-center self-center">
                {renderStandingsPositionBadge(
                  row.original,
                  tiedCountByPoints,
                  classificationByTeamId,
                  onPositionClick,
                  "mobile",
                )}
              </div>
              <div className="flex shrink-0 items-center self-center">{logoTooltip}</div>
              <div className="flex min-w-0 flex-1 flex-col">
                {nameBlock}
                {mobileStatsRow}
              </div>
            </div>
            {mobileForma}
          </div>
          <div className="hidden min-w-0 max-w-none items-center gap-2 sm:flex sm:gap-2">
            {logoTooltip}
            <div className="min-w-0 flex-1">{nameBlock}</div>
          </div>
        </>
      )
    },
  },
  {
    accessorKey: "points",
    meta: {
      headClassName:
        "min-w-max shrink-0 text-center sm:pl-4 sm:pr-4",
      cellClassName:
        "text-center text-lg font-bold tabular-nums sm:pl-4 sm:pr-4 sm:text-base",
    },
    header: () => columnHeaderLabel("Punti", "center"),
    cell: ({ row }) => <div className="text-center">{row.original.points}</div>,
  },
  {
    accessorKey: "matches",
    meta: {
      className: "hidden sm:table-cell",
      headClassName:
        "min-w-max shrink-0 text-center sm:pl-4 sm:pr-4",
      cellClassName:
        "min-w-max text-center tabular-nums sm:pl-4 sm:pr-4 sm:text-sm",
    },
    header: () => columnHeaderLabel("Giocate", "center"),
    cell: ({ row }) => <div className="text-center">{row.original.matches}</div>,
  },
  {
    id: "winsLosses",
    meta: {
      className: "hidden sm:table-cell",
      headClassName: "min-w-max shrink-0 text-center sm:pl-4 sm:pr-4",
      cellClassName:
        "min-w-max text-center tabular-nums sm:pl-4 sm:pr-4 sm:text-sm",
    },
    header: () => columnHeaderLabel("Vinte/Perse", "center"),
    cell: ({ row }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="w-full cursor-default text-center tabular-nums">
            {row.original.wins}/{row.original.losses}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="z-100 max-w-xs text-left">
          <WinLossHomeAwayTooltipBody
            uniqueKey={String(row.original.team.id)}
            stats={
              winLossHomeAwayByTeamId.get(row.original.team.id) ?? {
                homeWins: 0,
                homeLosses: 0,
                awayWins: 0,
                awayLosses: 0,
                draws: 0,
              }
            }
          />
        </TooltipContent>
      </Tooltip>
    ),
  },
  {
    accessorKey: "scoreDiffFormatted",
    meta: {
      className: "hidden md:table-cell",
      headClassName:
        "min-w-max shrink-0 text-center sm:pl-4 sm:pr-4 md:pl-4 md:pr-4",
      cellClassName:
        "min-w-max text-center tabular-nums sm:pl-4 sm:pr-4 md:pl-4 md:pr-4 md:text-sm",
    },
    header: () => columnHeaderLabel("Differenza", "center"),
    cell: ({ row }) => <div className="text-center">{row.original.scoreDiffFormatted}</div>,
  },
  {
    id: "scheduleForm",
    meta: {
      className: "hidden sm:table-cell",
      headClassName:
        "min-w-max text-left align-middle sm:min-w-0 sm:max-w-md sm:pl-4 sm:pr-3",
      cellClassName:
        "py-2 text-left align-middle whitespace-normal sm:min-w-0 sm:max-w-md sm:overflow-x-auto sm:pl-4 sm:pr-3",
    },
    header: () => columnHeaderLabel("Forma", "left"),
    cell: ({ row }) => {
      const entry = scheduleCarouselByTeamId.get(row.original.team.id)
      if (!entry?.items.length) return null
      return (
        <ScheduleCarouselRow
          teamId={row.original.team.id}
          items={entry.items}
          dividerIndex={entry.dividerIndex}
        />
      )
    },
  },
]
}

function MatchRow({
  match,
  variant,
}: {
  match: MatchEvent
  variant: "finished" | "pending"
}) {
  const isFinished = variant === "finished"
  const homePts = match.homeScore.current ?? 0
  const awayPts = match.awayScore.current ?? 0
  const homeScoreOp = isFinished ? getFinishedScoreOpacityClass(homePts, awayPts) : "opacity-100"
  const awayScoreOp = isFinished ? getFinishedScoreOpacityClass(awayPts, homePts) : "opacity-100"
  return (
    <li className="relative rounded-md bg-muted/40 px-2 py-2 sm:px-3">
      <Badge
        variant={isFinished ? "secondary" : "outline"}
        className="absolute top-1/2 left-2 z-10 -translate-y-1/2 sm:left-3"
      >
        G{match.round}
      </Badge>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 pl-0 sm:gap-2 sm:pl-12">
        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <span className="hidden truncate text-right sm:inline">
            {match.homeTeam.shortName ?? match.homeTeam.name}
          </span>
          <TeamLogo
            teamId={match.homeTeam.id}
            teamName={match.homeTeam.name}
            className="h-7 w-7 shrink-0 sm:h-5 sm:w-5"
          />
        </div>
        <div className="w-14 text-center sm:w-20">
          {isFinished ? (
            <span className="font-semibold tabular-nums">
              <span className={homeScoreOp}>{homePts}</span>-<span className={awayScoreOp}>{awayPts}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">vs</span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <TeamLogo
            teamId={match.awayTeam.id}
            teamName={match.awayTeam.name}
            className="h-7 w-7 shrink-0 sm:h-5 sm:w-5"
          />
          <span className="hidden truncate sm:inline">
            {match.awayTeam.shortName ?? match.awayTeam.name}
          </span>
        </div>
      </div>
    </li>
  )
}

export function StandingsTable({
  rows,
  eventsByRound,
  rounds,
  classifications,
  onTeamClick,
}: StandingsTableProps) {
  const [dialogData, setDialogData] = useState<TiedTeamDialogData | null>(null)
  const [formaNowMs, setFormaNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setFormaNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const classificationByTeamId = useMemo(() => {
    const map = new Map<number, ClassificationResult>()
    for (const item of classifications ?? []) {
      map.set(item.teamId, item)
    }
    return map
  }, [classifications])

  const tiedCountByPoints = useMemo(() => {
    const map = new Map<number, number>()
    for (const row of rows) {
      map.set(row.points, (map.get(row.points) ?? 0) + 1)
    }
    return map
  }, [rows])

  /** Evita di ricostruire la mappa se cambia solo il riferimento a `rows` (stessi team). */
  const teamIdsKey = useMemo(() => rows.map((r) => r.team.id).join(","), [rows])

  const scheduleCarouselByTeamId = useMemo(() => {
    const teamIds = teamIdsKey ? teamIdsKey.split(",").map(Number) : []
    return buildScheduleCarouselByTeamId(eventsByRound, rounds, teamIds, formaNowMs)
  }, [eventsByRound, rounds, teamIdsKey, formaNowMs])

  const winLossHomeAwayByTeamId = useMemo(() => {
    const teamIds = teamIdsKey ? teamIdsKey.split(",").map(Number) : []
    return computeWinLossHomeAwayByTeamId(eventsByRound, teamIds)
  }, [eventsByRound, teamIdsKey])

  const standingsTeamMinWidth = useMemo(() => teamColumnMinWidth(rows), [rows])

  const finishedMatches = useMemo(
    () => Object.values(eventsByRound).flat().filter(isMatchFinished),
    [eventsByRound],
  )
  const allMatches = useMemo(() => Object.values(eventsByRound).flat(), [eventsByRound])

  const openTiedDialog = useCallback(
    (clicked: StandingRow) => {
      const tiedRows = rows.filter((row) => row.points === clicked.points)
      if (tiedRows.length <= 1) return

      const tiedTeamIds = tiedRows.map((row) => row.team.id)
      const orderedIds = applyTiebreaker(tiedTeamIds, rows, finishedMatches, new Map(), [])
      const tiedIdSet = new Set(tiedTeamIds)

      const directMatches = finishedMatches.filter(
        (match) => tiedIdSet.has(match.homeTeam.id) && tiedIdSet.has(match.awayTeam.id),
      )
      const pendingMatches = allMatches.filter(
        (match) =>
          tiedIdSet.has(match.homeTeam.id) &&
          tiedIdSet.has(match.awayTeam.id) &&
          !isMatchFinished(match),
      )

      const statsByTeamId = new Map<number, { directPoints: number; directDiff: number }>()
      for (const row of tiedRows) {
        statsByTeamId.set(row.team.id, { directPoints: 0, directDiff: 0 })
      }

      for (const match of directMatches) {
        const home = statsByTeamId.get(match.homeTeam.id)
        const away = statsByTeamId.get(match.awayTeam.id)
        if (!home || !away) continue

        const homeScore = match.homeScore.current ?? 0
        const awayScore = match.awayScore.current ?? 0

        home.directDiff += homeScore - awayScore
        away.directDiff += awayScore - homeScore

        if (homeScore > awayScore) home.directPoints += 2
        else if (awayScore > homeScore) away.directPoints += 2
        else {
          home.directPoints += 1
          away.directPoints += 1
        }
      }

      const rowByTeamId = new Map(tiedRows.map((row) => [row.team.id, row] as const))
      const orderedRows = orderedIds
        .map((teamId) => {
          const row = rowByTeamId.get(teamId)
          const stats = statsByTeamId.get(teamId)
          if (!row || !stats) return null
          return { row, directPoints: stats.directPoints, directDiff: stats.directDiff }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)

      setDialogData({
        points: clicked.points,
        orderedRows,
        directMatches,
        pendingMatches,
      })
    },
    [rows, finishedMatches, allMatches],
  )

  const columns = useMemo(
    () =>
      getColumns(
        tiedCountByPoints,
        classificationByTeamId,
        openTiedDialog,
        onTeamClick,
        scheduleCarouselByTeamId,
        winLossHomeAwayByTeamId,
      ),
    [
      tiedCountByPoints,
      classificationByTeamId,
      openTiedDialog,
      onTeamClick,
      scheduleCarouselByTeamId,
      winLossHomeAwayByTeamId,
    ],
  )

  // TanStack Table is the recommended engine for shadcn Data Table.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.team.id),
  })

  return (
    <div
      className="w-full overflow-hidden rounded-md border border-border"
      style={
        {
          ["--standings-team-min" as string]: standingsTeamMinWidth,
        } as CSSProperties
      }
    >
      <Table className="w-full table-auto">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={`px-2 py-2 sm:px-3 ${header.id === "team" ? "min-w-0 w-[78%] max-w-none sm:w-[48%]" : ""} ${((header.column.columnDef.meta as { className?: string; headClassName?: string } | undefined)?.className ?? "")} ${((header.column.columnDef.meta as { className?: string; headClassName?: string } | undefined)?.headClassName ?? "")}`}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={`group ${getStandingRowClass(
                row.original,
                classificationByTeamId.get(row.original.team.id),
              )}`}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={`px-2 py-2 text-xs sm:px-3 sm:py-3 sm:text-sm ${(cell.column.columnDef.meta as { className?: string; cellClassName?: string } | undefined)?.className ?? ""} ${(cell.column.columnDef.meta as { className?: string; cellClassName?: string } | undefined)?.cellClassName ?? ""}`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 text-[11px] text-muted-foreground sm:px-3 sm:text-xs">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#048C04]" /> Playoff assicurato
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FBD104]" /> Zona playoff
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F48424]" /> Zona playout
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#B40404]" /> Retrocessione diretta
        </span>
      </div>
      <Dialog open={dialogData !== null} onOpenChange={(open) => !open && setDialogData(null)}>
        <DialogContent
          showCloseButton={false}
          className="w-[96vw] sm:w-[min(90vw,1240px)] sm:min-w-[75vw] max-w-none max-h-[90vh] overflow-y-auto p-3 sm:p-4"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-sm sm:text-base">Classifica avulsa</DialogTitle>
              <Badge variant="outline">{dialogData?.points ?? 0} punti</Badge>
            </div>
          </DialogHeader>

          {dialogData ? (
            <div className="space-y-3 sm:space-y-5">
              <div className="overflow-x-auto overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 text-center sm:w-10">#</TableHead>
                      <TableHead>Squadra</TableHead>
                      <TableHead className="w-12 text-right text-xs sm:w-auto sm:text-sm">
                        <span className="sm:hidden">Pt</span>
                        <span className="hidden sm:inline">Punti diretti</span>
                      </TableHead>
                      <TableHead className="w-12 text-right text-xs sm:w-auto sm:text-sm">
                        <span className="sm:hidden">Diff</span>
                        <span className="hidden sm:inline">Diff diretta</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dialogData.orderedRows.map((item, index) => (
                      <TableRow key={item.row.team.id}>
                        <TableCell className="text-center font-medium">{index + 1}</TableCell>
                        <TableCell className="px-1 sm:px-2">
                          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                            <TeamLogo
                              teamId={item.row.team.id}
                              teamName={item.row.team.name}
                              className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                            />
                            <span className="truncate text-xs sm:text-sm">
                              {item.row.team.shortName ?? item.row.team.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">{item.directPoints}</TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">
                          {item.directDiff > 0 ? `+${item.directDiff}` : item.directDiff}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 rounded-lg border border-border p-2 sm:p-3">
                <p className="flex items-center justify-center gap-2 text-xs font-medium sm:text-sm">
                  <IconDial className="h-4 w-4 shrink-0" />
                  Risultati scontri diretti
                </p>
                {dialogData.directMatches.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground sm:text-sm">
                    Nessuna partita diretta gia conclusa tra queste squadre.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                    {dialogData.directMatches.map((match) => (
                      <MatchRow key={match.id} match={match} variant="finished" />
                    ))}
                  </ul>
                )}
              </div>

              {dialogData.pendingMatches.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-border p-2 sm:p-3">
                  <p className="flex items-center justify-center gap-2 text-xs font-medium sm:text-sm">
                    <IconCalendar className="h-4 w-4 shrink-0" />
                    Partite mancanti tra queste squadre
                  </p>
                  <ul className="space-y-1.5 text-xs sm:space-y-2 sm:text-sm">
                    {dialogData.pendingMatches.map((match) => (
                      <MatchRow key={match.id} match={match} variant="pending" />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
