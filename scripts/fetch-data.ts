import { fetchAndSaveSofascoreData } from "../lib/sofascore"

async function main() {
  await fetchAndSaveSofascoreData()
  console.log("Dati salvati in data/standings.json e data/events.json")
}

main().catch((error: unknown) => {
  console.error("Errore durante il fetch dei dati:", error)
  process.exit(1)
})
