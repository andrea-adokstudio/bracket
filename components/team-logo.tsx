"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

interface TeamLogoProps {
  teamId: number
  teamName: string
  className?: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

export function TeamLogo({ teamId, teamName, className }: TeamLogoProps) {
  const logoSources = useMemo(
    () => [
      `/api/team/${teamId}/image`,
      `https://api.sofascore.app/api/v1/team/${teamId}/image`,
      `https://www.sofascore.com/api/v1/team/${teamId}/image`,
    ],
    [teamId],
  )
  const [sourceIndex, setSourceIndex] = useState(0)
  const src = logoSources[sourceIndex] ?? logoSources[0]

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-sm border bg-white",
        className,
      )}
    >
      {/* Use plain image to avoid forcing circular logos */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Logo ${teamName}`}
        loading="lazy"
        onError={() => {
          setSourceIndex((prev) => (prev < logoSources.length - 1 ? prev + 1 : prev))
        }}
        className="h-full w-full object-contain p-0.5"
      />
      <span className="sr-only">{getInitials(teamName)}</span>
    </div>
  )
}
