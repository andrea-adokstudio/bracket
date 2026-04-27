import { DataMissingFallback } from "@/components/data-missing-fallback"
import { SimulationPageDynamic } from "@/components/simulation-page-dynamic"
import { getDashboardData } from "@/lib/data"
import { getSimulationPageResetKey } from "@/lib/simulation-helpers"

export default async function SimulazionePage() {
  let data = null

  try {
    data = await getDashboardData()
  } catch {
    return <DataMissingFallback />
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-2 py-4 sm:px-4 sm:py-6">
      <div className="flex min-h-0 flex-1 flex-col">
        <SimulationPageDynamic key={getSimulationPageResetKey(data)} data={data} />
      </div>
    </div>
  )
}
