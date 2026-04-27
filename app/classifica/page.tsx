import { DataMissingFallback } from "@/components/data-missing-fallback"
import { SeasonDashboard } from "@/components/season-dashboard"
import { getDashboardData } from "@/lib/data"

export default async function ClassificaPage() {
  let data = null

  try {
    data = await getDashboardData()
  } catch {
    return <DataMissingFallback />
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl px-2 py-4 sm:px-4 sm:py-6">
      <SeasonDashboard key={data.updatedAt} data={data} view="classifica" />
    </div>
  )
}
