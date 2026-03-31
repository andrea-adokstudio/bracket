import type { ClassificationResult, MatchEvent, StandingRow } from "@/lib/types"

type Mode = "best" | "worst"

interface SimulatedMatchOutcome {
  winnerTeamId: number
  homeScore: number
  awayScore: number
}

interface HeadToHeadStats {
  points: number
  scored: number
  against: number
}

function isFinishedMatch(match: MatchEvent): boolean {
  return (
    match.statusType === "finished" ||
    match.status.toLowerCase() === "ended" ||
    match.status.toLowerCase() === "aet"
  )
}

export function getFinishedMatches(events: Record<string, MatchEvent[]>): MatchEvent[] {
  return Object.values(events)
    .flat()
    .filter(isFinishedMatch)
}

export function getRemainingMatches(events: Record<string, MatchEvent[]>): MatchEvent[] {
  return Object.values(events)
    .flat()
    .filter((match) => !isFinishedMatch(match))
}

function createOutcomeForWinner(match: MatchEvent, winnerTeamId: number): SimulatedMatchOutcome {
  if (winnerTeamId === match.homeTeam.id) {
    return { winnerTeamId, homeScore: 80, awayScore: 79 }
  }
  return { winnerTeamId, homeScore: 79, awayScore: 80 }
}

function buildRemainingByTeam(remainingMatches: MatchEvent[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const match of remainingMatches) {
    map.set(match.homeTeam.id, (map.get(match.homeTeam.id) ?? 0) + 1)
    map.set(match.awayTeam.id, (map.get(match.awayTeam.id) ?? 0) + 1)
  }
  return map
}

function computeOverallQuotients(
  standings: StandingRow[],
  outcomes: Map<number, SimulatedMatchOutcome>,
  remainingMatches: MatchEvent[],
): Map<number, number> {
  const totals = new Map<number, { scored: number; against: number }>()
  for (const row of standings) {
    totals.set(row.team.id, { scored: row.scoresFor, against: row.scoresAgainst })
  }

  for (const match of remainingMatches) {
    const outcome = outcomes.get(match.id)
    if (!outcome) continue

    const home = totals.get(match.homeTeam.id)
    const away = totals.get(match.awayTeam.id)
    if (!home || !away) continue

    home.scored += outcome.homeScore
    home.against += outcome.awayScore
    away.scored += outcome.awayScore
    away.against += outcome.homeScore
  }

  const quotients = new Map<number, number>()
  for (const row of standings) {
    const total = totals.get(row.team.id)
    if (!total || total.against === 0) {
      quotients.set(row.team.id, Number.POSITIVE_INFINITY)
      continue
    }
    quotients.set(row.team.id, total.scored / total.against)
  }

  return quotients
}

export function getHeadToHead(
  teamIds: number[],
  finishedMatches: MatchEvent[],
  outcomes: Map<number, SimulatedMatchOutcome>,
  remainingMatches: MatchEvent[],
): Map<number, HeadToHeadStats> {
  const allowed = new Set(teamIds)
  const stats = new Map<number, HeadToHeadStats>()
  for (const teamId of teamIds) {
    stats.set(teamId, { points: 0, scored: 0, against: 0 })
  }

  const allDirectMatches = [
    ...finishedMatches.filter(
      (match) => allowed.has(match.homeTeam.id) && allowed.has(match.awayTeam.id),
    ),
    ...remainingMatches.filter(
      (match) => allowed.has(match.homeTeam.id) && allowed.has(match.awayTeam.id),
    ),
  ]

  for (const match of allDirectMatches) {
    const homeStats = stats.get(match.homeTeam.id)
    const awayStats = stats.get(match.awayTeam.id)
    if (!homeStats || !awayStats) continue

    const simulated = outcomes.get(match.id)
    const homeScore = simulated ? simulated.homeScore : (match.homeScore.current ?? 0)
    const awayScore = simulated ? simulated.awayScore : (match.awayScore.current ?? 0)

    homeStats.scored += homeScore
    homeStats.against += awayScore
    awayStats.scored += awayScore
    awayStats.against += homeScore

    if (homeScore > awayScore) {
      homeStats.points += 2
    } else if (awayScore > homeScore) {
      awayStats.points += 2
    } else {
      // Fallback conservativo: in campionato non esiste pareggio, ma in dati parziali puo capitare.
      homeStats.points += 1
      awayStats.points += 1
    }
  }

  return stats
}

export function applyTiebreaker(
  tiedTeamIds: number[],
  standings: StandingRow[],
  finishedMatches: MatchEvent[],
  outcomes: Map<number, SimulatedMatchOutcome>,
  remainingMatches: MatchEvent[],
): number[] {
  const headToHead = getHeadToHead(tiedTeamIds, finishedMatches, outcomes, remainingMatches)
  const overallQuotients = computeOverallQuotients(standings, outcomes, remainingMatches)

  return [...tiedTeamIds].sort((a, b) => {
    const aHead = headToHead.get(a) ?? { points: 0, scored: 0, against: 0 }
    const bHead = headToHead.get(b) ?? { points: 0, scored: 0, against: 0 }

    if (aHead.points !== bHead.points) return bHead.points - aHead.points

    const aHeadQuot = aHead.against === 0 ? Number.POSITIVE_INFINITY : aHead.scored / aHead.against
    const bHeadQuot = bHead.against === 0 ? Number.POSITIVE_INFINITY : bHead.scored / bHead.against
    if (aHeadQuot !== bHeadQuot) return bHeadQuot - aHeadQuot

    const aOverallQuot = overallQuotients.get(a) ?? 0
    const bOverallQuot = overallQuotients.get(b) ?? 0
    if (aOverallQuot !== bOverallQuot) return bOverallQuot - aOverallQuot

    return a - b
  })
}

function rankTeams(
  standings: StandingRow[],
  pointsByTeam: Map<number, number>,
  finishedMatches: MatchEvent[],
  outcomes: Map<number, SimulatedMatchOutcome>,
  remainingMatches: MatchEvent[],
): number[] {
  const groups = new Map<number, number[]>()
  for (const row of standings) {
    const points = pointsByTeam.get(row.team.id) ?? row.points
    const group = groups.get(points) ?? []
    group.push(row.team.id)
    groups.set(points, group)
  }

  const sortedPoints = [...groups.keys()].sort((a, b) => b - a)
  const ranking: number[] = []
  for (const points of sortedPoints) {
    const tied = groups.get(points) ?? []
    if (tied.length === 1) {
      ranking.push(tied[0])
      continue
    }
    ranking.push(...applyTiebreaker(tied, standings, finishedMatches, outcomes, remainingMatches))
  }

  return ranking
}

function assignGreedyOutcomes(
  mode: Mode,
  targetTeamId: number,
  standings: StandingRow[],
  remainingMatches: MatchEvent[],
  pointsByTeam: Map<number, number>,
): Map<number, SimulatedMatchOutcome> {
  const outcomes = new Map<number, SimulatedMatchOutcome>()
  const baseByTeam = new Map<number, number>()
  for (const row of standings) {
    baseByTeam.set(row.team.id, pointsByTeam.get(row.team.id) ?? row.points)
  }

  const targetPoints = baseByTeam.get(targetTeamId) ?? 0

  for (const match of remainingMatches) {
    const homeId = match.homeTeam.id
    const awayId = match.awayTeam.id
    const homePts = baseByTeam.get(homeId) ?? 0
    const awayPts = baseByTeam.get(awayId) ?? 0

    let winner = homeId
    if (mode === "best") {
      if (homeId === targetTeamId) winner = homeId
      else if (awayId === targetTeamId) winner = awayId
      else if (homePts !== awayPts) winner = homePts < awayPts ? homeId : awayId
      else winner = Math.abs(homePts - targetPoints) > Math.abs(awayPts - targetPoints) ? homeId : awayId
    } else {
      if (homeId === targetTeamId) winner = awayId
      else if (awayId === targetTeamId) winner = homeId
      else if (homePts !== awayPts) winner = homePts > awayPts ? homeId : awayId
      else winner = Math.abs(homePts - targetPoints) < Math.abs(awayPts - targetPoints) ? homeId : awayId
    }

    const outcome = createOutcomeForWinner(match, winner)
    outcomes.set(match.id, outcome)
    baseByTeam.set(homeId, (baseByTeam.get(homeId) ?? 0) + (winner === homeId ? 2 : 0))
    baseByTeam.set(awayId, (baseByTeam.get(awayId) ?? 0) + (winner === awayId ? 2 : 0))
  }

  return outcomes
}

function evaluateTargetRank(
  targetTeamId: number,
  standings: StandingRow[],
  finishedMatches: MatchEvent[],
  remainingMatches: MatchEvent[],
  outcomes: Map<number, SimulatedMatchOutcome>,
): number {
  const pointsByTeam = new Map<number, number>()
  for (const row of standings) pointsByTeam.set(row.team.id, row.points)
  for (const match of remainingMatches) {
    const outcome = outcomes.get(match.id)
    if (!outcome) continue
    pointsByTeam.set(
      match.homeTeam.id,
      (pointsByTeam.get(match.homeTeam.id) ?? 0) + (outcome.winnerTeamId === match.homeTeam.id ? 2 : 0),
    )
    pointsByTeam.set(
      match.awayTeam.id,
      (pointsByTeam.get(match.awayTeam.id) ?? 0) + (outcome.winnerTeamId === match.awayTeam.id ? 2 : 0),
    )
  }

  const ranking = rankTeams(standings, pointsByTeam, finishedMatches, outcomes, remainingMatches)
  const index = ranking.findIndex((teamId) => teamId === targetTeamId)
  return index >= 0 ? index + 1 : standings.length
}

function improveGreedyWithLimitedBacktracking(
  mode: Mode,
  targetTeamId: number,
  standings: StandingRow[],
  finishedMatches: MatchEvent[],
  remainingMatches: MatchEvent[],
  baseOutcomes: Map<number, SimulatedMatchOutcome>,
): number {
  const targetRelatedMatches = remainingMatches.filter(
    (match) => match.homeTeam.id !== targetTeamId && match.awayTeam.id !== targetTeamId,
  )
  const depthMatches = targetRelatedMatches.slice(0, 8)

  let bestRank = evaluateTargetRank(
    targetTeamId,
    standings,
    finishedMatches,
    remainingMatches,
    baseOutcomes,
  )

  function dfs(index: number, current: Map<number, SimulatedMatchOutcome>) {
    if (index >= depthMatches.length) {
      const rank = evaluateTargetRank(targetTeamId, standings, finishedMatches, remainingMatches, current)
      if (mode === "best") bestRank = Math.min(bestRank, rank)
      else bestRank = Math.max(bestRank, rank)
      return
    }

    const match = depthMatches[index]
    const original = current.get(match.id)

    dfs(index + 1, current)

    const flippedWinner =
      original?.winnerTeamId === match.homeTeam.id ? match.awayTeam.id : match.homeTeam.id
    current.set(match.id, createOutcomeForWinner(match, flippedWinner))
    dfs(index + 1, current)

    if (original) current.set(match.id, original)
  }

  dfs(0, new Map(baseOutcomes))
  return bestRank
}

export function computeBestRank(
  team: StandingRow,
  standings: StandingRow[],
  remainingMatches: MatchEvent[],
  finishedMatches: MatchEvent[],
): number {
  const pointsByTeam = new Map<number, number>()
  for (const row of standings) {
    pointsByTeam.set(row.team.id, row.points)
  }

  const outcomes = assignGreedyOutcomes("best", team.team.id, standings, remainingMatches, pointsByTeam)
  return improveGreedyWithLimitedBacktracking(
    "best",
    team.team.id,
    standings,
    finishedMatches,
    remainingMatches,
    outcomes,
  )
}

export function computeWorstRank(
  team: StandingRow,
  standings: StandingRow[],
  remainingMatches: MatchEvent[],
  finishedMatches: MatchEvent[],
): number {
  const pointsByTeam = new Map<number, number>()
  for (const row of standings) {
    pointsByTeam.set(row.team.id, row.points)
  }

  const outcomes = assignGreedyOutcomes("worst", team.team.id, standings, remainingMatches, pointsByTeam)
  return improveGreedyWithLimitedBacktracking(
    "worst",
    team.team.id,
    standings,
    finishedMatches,
    remainingMatches,
    outcomes,
  )
}

export function computeClassificationZones(
  standings: StandingRow[],
  events: Record<string, MatchEvent[]>,
  totalMatches: number,
): ClassificationResult[] {
  const remainingMatches = getRemainingMatches(events)
  const remainingByTeam = buildRemainingByTeam(remainingMatches)

  return standings.map((team) => {
    const teamRemaining = remainingByTeam.get(team.team.id) ?? Math.max(0, totalMatches - team.matches)
    const teamMaxPoints = team.points + teamRemaining * 2
    const teamMinPoints = team.points

    // Bound matematico conservativo:
    // - best rank assume tiebreak favorevole alla squadra in caso di pari punti
    // - worst rank assume tiebreak sfavorevole in caso di pari punti
    const bestPossibleRank =
      1 + standings.filter((candidate) => candidate.team.id !== team.team.id && candidate.points > teamMaxPoints).length
    const worstPossibleRank =
      1 +
      standings.filter((candidate) => {
        if (candidate.team.id === team.team.id) return false
        const candidateRemaining =
          remainingByTeam.get(candidate.team.id) ?? Math.max(0, totalMatches - candidate.matches)
        const candidateMaxPoints = candidate.points + candidateRemaining * 2
        return candidateMaxPoints >= teamMinPoints
      }).length

    let zone: ClassificationResult["zone"] = "safe"
    if (worstPossibleRank <= 8) zone = "playoff-assured"
    else if (team.position <= 8) zone = "playoff-zone"
    else if (bestPossibleRank >= 15) zone = "relegated"
    else if (team.position >= 11 && team.position <= 14) zone = "playout-zone"

    return {
      teamId: team.team.id,
      currentRank: team.position,
      bestPossibleRank,
      worstPossibleRank,
      zone,
    }
  })
}

export function computeResolvedStandings(
  standings: StandingRow[],
  events: Record<string, MatchEvent[]>,
): StandingRow[] {
  const finishedMatches = getFinishedMatches(events)
  const pointsByTeam = new Map<number, number>()
  for (const row of standings) {
    pointsByTeam.set(row.team.id, row.points)
  }

  const ranking = rankTeams(standings, pointsByTeam, finishedMatches, new Map(), [])
  const rowByTeamId = new Map(standings.map((row) => [row.team.id, row] as const))

  return ranking
    .map((teamId, index) => {
      const row = rowByTeamId.get(teamId)
      if (!row) return null
      return {
        ...row,
        position: index + 1,
      }
    })
    .filter((row): row is StandingRow => row !== null)
}
