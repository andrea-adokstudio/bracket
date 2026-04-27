import { BracketView } from "@/components/bracket-view"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildBracketData } from "@/lib/bracket"
import { computeResolvedStandings } from "@/lib/classification"
import type { DashboardData } from "@/lib/types"

export function SecondaFaseView({ data }: { data: DashboardData }) {
  const resolvedA = computeResolvedStandings(data.standings.gironeA, data.events.gironeA)
  const resolvedB = computeResolvedStandings(data.standings.gironeB, data.events.gironeB)
  const bracket = buildBracketData(resolvedA, resolvedB)

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Seconda fase — Serie B Interregionale {data.seasonLabel}
        </h1>
        <p className="text-sm text-muted-foreground">
          Incroci teorici aggiornati in base alla classifica corrente.
        </p>
      </div>

      <Card className="rounded-xl border border-border ring-0">
        <CardHeader className="px-3 pb-2 sm:px-6">
          <CardTitle>Playoff e Playout</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <BracketView data={bracket} />
        </CardContent>
      </Card>
    </div>
  )
}
