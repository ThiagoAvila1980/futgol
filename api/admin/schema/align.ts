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
  await ensureSchema();
  const drop = process.env.DROP_LEGACY_TABLES === '1';
  const list = (process.env.LEGACY_TABLES || '').split(',').map(s => s.trim()).filter(Boolean);
  const prefixes = (process.env.DROP_LEGACY_TABLES_PREFIXES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (drop && list.length > 0) {
    for (const t of list) {
      try { await sql(`DROP TABLE IF EXISTS ${t} CASCADE`); } catch {}
    }
  }
  let droppedByPrefix: string[] = [];
  if (drop && prefixes.length > 0) {
    const rows = await sql(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`) as any[];
    const names = rows.map((r: any) => String(r.tablename || ''));
    const targets = names.filter(n => prefixes.some(p => n.startsWith(p)));
    for (const t of targets) {
      try { await sql(`DROP TABLE IF EXISTS ${t} CASCADE`); droppedByPrefix.push(t); } catch {}
    }
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, dropped: drop ? list : [], droppedByPrefix }));
}
