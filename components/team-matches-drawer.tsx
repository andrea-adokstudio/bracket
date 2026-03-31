"use client"

import { useEffect, useMemo, useState } from "react"
import {
  IconCalendar,
  IconCircleArrowLeft,
  IconCircleArrowRight,
  IconDial,
} from "nucleo-glass"

import { TeamLogo } from "@/components/team-logo"
import { Badge } from "@/components/ui/badge"
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatItalianDateParts } from "@/lib/format-italian-date"
import type { MatchEvent } from "@/lib/types"

interface TeamMatchesDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName: string
  teamId: number | null
  matches: MatchEvent[]
}

function getClosestMatchIndex(matches: MatchEvent[]): number {
  if (matches.length === 0) return 0;
  const now = Date.now();
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  matches.forEach((match, index) => {
    const distance = Math.abs(match.startTimestamp * 1000 - now);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function TeamMatchesDrawer({
  open,
  onOpenChange,
  teamName,
  teamId,
  matches,
}: TeamMatchesDrawerProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => a.startTimestamp - b.startTimestamp),
    [matches],
  );

  useEffect(() => {
    if (!api) return;

    const updateSelected = () => {
      setSelectedIndex(api.selectedScrollSnap());
    };

    updateSelected();
    api.on("select", updateSelected);
    api.on("reInit", updateSelected);

    return () => {
      api.off("select", updateSelected);
      api.off("reInit", updateSelected);
    };
  }, [api]);

  useEffect(() => {
    if (!open || !api) return;
    const targetIndex = getClosestMatchIndex(sortedMatches);
    api.scrollTo(targetIndex, true);
  }, [api, open, sortedMatches]);

  const availableRounds = useMemo(
    () => [...new Set(sortedMatches.map((match) => match.round))].sort((a, b) => a - b),
    [sortedMatches],
  );

  const selectedRound = sortedMatches[selectedIndex]?.round;

  function goToRound(round: number) {
    const targetIndex = sortedMatches.findIndex((match) => match.round === round);
    if (targetIndex >= 0) {
      api?.scrollTo(targetIndex);
    }
  }

  const currentRoundIndex = availableRounds.findIndex((round) => round === selectedRound);
  const canGoPrevRound = currentRoundIndex > 0;
  const canGoNextRound =
    currentRoundIndex >= 0 && currentRoundIndex < availableRounds.length - 1;

  function goPrevRound() {
    if (!canGoPrevRound) return;
    goToRound(availableRounds[currentRoundIndex - 1]);
  }

  function goNextRound() {
    if (!canGoNextRound) return;
    goToRound(availableRounds[currentRoundIndex + 1]);
  }

  function translateStatus(status: string): string {
    const map: Record<string, string> = {
      Ended: "Finita",
      AET: "Finita ai supplementari",
      "Not started": "Da giocare",
      "Non started": "Da giocare",
    };

    return map[status] ?? status;
  }

  function isFinishedStatus(status: string, type: string): boolean {
    return type === "finished" || status === "Ended" || status === "AET";
  }

  function getScoreClass(
    score: number | undefined,
    opponentScore: number | undefined,
    finished: boolean,
  ): string {
    if (!finished || score == null || opponentScore == null) return "text-foreground";
    if (score > opponentScore) return "text-foreground";
    if (score < opponentScore) return "text-foreground/30";
    return "text-foreground";
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-full max-w-3xl">
        <DrawerTitle className="sr-only">Partite squadra {teamName}</DrawerTitle>
        <DrawerHeader className="mb-3 pb-2">
          <div className="flex items-center justify-center gap-2 text-center">
            {teamId ? (
              <TeamLogo teamId={teamId} teamName={teamName} className="h-10 w-10" />
            ) : null}
            <h2 className="text-lg font-semibold">{teamName}</h2>
          </div>
        </DrawerHeader>
        <div className="px-4 pb-6">
          {sortedMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna partita trovata.</p>
          ) : (
            <Carousel setApi={setApi} opts={{ align: "start" }} className="w-full">
              <CarouselContent>
                {sortedMatches.map((match) => {
                  const { dateLabel, timeLabel } = formatItalianDateParts(
                    match.startTimestamp * 1000,
                  );
                  const homeTeam = match.homeTeam; // Squadra di casa
                  const awayTeam = match.awayTeam; // Squadra in trasferta
                  const homeScore = match.homeScore.current;
                  const awayScore = match.awayScore.current;

                  const finished = isFinishedStatus(match.status, match.statusType);
                  const homeScoreClass = getScoreClass(homeScore, awayScore, finished);
                  const awayScoreClass = getScoreClass(awayScore, homeScore, finished);

                  return (
                    <CarouselItem key={match.id} className="basis-full md:basis-1/2">
                      <div className="rounded-lg border px-3 py-3 sm:px-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                          <Badge
                            className={
                              finished
                                ? "bg-[#048C04] text-white hover:bg-[#048C04]/90"
                                : "bg-[#B40404] text-white hover:bg-[#B40404]/90"
                            }
                          >
                            {translateStatus(match.status)}
                          </Badge>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <IconCalendar className="h-3 w-3 shrink-0" />
                              {dateLabel}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <IconDial className="h-3 w-3 shrink-0" />
                              {timeLabel}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <TeamLogo
                                teamId={homeTeam.id}
                                teamName={homeTeam.name}
                                className="h-6 w-6 shrink-0"
                              />
                              <span className="truncate text-sm font-semibold sm:text-base">
                                {homeTeam.name}
                              </span>
                            </div>
                            <span
                              className={`text-lg font-bold tabular-nums ${homeScoreClass}`}
                            >
                              {homeScore}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <TeamLogo
                                teamId={awayTeam.id}
                                teamName={awayTeam.name}
                                className="h-6 w-6 shrink-0"
                              />
                              <span className="truncate text-sm font-semibold sm:text-base">
                                {awayTeam.shortName ?? awayTeam.name}
                              </span>
                            </div>
                            <span
                              className={`text-lg font-bold tabular-nums ${awayScoreClass}`}
                            >
                              {awayScore}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}