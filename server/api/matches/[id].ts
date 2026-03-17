import { ready } from '../../api/_db';

function safeParseJson<T>(raw: any, fallback: T): T {
  try {
    if (raw == null) return fallback;
    if (typeof raw === 'string') return (JSON.parse(raw) as T) ?? fallback;
    return (raw as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function computePlayerPoints(input: {
  confirmedPlayerIds?: string[];
  arrivedPlayerIds?: string[];
  teamA?: any[];
  teamB?: any[];
  subMatches?: any[];
}): Record<string, { attended: boolean; goals: number; assists: number; points: number }> {
  const confirmed = Array.isArray(input.confirmedPlayerIds) ? input.confirmedPlayerIds : [];
  const arrived = Array.isArray(input.arrivedPlayerIds) ? input.arrivedPlayerIds : [];
  const teamA = Array.isArray(input.teamA) ? input.teamA : [];
  const teamB = Array.isArray(input.teamB) ? input.teamB : [];
  const subMatches = Array.isArray(input.subMatches) ? input.subMatches : [];

  const attendees = new Set<string>(arrived.filter(Boolean));
  for (const p of [...teamA, ...teamB]) {
    if (p && typeof p.id === 'string') attendees.add(p.id);
  }
  for (const sm of subMatches) {
    for (const p of [...(sm?.teamA || []), ...(sm?.teamB || [])]) {
      if (p && typeof p.id === 'string') attendees.add(p.id);
    }
  }

  // Backward-compat: if there is no reliable attendance signal saved,
  // fallback to confirmed list for legacy matches.
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
  const id = req.params?.id || req.query?.id || (req.url.split('?')[0].split('/').filter(Boolean).pop() as string);
  if (req.method === 'PUT') {
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const idFromBody = body.id;
    const idFromPath = id;
    const finalId = idFromBody ? String(idFromBody) : (idFromPath ? String(idFromPath) : undefined);

    const subMatches = safeParseJson<any[]>(body.subMatches, []);
    const arrivedPlayerIds = safeParseJson<string[]>(body.arrivedPlayerIds, []);
    const teamA = safeParseJson<any[]>(body.teamA, []);
    const teamB = safeParseJson<any[]>(body.teamB, []);

    const computedPoints = computePlayerPoints({ confirmedPlayerIds: body.confirmedPlayerIds, arrivedPlayerIds, teamA, teamB, subMatches });
    const playerPoints = body.playerPoints && typeof body.playerPoints === 'object'
      ? body.playerPoints
      : computedPoints;

    const payload = {
      id: finalId,
      group_id: String(body.groupId || ''),
      date: String(body.date || ''),
      time: String(body.time || ''),
      field_id: String(body.fieldId || ''),
      confirmed_player_ids: JSON.stringify(body.confirmedPlayerIds || []),
      paid_player_ids: JSON.stringify(body.paidPlayerIds || []),
      arrived_player_ids: JSON.stringify(arrivedPlayerIds),
      team_a: JSON.stringify(teamA),
      team_b: JSON.stringify(teamB),
      score_a: Number(body.scoreA ?? 0),
      score_b: Number(body.scoreB ?? 0),
      finished: body.finished ? 1 : 0,
      mvp_id: body.mvpId ? String(body.mvpId) : null,
      sub_matches: JSON.stringify(subMatches),
      player_points: JSON.stringify(playerPoints || {})
    };
    if (payload.id == null) {
      const rows = await sql(`INSERT INTO matches(group_id, date, time, field_id, confirmed_player_ids, paid_player_ids, arrived_player_ids, team_a, team_b, score_a, score_b, finished, mvp_id, sub_matches, player_points)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [payload.group_id, payload.date, payload.time, payload.field_id, payload.confirmed_player_ids, payload.paid_player_ids, payload.arrived_player_ids, payload.team_a, payload.team_b, payload.score_a, payload.score_b, payload.finished, payload.mvp_id, payload.sub_matches, payload.player_points]
      ) as any[];
      const newId = rows[0]?.id;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...payload, id: String(newId) }));
    } else {
      await sql(`INSERT INTO matches(id, group_id, date, time, field_id, confirmed_player_ids, paid_player_ids, arrived_player_ids, team_a, team_b, score_a, score_b, finished, mvp_id, sub_matches, player_points)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
               ON CONFLICT (id) DO UPDATE SET group_id=EXCLUDED.group_id, date=EXCLUDED.date, time=EXCLUDED.time, field_id=EXCLUDED.field_id, confirmed_player_ids=EXCLUDED.confirmed_player_ids, paid_player_ids=EXCLUDED.paid_player_ids, arrived_player_ids=EXCLUDED.arrived_player_ids, team_a=EXCLUDED.team_a, team_b=EXCLUDED.team_b, score_a=EXCLUDED.score_a, score_b=EXCLUDED.score_b, finished=EXCLUDED.finished, mvp_id=EXCLUDED.mvp_id, sub_matches=EXCLUDED.sub_matches, player_points=EXCLUDED.player_points`,
        [payload.id, payload.group_id, payload.date, payload.time, payload.field_id, payload.confirmed_player_ids, payload.paid_player_ids, payload.arrived_player_ids, payload.team_a, payload.team_b, payload.score_a, payload.score_b, payload.finished, payload.mvp_id, payload.sub_matches, payload.player_points]
      );
      res.statusCode = 204;
      res.end('');
    }
    return;
  }
  if (req.method === 'DELETE') {
    await sql(`DELETE FROM matches WHERE id = $1`, [id]);
    res.statusCode = 204;
    res.end('');
    return;
  }
  res.statusCode = 405;
  res.end('Method Not Allowed');
}
