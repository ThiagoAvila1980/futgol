import { ready } from '../../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  const url = String((req as any).originalUrl || (req as any).path || req.url || '');
  const match = url.match(/\/api\/groups\/([^\/]+)\/members(?:\/([^\/]+))?/);
  const groupIdRaw = (req as any).params?.id || (match ? match[1] : undefined);
  const playerIdRaw = (req as any).params?.playerId || (match && match[2] ? match[2] : (req.query?.playerId as string | undefined));
  const groupId = groupIdRaw;
  const method = req.method;

  if (method === 'GET') {
    if (!groupId) {
      res.statusCode = 400;
      res.end('Missing group id');
      return;
    }
    const rows = await sql(
      `SELECT u.id as user_id, u.name, u.email, u.phone, u.avatar, u.birth_date, u.favorite_team,
              gp.id as link_id, gp.role, gp.joined_at, gp.nickname, gp.position, gp.rating, gp.matches_played, 
              gp.is_monthly_subscriber, gp.monthly_start_month, gp.is_guest
       FROM players u
       INNER JOIN group_players gp ON gp.player_id = u.id
       WHERE gp.group_id = $1`,
      [groupId]
    ) as any[];

    // Map to a structure compatible with Frontend 'Player' but based on User
    const data = rows.map((r: any) => ({
      id: String(r.user_id), // Exposing User ID as the main 'Player' ID for compatibility with matches logic
      groupPlayerId: String(r.link_id),
      groupId: String(groupId),
      userId: String(r.user_id),
      name: String(r.name || ''),
      nickname: String(r.nickname || ''), // Prioritize group nickname
      birthDate: String(r.birth_date || ''),
      email: String(r.email || ''),
      phone: r.phone ? String(r.phone) : null,
      favoriteTeam: String(r.favorite_team || ''),
      position: String(r.position || ''),
      rating: Number(r.rating ?? 5.0),
      matchesPlayed: Number(r.matches_played ?? 0),
      avatar: r.avatar ? String(r.avatar) : null,
      isMonthlySubscriber: Number(r.is_monthly_subscriber ?? 0) === 1,
      monthlyStartMonth: r.monthly_start_month ? String(r.monthly_start_month) : null,
      isGuest: Number(r.is_guest ?? 0) === 1,
      role: r.role ? String(r.role) : 'member',
      joinedAt: r.joined_at ? String(r.joined_at) : ''
    }));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return;
  }

  // POST/PUT Logic needs to be careful:
  // If adding a member, we might need to find an existing USER by email/phone or create a new GUEST USER.
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
      // Ideally we need userId. If not provided, we might fail or auto-create guest?
      // For batch import, assuming userIds are known or this is for migration?
      // Usually batch is used for adding existing users.
      const uid = /^\d+$/.test(String(it?.userId || '')) ? Number(it.userId) : undefined;
      if (!uid) continue; // Skip if no user ID

      await sql(
        `INSERT INTO group_players(group_id, player_id, role, nickname, position, joined_at)
          VALUES($1,$2,$3,$4,$5,$6)
          ON CONFLICT (group_id, player_id) DO UPDATE SET role=EXCLUDED.role`,
        [groupId, uid, it.role || 'member', it.nickname, it.position, it.joinedAt || new Date().toISOString()]
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

    // Input might have userId (if picking existing) OR name/email (if creating guest).
    let userId = body.userId;
    const name = body.name;
    const email = body.email;
    const phone = body.phone ? String(body.phone).replace(/\D/g, '') : null;

    if (!groupId) { res.statusCode = 400; res.end('nid'); return; }

    if (!userId && name) {
      // Create new guest user or find by email/phone
      const cleanEmail = email && email.trim() !== '' ? email : null;
      if (cleanEmail) {
        const existing = await sql(`SELECT id FROM players WHERE email=$1`, [cleanEmail]);
        if (existing.length) userId = existing[0].id;
      }
      if (!userId && phone) {
        const existing = await sql(`SELECT id FROM players WHERE REGEXP_REPLACE(phone, '\\D', '', 'g') = $1`, [phone]);
        if (existing.length) userId = existing[0].id;
      }

      if (!userId) {
        const r = await sql(`INSERT INTO players(name, email, phone, birth_date, favorite_team, password_hash, created_at, role) 
                                 VALUES($1, $2, $3, $4, $5, 'guest', NOW(), 'user') RETURNING id`,
          [name, cleanEmail, phone, body.birthDate || null, body.favoriteTeam || null]);
        userId = r[0].id;
      }
    }

    if (!userId) {
      res.statusCode = 400; res.end('Missing userId or name to create guest'); return;
    }

    await sql(
      `INSERT INTO group_players(id, group_id, player_id, role, nickname, position, rating, is_monthly_subscriber, monthly_start_month, is_guest, joined_at)
       VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (group_id, player_id) DO UPDATE SET 
         role=EXCLUDED.role, nickname=EXCLUDED.nickname, position=EXCLUDED.position, 
         rating=EXCLUDED.rating, is_monthly_subscriber=EXCLUDED.is_monthly_subscriber, 
         monthly_start_month=EXCLUDED.monthly_start_month, is_guest=EXCLUDED.is_guest`,
      [
        groupId,
        userId,
        body.role || 'member',
        body.nickname,
        body.position,
        body.rating || 5.0,
        body.isMonthlySubscriber ? 1 : 0,
        body.monthlyStartMonth || null,
        body.isGuest ? 1 : 0,
        body.joinedAt || new Date().toISOString()
      ]
    );
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, userId }));
    return;
  }

  if (method === 'DELETE') {
    // URL might have :playerId, which now we treat as userId based on GET logic?
    // Or linkId?
    // The previous GET returned id=user_id. So we assume parameter is user_id.
    const targetUserId = playerIdRaw;
    if (!groupId || !targetUserId) {
      res.statusCode = 400;
      res.end('Missing groupId or targetId');
      return;
    }
    await sql(`DELETE FROM group_players WHERE group_id = $1 AND player_id = $2`, [groupId, targetUserId]);
    res.statusCode = 204;
    res.end('');
    return;
  }
}
