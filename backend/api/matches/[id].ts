import { ready } from '../../api/_db';

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
    const payload = {
      id: finalId,
      group_id: String(body.groupId || ''),
      date: String(body.date || ''),
      time: String(body.time || ''),
      field_id: String(body.fieldId || ''),
      confirmed_player_ids: JSON.stringify(body.confirmedPlayerIds || []),
      paid_player_ids: JSON.stringify(body.paidPlayerIds || []),
      arrived_player_ids: JSON.stringify(body.arrivedPlayerIds || []),
      team_a: JSON.stringify(body.teamA || []),
      team_b: JSON.stringify(body.teamB || []),
      score_a: Number(body.scoreA ?? 0),
      score_b: Number(body.scoreB ?? 0),
      finished: body.finished ? 1 : 0,
      mvp_id: body.mvpId ? String(body.mvpId) : null,
      sub_matches: JSON.stringify(body.subMatches || [])
    };
    if (payload.id == null) {
      const rows = await sql(`INSERT INTO matches(group_id, date, time, field_id, confirmed_player_ids, paid_player_ids, arrived_player_ids, team_a, team_b, score_a, score_b, finished, mvp_id, sub_matches)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [payload.group_id, payload.date, payload.time, payload.field_id, payload.confirmed_player_ids, payload.paid_player_ids, payload.arrived_player_ids, payload.team_a, payload.team_b, payload.score_a, payload.score_b, payload.finished, payload.mvp_id, payload.sub_matches]
      ) as any[];
      const newId = rows[0]?.id;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...payload, id: String(newId) }));
    } else {
      await sql(`INSERT INTO matches(id, group_id, date, time, field_id, confirmed_player_ids, paid_player_ids, arrived_player_ids, team_a, team_b, score_a, score_b, finished, mvp_id, sub_matches)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
               ON CONFLICT (id) DO UPDATE SET group_id=EXCLUDED.group_id, date=EXCLUDED.date, time=EXCLUDED.time, field_id=EXCLUDED.field_id, confirmed_player_ids=EXCLUDED.confirmed_player_ids, paid_player_ids=EXCLUDED.paid_player_ids, arrived_player_ids=EXCLUDED.arrived_player_ids, team_a=EXCLUDED.team_a, team_b=EXCLUDED.team_b, score_a=EXCLUDED.score_a, score_b=EXCLUDED.score_b, finished=EXCLUDED.finished, mvp_id=EXCLUDED.mvp_id, sub_matches=EXCLUDED.sub_matches`,
        [payload.id, payload.group_id, payload.date, payload.time, payload.field_id, payload.confirmed_player_ids, payload.paid_player_ids, payload.arrived_player_ids, payload.team_a, payload.team_b, payload.score_a, payload.score_b, payload.finished, payload.mvp_id, payload.sub_matches]
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
