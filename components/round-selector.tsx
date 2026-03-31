"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RoundSelectorProps {
  rounds: number[]
  value: number
  onChange: (value: number) => void
}

export function RoundSelector({ rounds, value, onChange }: RoundSelectorProps) {
  return (
    <Select value={String(value)} onValueChange={(nextValue) => onChange(Number(nextValue))}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue placeholder="Seleziona giornata" />
      </SelectTrigger>
      <SelectContent>
        {rounds.map((round) => (
          <SelectItem key={round} value={String(round)}>
            Giornata {round}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
