import type { BracketData, BracketMatch, BracketRound, StandingRow, TeamInfo } from "@/lib/types"

function getTeamByPosition(rows: StandingRow[], position: number): TeamInfo | null {
  return rows.find((row) => row.position === position)?.team ?? null
}

function createSeededMatch(
  label: string,
  homeRows: StandingRow[],
  homePosition: number,
  homeGroup: "A" | "B",
  awayRows: StandingRow[],
  awayPosition: number,
  awayGroup: "A" | "B",
): BracketMatch {
  return {
    label,
    homeTeam: getTeamByPosition(homeRows, homePosition),
    awayTeam: getTeamByPosition(awayRows, awayPosition),
    homePosition,
    awayPosition,
    homeGroup,
    awayGroup,
  }
}

function createWinnerMatch(
  label: string,
  homePlaceholder: string,
  awayPlaceholder: string,
): BracketMatch {
  return {
    label,
    homeTeam: null,
    awayTeam: null,
    homePlaceholder,
    awayPlaceholder,
  }
}

export function buildBracketData(
  gironeA: StandingRow[],
  gironeB: StandingRow[],
): BracketData {
  const tabelloneA: BracketRound[] = [
    {
      name: "Ottavi",
      matches: [
        createSeededMatch("Gara 1", gironeA, 1, "A", gironeB, 8, "B"),
        createSeededMatch("Gara 2", gironeB, 4, "B", gironeA, 5, "A"),
        createSeededMatch("Gara 3", gironeB, 2, "B", gironeA, 7, "A"),
        createSeededMatch("Gara 4", gironeA, 3, "A", gironeB, 6, "B"),
      ],
    },
    {
      name: "Quarti",
      matches: [
        createWinnerMatch("Gara 5", "Vincente Gara 1", "Vincente Gara 2"),
        createWinnerMatch("Gara 6", "Vincente Gara 3", "Vincente Gara 4"),
      ],
    },
    {
      name: "Semifinale",
      matches: [createWinnerMatch("Gara 7", "Vincente Gara 5", "Vincente Gara 6")],
    },
  ]

  const tabelloneB: BracketRound[] = [
    {
      name: "Ottavi",
      matches: [
        createSeededMatch("Gara 8", gironeB, 1, "B", gironeA, 8, "A"),
        createSeededMatch("Gara 9", gironeA, 4, "A", gironeB, 5, "B"),
        createSeededMatch("Gara 10", gironeA, 2, "A", gironeB, 7, "B"),
        createSeededMatch("Gara 11", gironeB, 3, "B", gironeA, 6, "A"),
      ],
    },
    {
      name: "Quarti",
      matches: [
        createWinnerMatch("Gara 12", "Vincente Gara 8", "Vincente Gara 9"),
        createWinnerMatch("Gara 13", "Vincente Gara 10", "Vincente Gara 11"),
      ],
    },
    {
      name: "Semifinale",
      matches: [createWinnerMatch("Gara 14", "Vincente Gara 12", "Vincente Gara 13")],
    },
  ]

  const finaleConference: BracketRound[] = [
    {
      name: "Finale Conference",
      matches: [createWinnerMatch("Gara 15", "Vincente Gara 7", "Vincente Gara 14")],
    },
  ]

  const tabelloneC: BracketMatch[] = [
    createSeededMatch("Gara A", gironeA, 12, "A", gironeB, 15, "B"),
    createSeededMatch("Gara B", gironeB, 13, "B", gironeA, 14, "A"),
  ]

  const tabelloneD: BracketMatch[] = [
    createSeededMatch("Gara C", gironeB, 12, "B", gironeA, 15, "A"),
    createSeededMatch("Gara D", gironeA, 13, "A", gironeB, 14, "B"),
  ]

  return {
    tabelloneA,
    tabelloneB,
    finaleConference,
    tabelloneC,
    tabelloneD,
  }
}
