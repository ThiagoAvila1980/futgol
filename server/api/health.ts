import { ready } from './_db';

export default async function (req: any, res: any) {
  try {
    const sql = await ready();
    let hasGroupPlayers = false;
    try {
      const rows = await sql(`SELECT to_regclass('public.group_players') AS t`) as any[];
      hasGroupPlayers = !!rows[0]?.t;
    } catch {}
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', groupPlayersTable: hasGroupPlayers }));
  } catch {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok' }));
  }
}
