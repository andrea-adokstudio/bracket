import { fetchAndSaveSofascoreData } from "../lib/sofascore"

async function main() {
  await fetchAndSaveSofascoreData()
  console.log("Dati salvati in data/standings.json e data/events.json")
}

main().catch((error: unknown) => {
  console.error("Errore durante il fetch dei dati:", error)
  if (error instanceof Error && (error.message.includes("403") || error.message.includes("Forbidden"))) {
    console.error(
      "\nSu questo Mac prova nel terminale (stessa sessione):\n" +
        "  export SOFASCORE_COOKIE='incolla qui il Cookie dalla scheda Network del browser'\n" +
        "  npm run fetch-data\n",
    )
  }
  process.exit(1)
})
