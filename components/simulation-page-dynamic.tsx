"use client"

import dynamic from "next/dynamic"

import type { DashboardData } from "@/lib/types"

const SimulationPageInner = dynamic(
  () => import("@/components/simulation-page").then((mod) => ({ default: mod.SimulationPage })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-svh w-full flex-1 flex-col items-center justify-center px-4 py-8 text-center text-sm text-muted-foreground">
        Caricamento simulazione…
      </div>
    ),
  },
)

export function SimulationPageDynamic({ data }: { data: DashboardData }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SimulationPageInner data={data} />
    </div>
  )
}
