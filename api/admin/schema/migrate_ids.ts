import { ready, ensureSchema } from '../../_db';

export default async function (req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const auth = String(req.headers['authorization'] || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const required = process.env.SCHEMA_ADMIN_TOKEN || '';
  if (!required || token !== required) {
    res.statusCode = 401;
    res.end('Unauthorized');
    return;
  }
  const sql = await ready();
  const tables = ['comments','transactions','matches','fields','players','groups','users','player_profiles'];
  for (const t of tables) {
    try { await sql(`DROP TABLE IF EXISTS ${t} CASCADE`); } catch {}
  }
  await ensureSchema();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, recreated: tables }));
}
