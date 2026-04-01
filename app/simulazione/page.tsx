import { SimulationPageDynamic } from "@/components/simulation-page-dynamic"
import { getDashboardData } from "@/lib/data"
import { getSimulationPageResetKey } from "@/lib/simulation-helpers"

export default async function SimulazionePage() {
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

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-2 py-4 sm:px-4 sm:py-6">
      <div className="flex min-h-0 flex-1 flex-col">
        <SimulationPageDynamic key={getSimulationPageResetKey(data)} data={data} />
      </div>
    </div>
  )
}
