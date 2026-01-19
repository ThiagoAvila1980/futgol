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
  const matchId = url.searchParams.get('matchId') || '';
  const rows = await sql(`SELECT id, group_id, match_id, parent_id, author_player_id, content, created_at FROM comments WHERE group_id = $1 AND match_id = $2 ORDER BY created_at ASC`, [groupId, matchId]) as any[];
  const data = rows.map((r: any) => ({
    id: r.id,
    groupId: r.group_id,
    matchId: r.match_id,
    parentId: r.parent_id || undefined,
    authorPlayerId: r.author_player_id,
    content: r.content,
    createdAt: r.created_at
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
