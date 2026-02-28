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

  // Auto-calculate MVP for finished matches older than 2 days
  const now = new Date();
  const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;

  for (const m of rows) {
    if (m.finished && !m.mvp_id) {
      const matchDate = new Date(`${m.date}T${m.time || '00:00:00'}`);
      if (now.getTime() - matchDate.getTime() > twoDaysInMs) {
        // Calculate MVP from match_votes
        const votes = await sql(`SELECT voted_for_id FROM match_votes WHERE match_id = $1`, [m.id]) as any[];
        if (votes.length > 0) {
          const counts: Record<string, number> = {};
          votes.forEach(v => {
            counts[v.voted_for_id] = (counts[v.voted_for_id] || 0) + 1;
          });
          let winnerId = '';
          let maxVotes = -1;
          Object.entries(counts).forEach(([pid, count]) => {
            if (count > maxVotes) {
              maxVotes = count;
              winnerId = pid;
            }
          });
          if (winnerId) {
            await sql(`UPDATE matches SET mvp_id = $1 WHERE id = $2`, [winnerId, m.id]);
            m.mvp_id = winnerId;
          }
        }
      }
    }
  }

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
    subMatches: m.sub_matches ? JSON.parse(m.sub_matches) : [],
    isCanceled: !!m.is_canceled
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
