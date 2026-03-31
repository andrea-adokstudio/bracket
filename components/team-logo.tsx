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
  const src = `/api/team/${teamId}/image`

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
        className="h-full w-full object-contain p-0.5"
      />
      <span className="sr-only">{getInitials(teamName)}</span>
    </div>
  )
}
