"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const links = [
  { href: "/", label: "Classifica e calendario" },
  { href: "/bracket", label: "Bracket" },
]

export function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isRefreshing, startTransition] = useTransition()
  async function handleRefresh() {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/aggiorna", { method: "POST" })
          const payload = (await response.json()) as { ok: boolean; message: string }
          if (payload.ok) router.refresh()
        } catch {
          // silently ignore
        }
      })()
    })
  }

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
        <Button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          size="sm"
          className="ml-auto bg-[#1d397e] text-white hover:bg-[#17306a]"
        >
          {isRefreshing ? "Aggiornamento..." : "Aggiorna"}
        </Button>
      </div>
    </nav>
  )
}
