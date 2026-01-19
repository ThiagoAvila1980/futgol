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
      description: String(body.description || ''),
      amount: Number(body.amount ?? 0),
      type: String(body.type || 'EXPENSE'),
      date: String(body.date || new Date().toISOString().split('T')[0]),
      category: String(body.category || 'OTHER'),
      related_player_id: body.relatedPlayerId ? String(body.relatedPlayerId) : null,
      related_match_id: body.relatedMatchId ? String(body.relatedMatchId) : null
    };

    try {
      await sql(`INSERT INTO transactions(id, group_id, description, amount, type, date, category, related_player_id, related_match_id)
                 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 ON CONFLICT (id) DO UPDATE SET group_id=EXCLUDED.group_id, description=EXCLUDED.description, amount=EXCLUDED.amount, type=EXCLUDED.type, date=EXCLUDED.date, category=EXCLUDED.category, related_player_id=EXCLUDED.related_player_id, related_match_id=EXCLUDED.related_match_id`,
        [payload.id, payload.group_id, payload.description, payload.amount, payload.type, payload.date, payload.category, payload.related_player_id, payload.related_match_id]
      );
      res.statusCode = 204;
      res.end('');
    } catch (err: any) {
      console.error('Error saving transaction:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  if (req.method === 'DELETE') {
    await sql(`DELETE FROM transactions WHERE id = $1`, [id]);
    res.statusCode = 204;
    res.end('');
    return;
  }
  res.statusCode = 405;
  res.end('Method Not Allowed');
}
