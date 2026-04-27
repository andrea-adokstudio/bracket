"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface RoundOption {
  value: string
  label: string
}

interface RoundSelectorProps {
  options: RoundOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function RoundSelector({ options, value, onChange, placeholder }: RoundSelectorProps) {
  const validValue = options.some((o) => o.value === value) ? value : undefined
  return (
    <Select value={validValue} onValueChange={onChange}>
      <SelectTrigger className="w-full min-w-0 sm:max-w-[min(100%,20rem)]">
        <SelectValue placeholder={placeholder ?? "Seleziona"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
