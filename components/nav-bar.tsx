"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const links = [
  { href: "/", label: "Classifica" },
  { href: "/calendario", label: "Calendario" },
  { href: "/tabellone", label: "Tabellone" },
  { href: "/simulazione", label: "Simulazione" },
]

export function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-2 py-2 sm:px-4">
        {links.map((link) => {
          const active = pathname === link.href
          return (
            <Button
              key={link.href}
              asChild
              variant={active ? "default" : "outline"}
              size="sm"
              className={cn("text-xs sm:text-sm")}
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
