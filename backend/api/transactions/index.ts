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
  const rows = await sql(`SELECT * FROM transactions WHERE group_id = $1`, [groupId]) as any[];
  const data = rows.map((t: any) => ({
    id: t.id,
    groupId: t.group_id,
    description: t.description,
    amount: Number(t.amount || 0),
    type: t.type,
    date: t.date,
    category: t.category,
    relatedPlayerId: t.related_player_id || undefined,
    relatedMatchId: t.related_match_id || undefined
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
