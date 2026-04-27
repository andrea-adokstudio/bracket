"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const links = [
  { href: "/", label: "Seconda fase" },
  { href: "/calendario", label: "Calendario" },
  { href: "/classifica", label: "Classifica" },
]

export function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-2 py-2 sm:px-4">
        <Link
          href="/"
          className={cn(
            "mr-auto text-sm font-semibold tracking-tight sm:text-base",
            pathname === "/" || pathname === "/seconda-fase"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Bracket RB
        </Link>
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href === "/" && pathname === "/seconda-fase")
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
