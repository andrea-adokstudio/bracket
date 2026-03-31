"use client"

import { useMemo, useState } from "react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { applyTiebreaker } from "@/lib/classification"
import type { ClassificationResult, MatchEvent, StandingRow } from "@/lib/types"
import { IconCalendar, IconDial } from "nucleo-glass"

interface StandingsTableProps {
  rows: StandingRow[]
  eventsByRound: Record<string, MatchEvent[]>
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

function getColumns(
  tiedCountByPoints: Map<number, number>,
  classificationByTeamId: Map<number, ClassificationResult>,
  onPositionClick: (row: StandingRow) => void,
  onTeamClick?: (teamId: number, teamName: string) => void,
): ColumnDef<StandingRow>[] {
  return [
  {
    accessorKey: "position",
    meta: { headClassName: "w-8 px-1 text-center", cellClassName: "w-8 px-1 text-center" },
    header: "#",
    cell: ({ row }) => {
      const hasTie = (tiedCountByPoints.get(row.original.points) ?? 0) > 1
      const badgeClass = getPositionBadgeClass(
        row.original,
        classificationByTeamId.get(row.original.team.id),
      )
      return hasTie ? (
        <button
          type="button"
          onClick={() => onPositionClick(row.original)}
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold underline underline-offset-2 ${badgeClass}`}
          title="Apri classifica avulsa"
        >
          {row.original.position}
        </button>
      ) : (
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${badgeClass}`}
        >
          {row.original.position}
        </span>
      )
    },
  },
  {
    id: "team",
    header: "Squadra",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <TeamLogo
          teamId={row.original.team.id}
          teamName={row.original.team.name}
          className="h-6 w-6 shrink-0"
        />
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onTeamClick?.(row.original.team.id, row.original.team.name)}
            className="w-full truncate text-left text-sm leading-tight hover:underline group-hover:font-bold sm:text-base"
          >
            {row.original.team.shortName ?? row.original.team.name}
          </button>
          <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">
            G: {row.original.matches} · V/S: {row.original.wins}/{row.original.losses} · Diff:{" "}
            {row.original.scoreDiffFormatted}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "points",
    meta: {
      headClassName: "w-16 text-right text-sm font-semibold sm:text-base",
      cellClassName: "text-right text-sm font-bold sm:text-base",
    },
    header: () => <div className="text-right">Punti</div>,
    cell: ({ row }) => <div className="text-right">{row.original.points}</div>,
  },
  {
    accessorKey: "matches",
    meta: { className: "hidden sm:table-cell" },
    header: () => <div className="text-right">Giocate</div>,
    cell: ({ row }) => <div className="text-right">{row.original.matches}</div>,
  },
  {
    id: "winsLosses",
    meta: { className: "hidden sm:table-cell" },
    header: () => <div className="text-right">Vinte/Perse</div>,
    cell: ({ row }) => (
      <div className="text-right">
        {row.original.wins}/{row.original.losses}
      </div>
    ),
  },
  {
    accessorKey: "scoreDiffFormatted",
    meta: { className: "hidden md:table-cell" },
    header: () => <div className="text-right">Differenza</div>,
    cell: ({ row }) => <div className="text-right">{row.original.scoreDiffFormatted}</div>,
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
  return (
    <li className="rounded-md bg-muted/40 px-2 py-2 sm:px-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-2">
        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <Badge variant={isFinished ? "secondary" : "outline"} className="shrink-0">
            G{match.round}
          </Badge>
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
            <span className="font-semibold">
              {match.homeScore.current ?? 0}-{match.awayScore.current ?? 0}
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
  classifications,
  onTeamClick,
}: StandingsTableProps) {
  const [dialogData, setDialogData] = useState<TiedTeamDialogData | null>(null)

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

  const finishedMatches = useMemo(
    () =>
      Object.values(eventsByRound)
        .flat()
        .filter(
          (match) =>
            match.statusType === "finished" ||
            match.status.toLowerCase() === "ended" ||
            match.status.toLowerCase() === "aet",
        ),
    [eventsByRound],
  )
  const allMatches = useMemo(() => Object.values(eventsByRound).flat(), [eventsByRound])

  function openTiedDialog(clicked: StandingRow) {
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
        !(
          match.statusType === "finished" ||
          match.status.toLowerCase() === "ended" ||
          match.status.toLowerCase() === "aet"
        ),
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
  }

  // TanStack Table is the recommended engine for shadcn Data Table.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: getColumns(tiedCountByPoints, classificationByTeamId, openTiedDialog, onTeamClick),
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <Table className="w-full table-fixed">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={`px-2 py-2 text-xs sm:px-3 sm:text-sm ${header.id === "team" ? "w-[46%] sm:w-[40%]" : ""} ${((header.column.columnDef.meta as { className?: string; headClassName?: string } | undefined)?.className ?? "")} ${((header.column.columnDef.meta as { className?: string; headClassName?: string } | undefined)?.headClassName ?? "")}`}
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
