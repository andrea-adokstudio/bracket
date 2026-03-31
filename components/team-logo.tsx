"use client"

import { useState } from "react"

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
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-sm border bg-muted text-xs font-semibold text-muted-foreground",
          className,
        )}
      >
        {getInitials(teamName)}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-sm border bg-white",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://api.sofascore.app/api/v1/team/${teamId}/image`}
        alt={`Logo ${teamName}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-0.5"
      />
    </div>
  )
}
