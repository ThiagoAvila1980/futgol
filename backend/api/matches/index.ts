import { ready } from '../_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const groupId = url.searchParams.get('groupId') || '';
  const rows = await sql(`SELECT * FROM matches WHERE group_id = $1`, [groupId]) as any[];
  const data = rows.map((m: any) => ({
    id: m.id,
    groupId: m.group_id,
    date: m.date,
    time: m.time,
    fieldId: m.field_id,
    confirmedPlayerIds: m.confirmed_player_ids ? JSON.parse(m.confirmed_player_ids) : [],
    paidPlayerIds: m.paid_player_ids ? JSON.parse(m.paid_player_ids) : [],
    arrivedPlayerIds: m.arrived_player_ids ? JSON.parse(m.arrived_player_ids) : [],
    teamA: m.team_a ? JSON.parse(m.team_a) : [],
    teamB: m.team_b ? JSON.parse(m.team_b) : [],
    scoreA: Number(m.score_a || 0),
    scoreB: Number(m.score_b || 0),
    finished: !!m.finished,
    mvpId: m.mvp_id || undefined,
    subMatches: m.sub_matches ? JSON.parse(m.sub_matches) : []
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
