const TIMEZONE = "Europe/Rome"

function capitalizeFirst(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

/** Date/time labels stable between SSR (Node) and browser — avoids hydration mismatches. */
export function formatItalianDateParts(input: Date | number | string): {
  dateLabel: string
  timeLabel: string
} {
  const date = input instanceof Date ? input : new Date(input)
  const dateLabel = capitalizeFirst(
    date.toLocaleDateString("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      timeZone: TIMEZONE,
    }),
  )
  const timeLabel = date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  })
  return { dateLabel, timeLabel }
}
