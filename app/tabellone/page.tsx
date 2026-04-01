import { BracketView } from "@/components/bracket-view"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildBracketData } from "@/lib/bracket"
import { computeResolvedStandings } from "@/lib/classification"
import { getDashboardData } from "@/lib/data"

export default async function TabellonePage() {
  let data = null

  try {
    data = await getDashboardData()
  } catch {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-5xl items-center justify-center px-6 py-12">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Dati non disponibili</h1>
          <p className="text-sm text-muted-foreground">
            Esegui <code>npm run fetch-data</code> per scaricare classifica, calendario e risultati.
          </p>
        </div>
      </div>
    )
  }

  const resolvedA = computeResolvedStandings(data.standings.gironeA, data.events.gironeA)
  const resolvedB = computeResolvedStandings(data.standings.gironeB, data.events.gironeB)
  const bracket = buildBracketData(resolvedA, resolvedB)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl px-2 py-4 sm:px-4 sm:py-6">
      <div className="w-full space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Tabellone Serie B Interregionale {data.seasonLabel}
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
    </div>
  )
}
