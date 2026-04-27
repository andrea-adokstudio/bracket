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
import type { RoundOption } from "@/components/round-selector"
import { formatItalianDateParts } from "@/lib/format-italian-date"
import { getFinishedScoreOpacityClass } from "@/lib/score-opacity"
import type { MatchEvent } from "@/lib/types"

type TeamRoundSlide =
  | { kind: "match"; roundKey: string; match: MatchEvent }
  | { kind: "rest"; roundKey: string; roundMatches: MatchEvent[] }

interface TeamMatchesDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName: string
  teamId: number | null
  roundOptions: RoundOption[]
  eventsByRound: Record<string, MatchEvent[]>
}

export function TeamMatchesDrawer({
  open,
  onOpenChange,
  teamName,
  teamId,
  roundOptions,
  eventsByRound,
}: TeamMatchesDrawerProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const availableRoundKeys = useMemo(
    () => roundOptions.map((o) => o.value),
    [roundOptions],
  );

  const slides = useMemo(() => {
    if (teamId == null) return [];
    return availableRoundKeys.map((roundKey) => {
      const roundMatches = eventsByRound[roundKey] ?? [];
      const match = roundMatches.find(
        (m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId,
      );
      if (match) return { kind: "match" as const, roundKey, match };
      return { kind: "rest" as const, roundKey, roundMatches };
    });
  }, [availableRoundKeys, eventsByRound, teamId]);

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
    const targetIndex = Math.max(slides.length - 1, 0);
    api.scrollTo(targetIndex, true);
  }, [api, open, slides]);

  const selectedRoundKey = slides[selectedIndex]?.roundKey;

  function goToRound(roundKey: string) {
    const targetIndex = slides.findIndex((slide) => slide.roundKey === roundKey);
    if (targetIndex >= 0) {
      api?.scrollTo(targetIndex);
    }
  }

  const currentRoundIndex = availableRoundKeys.findIndex((key) => key === selectedRoundKey);
  const canGoPrevRound = currentRoundIndex > 0;
  const canGoNextRound =
    currentRoundIndex >= 0 && currentRoundIndex < availableRoundKeys.length - 1;

  function goPrevRound() {
    if (!canGoPrevRound) return;
    goToRound(availableRoundKeys[currentRoundIndex - 1]);
  }

  function goNextRound() {
    if (!canGoNextRound) return;
    goToRound(availableRoundKeys[currentRoundIndex + 1]);
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
          {slides.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna partita trovata.</p>
          ) : (
            <Carousel setApi={setApi} opts={{ align: "start" }} className="w-full">
              <CarouselContent className="items-stretch">
                {slides.map((slide) => {
                  if (slide.kind === "rest") {
                    const roundMatches = slide.roundMatches;
                    const isRoundCompleted =
                      roundMatches.length > 0 &&
                      roundMatches.every(
                        (match) =>
                          match.statusType === "finished" ||
                          match.status === "Ended" ||
                          match.status === "AET",
                      );
                    const restLabel = isRoundCompleted ? "ha riposato" : "deve riposare";
                    const anchorMatch = [...roundMatches].sort(
                      (a, b) => a.startTimestamp - b.startTimestamp,
                    )[0];
                    const { dateLabel, timeLabel } = anchorMatch
                      ? formatItalianDateParts(anchorMatch.startTimestamp * 1000)
                      : { dateLabel: "—", timeLabel: "—" };
                    return (
                      <CarouselItem
                        key={`rest-${slide.roundKey}`}
                        className="flex min-h-0 basis-full md:basis-1/2"
                      >
                        <div className="flex h-full min-h-0 w-full flex-col items-center justify-center rounded-lg border border-dashed px-3 py-3 sm:px-4">
                          <span className="sr-only">
                            Riposo.
                            {anchorMatch
                              ? ` ${dateLabel}, ${timeLabel}.`
                              : " Nessuna partita in calendario per questa giornata."}{" "}
                            {teamName}. {restLabel}
                          </span>
                          <div className="flex flex-col items-center gap-2 text-center">
                            {teamId ? (
                              <TeamLogo
                                teamId={teamId}
                                teamName={teamName}
                                className="h-6 w-6 shrink-0"
                              />
                            ) : null}
                            <p className="text-lg font-bold leading-tight">{teamName}</p>
                            <p className="text-sm text-muted-foreground">{restLabel}</p>
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  }

                  const match = slide.match;
                  const { dateLabel, timeLabel } = formatItalianDateParts(
                    match.startTimestamp * 1000,
                  );
                  const homeTeam = match.homeTeam; // Squadra di casa
                  const awayTeam = match.awayTeam; // Squadra in trasferta
                  const homeScore = match.homeScore.current;
                  const awayScore = match.awayScore.current;

                  const finished = isFinishedStatus(match.status, match.statusType);
                  const homeScoreClass = finished
                    ? getFinishedScoreOpacityClass(homeScore, awayScore)
                    : "opacity-100";
                  const awayScoreClass = finished
                    ? getFinishedScoreOpacityClass(awayScore, homeScore)
                    : "opacity-100";

                  return (
                    <CarouselItem
                      key={match.id}
                      className="flex min-h-0 basis-full md:basis-1/2"
                    >
                      <div className="h-full w-full rounded-lg border px-3 py-3 sm:px-4">
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
          {slides.length > 0 ? (
            <div className="mt-4">
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={goPrevRound}
                  disabled={!canGoPrevRound}
                  aria-label="Partita precedente"
                >
                  <IconCircleArrowLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={
                    selectedRoundKey &&
                    roundOptions.some((o) => o.value === selectedRoundKey)
                      ? selectedRoundKey
                      : undefined
                  }
                  onValueChange={(value) => goToRound(value)}
                >
                  <SelectTrigger className="w-full min-w-0 sm:max-w-[min(100%,20rem)]">
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {roundOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={goNextRound}
                  disabled={!canGoNextRound}
                  aria-label="Partita successiva"
                >
                  <IconCircleArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}