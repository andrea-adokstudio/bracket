import { SeasonDashboard } from "@/components/season-dashboard"
import { getDashboardData } from "@/lib/data"
import type { DashboardData } from "@/lib/types"

export default async function Page() {
  let data: DashboardData | null = null

  try {
    data = await getDashboardData()
  } catch {
    data = {
      seasonLabel: "25/26",
      updatedAt: new Date(0).toISOString(),
      rounds: [],
      standings: { gironeA: [], gironeB: [] },
      events: { gironeA: {}, gironeB: {} },
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl px-2 py-4 sm:px-4 sm:py-6">
      <SeasonDashboard key={data.updatedAt} data={data} />
    </div>
  )
}
