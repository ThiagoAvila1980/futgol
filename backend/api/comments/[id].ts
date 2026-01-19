import { ready } from '../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  const id = req.params?.id || req.query?.id || (req.url.split('?')[0].split('/').filter(Boolean).pop() as string);
  if (!id) {
    res.statusCode = 400;
    res.end('Missing id');
    return;
  }
  if (req.method === 'PUT') {
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const payload = {
      id: String(body.id || id),
      group_id: String(body.groupId || ''),
      match_id: String(body.matchId || ''),
      parent_id: body.parentId ? String(body.parentId) : null,
      author_player_id: String(body.authorPlayerId || ''),
      content: String(body.content || ''),
      created_at: String(body.createdAt || new Date().toISOString())
    };
    await sql(`INSERT INTO comments(id, group_id, match_id, parent_id, author_player_id, content, created_at)
               VALUES($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (id) DO UPDATE SET group_id=EXCLUDED.group_id, match_id=EXCLUDED.match_id, parent_id=EXCLUDED.parent_id, author_player_id=EXCLUDED.author_player_id, content=EXCLUDED.content, created_at=EXCLUDED.created_at`,
      [payload.id, payload.group_id, payload.match_id, payload.parent_id, payload.author_player_id, payload.content, payload.created_at]
    );
    res.statusCode = 204;
    res.end('');
    return;
  }
  if (req.method === 'DELETE') {
    await sql(`DELETE FROM comments WHERE id = $1`, [id]);
    res.statusCode = 204;
    res.end('');
    return;
  }
  res.statusCode = 405;
  res.end('Method Not Allowed');
}
