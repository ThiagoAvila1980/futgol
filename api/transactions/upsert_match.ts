import { ready } from '../_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const chunks: any[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  const groupId = String(body.groupId || '');
  const matchId = String(body.matchId || '');
  const totalAmount = Number(body.totalAmount ?? 0);
  const description = String(body.description || 'Agregado da partida');
  const date = String(body.date || new Date().toISOString().split('T')[0]);
  const id = `match_agg_${groupId}_${matchId}`;
  await sql(`INSERT INTO transactions(id, group_id, description, amount, type, date, category, related_match_id)
             VALUES($1,$2,$3,$4,'INCOME',$5,'MATCH_REVENUE',$6)
             ON CONFLICT (id) DO UPDATE SET group_id=EXCLUDED.group_id, description=EXCLUDED.description, amount=EXCLUDED.amount, type=EXCLUDED.type, date=EXCLUDED.date, category=EXCLUDED.category, related_match_id=EXCLUDED.related_match_id`,
    [id, groupId, description, totalAmount, date, matchId]
  );
  res.statusCode = 204;
  res.end('');
}
