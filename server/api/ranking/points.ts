import { ready } from '../_db';

function toIsoDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function safeJson<T>(raw: any, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function computePlayerPointsFromMatch(m: any): Record<string, { attended: boolean; goals: number; assists: number; points: number }> {
  const confirmed: string[] = safeJson(m.confirmed_player_ids, []);
  const arrived: string[] = safeJson(m.arrived_player_ids, []);
  const teamA: any[] = safeJson(m.team_a, []);
  const teamB: any[] = safeJson(m.team_b, []);
  const subMatches: any[] = safeJson(m.sub_matches, []);

  const attendees = new Set<string>(arrived.filter(Boolean));
  for (const p of [...teamA, ...teamB]) {
    if (p && typeof p.id === 'string') attendees.add(p.id);
  }
  for (const sm of subMatches) {
    for (const p of [...(sm?.teamA || []), ...(sm?.teamB || [])]) {
      if (p && typeof p.id === 'string') attendees.add(p.id);
    }
  }

  // Backward-compat: legacy matches might have only confirmed list
  if (attendees.size === 0) {
    for (const pid of confirmed) attendees.add(pid);
  }

  const goals: Record<string, number> = {};
  const assists: Record<string, number> = {};
  for (const sm of subMatches) {
    const g = sm?.goals || {};
    const a = sm?.assists || {};
    if (g && typeof g === 'object') {
      for (const [pid, count] of Object.entries(g)) {
        const n = Number(count || 0);
        if (!Number.isFinite(n) || n <= 0) continue;
        goals[pid] = (goals[pid] || 0) + n;
      }
    }
    if (a && typeof a === 'object') {
      for (const [pid, count] of Object.entries(a)) {
        const n = Number(count || 0);
        if (!Number.isFinite(n) || n <= 0) continue;
        assists[pid] = (assists[pid] || 0) + n;
      }
    }
  }

  const allPlayers = new Set<string>([...attendees, ...Object.keys(goals), ...Object.keys(assists)]);
  const out: Record<string, { attended: boolean; goals: number; assists: number; points: number }> = {};
  for (const pid of allPlayers) {
    const attended = attendees.has(pid);
    const g = goals[pid] || 0;
    const a = assists[pid] || 0;
    const points = (attended ? 1 : 0) + a * 2 + g * 3;
    out[pid] = { attended, goals: g, assists: a, points };
  }
  return out;
}

export default async function (req: any, res: any) {
  const sql = await ready();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const groupId = url.searchParams.get('groupId') || '';
  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';

  if (!groupId) {
    res.statusCode = 400;
    res.end('groupId is required');
    return;
  }

  // Defaults: current month
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = toIsoDateOnly(now);
  const start = startDate || defaultStart;
  const end = endDate || defaultEnd;

  const rows = await sql(
    `SELECT * FROM matches
     WHERE group_id = $1
       AND finished = 1
       AND (is_canceled IS NULL OR is_canceled = 0)
       AND date >= $2 AND date <= $3`,
    [groupId, start, end]
  ) as any[];

  const agg: Record<string, { points: number; goals: number; assists: number; matchesAttended: number; matchesCounted: number }> = {};

  for (const m of rows) {
    const pointsMap = m.player_points
      ? safeJson<Record<string, any>>(m.player_points, {})
      : computePlayerPointsFromMatch(m);

    for (const [playerId, p] of Object.entries(pointsMap || {})) {
      if (!playerId) continue;
      const attended = !!p?.attended;
      const goals = Number(p?.goals || 0) || 0;
      const assists = Number(p?.assists || 0) || 0;
      const points = Number(p?.points ?? ((attended ? 1 : 0) + assists * 2 + goals * 3)) || 0;

      if (!agg[playerId]) {
        agg[playerId] = { points: 0, goals: 0, assists: 0, matchesAttended: 0, matchesCounted: 0 };
      }
      agg[playerId].points += points;
      agg[playerId].goals += goals;
      agg[playerId].assists += assists;
      agg[playerId].matchesCounted += 1;
      if (attended) agg[playerId].matchesAttended += 1;
    }
  }

  const list = Object.entries(agg)
    .map(([playerId, a]) => ({ playerId, ...a }))
    .sort((x, y) =>
      (y.points - x.points) ||
      (y.goals - x.goals) ||
      (y.assists - x.assists) ||
      (y.matchesAttended - x.matchesAttended)
    )
    .map((item, idx) => ({ rank: idx + 1, ...item }));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ groupId, startDate: start, endDate: end, ranking: list }));
}

