import { NextResponse } from "next/server"

import { fetchAndSaveSofascoreData } from "@/lib/sofascore"

export async function POST() {
  try {
    const result = await fetchAndSaveSofascoreData()
    return NextResponse.json(
      {
        ok: true,
        message: "Dati aggiornati con successo.",
        updatedAt: result.updatedAt,
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sconosciuto"
    return NextResponse.json(
      {
        ok: false,
        message: `Aggiornamento fallito: ${message}`,
      },
      { status: 500 },
    )
  }
}
