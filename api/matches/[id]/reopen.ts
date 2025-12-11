import { ready } from '../../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  const parts = req.url.split('/');
  const id = parts[parts.indexOf('matches') + 1];
  if (req.method !== 'POST' || !id) {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const rows = await sql(`SELECT * FROM matches WHERE id = $1`, [id]) as any[];
  if (!rows.length) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }
  await sql(`UPDATE matches SET finished = 0 WHERE id = $1`, [id]);
  const m = rows[0];
  const data = {
    id: m.id,
    groupId: m.group_id,
    date: m.date,
    time: m.time,
    fieldId: m.field_id,
    confirmedPlayerIds: m.confirmed_player_ids ? JSON.parse(m.confirmed_player_ids) : [],
    paidPlayerIds: m.paid_player_ids ? JSON.parse(m.paid_player_ids) : [],
    teamA: m.team_a ? JSON.parse(m.team_a) : [],
    teamB: m.team_b ? JSON.parse(m.team_b) : [],
    scoreA: Number(m.score_a || 0),
    scoreB: Number(m.score_b || 0),
    finished: false,
    mvpId: m.mvp_id || undefined
  };
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
