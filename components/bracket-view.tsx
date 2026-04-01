import { IconBadgeSparkle, IconStar } from "nucleo-glass"
import type { CSSProperties } from "react"

import { TeamLogo } from "@/components/team-logo"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { BracketData, BracketMatch, BracketRound, TeamInfo } from "@/lib/types"
import { cn } from "@/lib/utils"

interface BracketViewProps {
  data: BracketData
}

/** nucleo-glass usa gradienti SVG con id fissi: senza uniqueId diversi, più icone stesso tipo collidono e spariscono. */
function nucleoIconIdSlug(label: string): string {
  return label.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "") || "icon"
}

const nucleoGlassAmber: CSSProperties = {
  ["--nc-gradient-1-color-1" as string]: "#fbbf24",
  ["--nc-gradient-1-color-2" as string]: "#b45309",
  ["--nc-gradient-2-color-1" as string]: "rgba(254, 243, 199, 0.72)",
  ["--nc-gradient-2-color-2" as string]: "rgba(180, 83, 9, 0.48)",
  ["--nc-light" as string]: "#fffbeb",
}

const nucleoGlassEmerald: CSSProperties = {
  ["--nc-gradient-1-color-1" as string]: "#6ee7b7",
  ["--nc-gradient-1-color-2" as string]: "#047857",
  ["--nc-gradient-2-color-1" as string]: "rgba(209, 250, 229, 0.65)",
  ["--nc-gradient-2-color-2" as string]: "rgba(4, 120, 87, 0.45)",
  ["--nc-light" as string]: "#ecfdf5",
}

function TeamLine({
  team,
  fallback,
  seed,
  group,
}: {
  team: TeamInfo | null
  fallback?: string
  seed?: number
  group?: "A" | "B"
}) {
  const label = team ? team.shortName ?? team.name : fallback ?? "Da definire"

  return (
    <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border p-2">
      <div className="flex min-w-0 items-center gap-2">
        {team ? (
          <TeamLogo teamId={team.id} teamName={team.name} className="h-6 w-6" />
        ) : (
          <div className="h-6 w-6 shrink-0 rounded-full border bg-muted" />
        )}
        <span className="truncate text-sm">{label}</span>
      </div>
      {typeof seed === "number" && group ? (
        <Badge variant="outline" className="shrink-0">
          {seed}{group}
        </Badge>
      ) : null}
    </div>
  )
}

function MatchCard({
  match,
  playoff = true,
  className,
}: {
  match: BracketMatch
  playoff?: boolean
  className?: string
}) {
  const idSlug = nucleoIconIdSlug(match.label)

  return (
    <Card
      className={cn(
        className ?? "h-full",
        playoff ? "border-green-500/30" : "border-amber-500/40",
      )}
    >
      <CardHeader className={cn("px-3 pb-2", match.badgeSparkle && "text-center")}>
        <CardTitle
          className={cn(
            "flex items-center gap-1.5 text-sm",
            match.badgeSparkle && "justify-center",
          )}
        >
          {match.badgeSparkle ? (
            <span className="inline-flex shrink-0 [&_svg]:block" style={nucleoGlassEmerald}>
              <IconBadgeSparkle
                uniqueId={`nc-bdg-${idSlug}-`}
                width={20}
                height={20}
                aria-hidden
              />
            </span>
          ) : null}
          {match.star ? (
            <span className="inline-flex shrink-0 [&_svg]:block" style={nucleoGlassAmber}>
              <IconStar uniqueId={`nc-str-${idSlug}-`} width={20} height={20} aria-hidden />
            </span>
          ) : null}
          <span>{match.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        <TeamLine
          team={match.homeTeam}
          fallback={match.homePlaceholder}
          seed={match.homePosition}
          group={match.homeGroup}
        />
        <TeamLine
          team={match.awayTeam}
          fallback={match.awayPlaceholder}
          seed={match.awayPosition}
          group={match.awayGroup}
        />
      </CardContent>
    </Card>
  )
}

function RoundSection({ round }: { round: BracketRound }) {
  return (
    <div className="space-y-2">
      {round.name ? (
        <h3 className="text-sm font-semibold text-muted-foreground">{round.name}</h3>
      ) : null}
      <div className="space-y-2">
        {round.matches.map((match) => (
          <MatchCard key={match.label} match={match} />
        ))}
      </div>
    </div>
  )
}

function PlayoffTree({
  title,
  rounds,
}: {
  title: string
  rounds: BracketRound[]
}) {
  const ottavi = rounds[0]
  const quarti = rounds[1]
  const semifinale = rounds[2]

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {/* Mobile: colonne impilate */}
      <div className="flex flex-col gap-3 lg:hidden">
        <RoundSection round={ottavi} />
        <RoundSection round={quarti} />
        <RoundSection round={semifinale} />
      </div>
      {/* Desktop: griglia con row-span — Gara 5 centrata tra G1 e G2, G6 tra G3 e G4, G7 tra tutte */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{ottavi.name}</h3>
        <h3 className="text-sm font-semibold text-muted-foreground">{quarti.name}</h3>
        <h3 className="text-sm font-semibold text-muted-foreground">{semifinale.name}</h3>

        <div className="lg:col-start-1 lg:row-start-2">
          <MatchCard match={ottavi.matches[0]} />
        </div>
        <div className="flex h-full w-full items-center justify-center lg:col-start-2 lg:row-span-2 lg:row-start-2">
          <MatchCard className="h-1/2 w-full" match={quarti.matches[0]} />
        </div>
        <div className="flex h-full w-full items-center justify-center lg:col-start-3 lg:row-span-4 lg:row-start-2">
          <MatchCard className="h-1/4 w-full" match={semifinale.matches[0]} />
        </div>

        <div className="lg:col-start-1 lg:row-start-3">
          <MatchCard match={ottavi.matches[1]} />
        </div>

        <div className="lg:col-start-1 lg:row-start-4">
          <MatchCard match={ottavi.matches[2]} />
        </div>
        <div className="flex h-full w-full items-center justify-center lg:col-start-2 lg:row-span-2 lg:row-start-4">
          <MatchCard className="h-1/2 w-full" match={quarti.matches[1]} />
        </div>

        <div className="lg:col-start-1 lg:row-start-5">
          <MatchCard match={ottavi.matches[3]} />
        </div>
      </div>
    </section>
  )
}

export function BracketView({ data }: BracketViewProps) {
  return (
    <div className="space-y-6">
      <PlayoffTree title="Playoff - Tabellone A" rounds={data.tabelloneA} />
      <PlayoffTree title="Playoff - Tabellone B" rounds={data.tabelloneB} />

      <section className="mx-auto flex w-full max-w-xl flex-col items-center space-y-4 text-center text-pretty">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Le due squadre vincitrici di Gara 7 e Gara 14 devono giocare la finale di Conference al meglio delle tre
          gare, in programma tra il 7 e il 14 giugno.
        </p>
        <div className="w-full max-w-xl space-y-2">
          {data.finaleConference.flatMap((round) =>
            round.matches.map((match) => <MatchCard key={match.label} match={match} />),
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Chi vince la serie è promosso in Serie B nazionale 2026/27. La squadra sconfitta nella finale incontra le
          altre due perdenti delle finali dei gironi C, D, E e F dal 19 al 21 giugno, in campo neutro, in uno spareggio
          da cui uscirà il nome della quarta promossa.
        </p>
      </section>

      <Separator />

      <div className="space-y-6">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center space-y-3 text-center text-pretty">
          <h2 className="text-lg font-semibold">Playout</h2>
          <div className="mx-auto max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Alla fine della regular season la 9ª e la 10ª classificata in ogni girone si salvano e terminano
              anticipatamente la stagione. Le squadre classificate dall’11º al 14º posto affrontano l’unico turno
              playout previsto, al meglio delle tre partite (3, 10 e 17 maggio), incrociando le squadre dell’altro
              girone della stessa conference (girone A e girone B).
            </p>
            <p>
              Dai sei tabelloni che si vanno a creare con gli incroci 11ª contro 14ª e 12ª contro 13ª, le perdenti
              retrocedono in Serie C, per un totale di 12 retrocessioni, quattro per ogni conference. Le squadre
              classificate al 15º posto vengono retrocesse direttamente, senza disputare il playout.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Playout — incroci dal Girone A</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.tabelloneC.map((match) => (
              <MatchCard key={match.label} match={match} playoff={false} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Playout — incroci dal Girone B</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.tabelloneD.map((match) => (
              <MatchCard key={match.label} match={match} playoff={false} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
