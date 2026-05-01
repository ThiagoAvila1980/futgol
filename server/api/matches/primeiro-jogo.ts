/**
 * Resultado do primeiro sub-jogo em que cada jogador entrou em campo na sessão (match).
 * V = vitória, E = empate, D = derrota (placar do sub-jogo).
 */
export type PrimeiroJogoStatus = 'V' | 'E' | 'D';

function outcome(scoreA: number, scoreB: number, onTeamA: boolean): PrimeiroJogoStatus {
  if (scoreA === scoreB) return 'E';
  if (onTeamA) return scoreA > scoreB ? 'V' : 'D';
  return scoreB > scoreA ? 'V' : 'D';
}

export function computePrimeiroJogoPorJogador(input: {
  subMatches: any[];
  teamA: any[];
  teamB: any[];
  scoreA: number;
  scoreB: number;
}): Record<string, PrimeiroJogoStatus> {
  const { subMatches, teamA, teamB, scoreA, scoreB } = input;
  const out: Record<string, PrimeiroJogoStatus> = {};
  const assigned = new Set<string>();

  const list = Array.isArray(subMatches) ? subMatches : [];

  for (const sm of list) {
    if (sm && sm.finished === false) continue;
    const sa = Number(sm?.scoreA ?? 0);
    const sb = Number(sm?.scoreB ?? 0);
    const ta = Array.isArray(sm?.teamA) ? sm.teamA : [];
    const tb = Array.isArray(sm?.teamB) ? sm.teamB : [];

    for (const p of ta) {
      const id = p?.id;
      if (typeof id !== 'string' || !id || assigned.has(id)) continue;
      assigned.add(id);
      out[id] = outcome(sa, sb, true);
    }
    for (const p of tb) {
      const id = p?.id;
      if (typeof id !== 'string' || !id || assigned.has(id)) continue;
      assigned.add(id);
      out[id] = outcome(sa, sb, false);
    }
  }

  if (list.length === 0) {
    const sa = Number(scoreA ?? 0);
    const sb = Number(scoreB ?? 0);
    const ta = Array.isArray(teamA) ? teamA : [];
    const tb = Array.isArray(teamB) ? teamB : [];
    for (const p of ta) {
      const id = p?.id;
      if (typeof id !== 'string' || !id || assigned.has(id)) continue;
      assigned.add(id);
      out[id] = outcome(sa, sb, true);
    }
    for (const p of tb) {
      const id = p?.id;
      if (typeof id !== 'string' || !id || assigned.has(id)) continue;
      assigned.add(id);
      out[id] = outcome(sa, sb, false);
    }
  }

  return out;
}

export function primeiroJogoStatusToPoints(st: PrimeiroJogoStatus): number {
  if (st === 'V') return 3;
  if (st === 'E') return 1;
  return 0;
}
