import { ready } from '../../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  const url = String((req as any).originalUrl || (req as any).path || req.url || '');
  const match = url.match(/\/api\/groups\/(\d+)\/members(?:\/(\d+))?/);
  const groupIdRaw = (req as any).params?.id || (match ? match[1] : undefined);
  const playerIdRaw = (req as any).params?.playerId || (match && match[2] ? match[2] : (req.query?.playerId as string | undefined));
  const groupId = /^\d+$/.test(String(groupIdRaw || '')) ? Number(groupIdRaw) : undefined;
  const method = req.method;
  if (!groupId || (method === 'DELETE' && !playerIdRaw)) {
    const parts = url.split('/').filter(Boolean);
    const gi = parts.indexOf('groups');
    const mi = parts.indexOf('members');
    const g2 = gi >= 0 && parts[gi + 1] && /^\d+$/.test(parts[gi + 1]) ? Number(parts[gi + 1]) : undefined;
    const p2 = mi >= 0 && parts[mi + 1] && /^\d+$/.test(parts[mi + 1]) ? parts[mi + 1] : undefined;
    if (!groupId && g2 != null) {
      (groupId as any) = g2;
    }
    if (!playerIdRaw && p2 != null) {
      (playerIdRaw as any) = p2;
    }
  }
  if (method === 'GET') {
    if (!groupId) {
      res.statusCode = 400;
      res.end('Missing group id');
      return;
    }
    const rows = await sql(
      `SELECT p.*, gp.role, gp.joined_at FROM players p INNER JOIN group_players gp ON gp.player_id = p.id WHERE gp.group_id = $1`,
      [groupId]
    ) as any[];
    const data = rows.map((p: any) => ({
      id: String(p.id),
      groupId: String(p.group_id || ''),
      userId: p.user_id ? String(p.user_id) : null,
      profileId: p.profile_id ? String(p.profile_id) : null,
      name: String(p.name || ''),
      nickname: String(p.nickname || ''),
      birthDate: String(p.birth_date || ''),
      email: String(p.email || ''),
      phone: p.phone ? String(p.phone) : null,
      favoriteTeam: String(p.favorite_team || ''),
      position: String(p.position || ''),
      rating: Number(p.rating ?? 0),
      matchesPlayed: Number(p.matches_played ?? 0),
      avatar: p.avatar ? String(p.avatar) : null,
      isMonthlySubscriber: Number(p.is_monthly_subscriber ?? 0) === 1,
      monthlyStartMonth: p.monthly_start_month ? String(p.monthly_start_month) : null,
      isGuest: Number(p.is_guest ?? 0) === 1,
      role: p.role ? String(p.role) : '',
      joinedAt: p.joined_at ? String(p.joined_at) : ''
    }));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return;
  }
  const isBatch = /\/members\/batch(?:\/)?$/.test(url);
  if ((method === 'POST' || method === 'PUT') && isBatch) {
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const items = Array.isArray(body.items) ? body.items : [];
    if (!groupId || items.length === 0) {
      res.statusCode = 400;
      res.end('Missing groupId or items');
      return;
    }
    let upserts = 0;
    for (const it of items) {
      const pid = /^\d+$/.test(String(it?.playerId || '')) ? Number(it.playerId) : undefined;
      const role = String(it?.role || '');
      const joinedAt = String(it?.joinedAt || new Date().toISOString());
      if (!pid) continue;
      await sql(
        `INSERT INTO group_players(group_id, player_id, role, joined_at)
         VALUES($1,$2,$3,$4)
         ON CONFLICT (group_id, player_id) DO UPDATE SET role=EXCLUDED.role`,
        [groupId, pid, role, joinedAt]
      );
      upserts++;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, upserts }));
    return;
  }
  if (method === 'POST' || method === 'PUT') {
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const playerId = /^\d+$/.test(String(body.playerId || '')) ? Number(body.playerId) : undefined;
    const role = String(body.role || '');
    const joinedAt = String(body.joinedAt || new Date().toISOString());
    if (!groupId || !playerId) {
      res.statusCode = 400;
      res.end('Missing groupId or playerId');
      return;
    }
    await sql(
      `INSERT INTO group_players(group_id, player_id, role, joined_at)
       VALUES($1,$2,$3,$4)
       ON CONFLICT (group_id, player_id) DO UPDATE SET role=EXCLUDED.role`,
      [groupId, playerId, role, joinedAt]
    );
    res.statusCode = 204;
    res.end('');
    return;
  }
  if (method === 'DELETE') {
    const playerId = /^\d+$/.test(String(playerIdRaw || '')) ? Number(playerIdRaw) : undefined;
    if (!groupId || !playerId) {
      res.statusCode = 400;
      res.end('Missing groupId or playerId');
      return;
    }
    await sql(`DELETE FROM group_players WHERE group_id = $1 AND player_id = $2`, [groupId, playerId]);
    res.statusCode = 204;
    res.end('');
    return;
  }
  res.statusCode = 405;
  res.end('Method Not Allowed');
}
