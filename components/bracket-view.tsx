import { TeamLogo } from "@/components/team-logo"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { BracketData, BracketMatch, BracketRound, TeamInfo } from "@/lib/types"
import { cn } from "@/lib/utils"

interface BracketViewProps {
  data: BracketData
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

function MatchCard({ match, playoff = true }: { match: BracketMatch; playoff?: boolean }) {
  return (
    <Card
      className={cn(
        "h-full",
        playoff ? "border-green-500/30" : "border-amber-500/40",
      )}
    >
      <CardHeader className="px-3 pb-2">
        <CardTitle className="text-sm">{match.label}</CardTitle>
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
      <h3 className="text-sm font-semibold text-muted-foreground">{round.name}</h3>
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
      <div className="grid gap-3 lg:grid-cols-3">
        <RoundSection round={ottavi} />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{quarti.name}</h3>
          <div className="space-y-2 lg:pt-16 lg:space-y-16">
            {quarti.matches.map((match) => (
              <MatchCard key={match.label} match={match} />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{semifinale.name}</h3>
          <div className="space-y-2 lg:pt-40">
            {semifinale.matches.map((match) => (
              <MatchCard key={match.label} match={match} />
            ))}
          </div>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Finale Conference</h2>
        <div className="max-w-xl">
          {data.finaleConference.map((round) => (
            <RoundSection key={`F-${round.name}`} round={round} />
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Playout - Tabellone C</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {data.tabelloneC.map((match) => (
            <MatchCard key={match.label} match={match} playoff={false} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Playout - Tabellone D</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {data.tabelloneD.map((match) => (
            <MatchCard key={match.label} match={match} playoff={false} />
          ))}
        </div>
      </section>
    </div>
  )
}
