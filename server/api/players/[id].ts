import { ready } from '../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  const url = String((req as any).originalUrl || (req as any).path || req.url || '');
  const match = url.match(/\/api\/players\/([^\/\?]+)/);
  const targetUserId = (req as any).params?.id || (match ? match[1] : (req.query?.id as string | undefined));

  if (req.method === 'PUT') {
    try {
      let body: any = (req as any).body;
      if (!body || Object.keys(body).length === 0) {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
      }

      if (!targetUserId) {
        res.statusCode = 400; res.end('Missing ID'); return;
      }

      const groupId = body.groupId;

      // 1. Update Core User Profile
      // We only update fields that are provided
      await sql(`UPDATE players SET 
        name = COALESCE($1, name),
        birth_date = COALESCE($2, birth_date),
        phone = COALESCE($3, phone),
        favorite_team = COALESCE($4, favorite_team),
        avatar = COALESCE($5, avatar)
        WHERE id = $6`,
        [
          body.name || null,
          body.birthDate || null,
          body.phone || null,
          body.favoriteTeam || null,
          body.avatar || null,
          targetUserId
        ]
      );
      // Wait, Users table schema in _db.ts: name, phone, birth_date, avatar, favorite_team. No nickname. Nickname is in group_players. 
      // So global nickname is ignored or we assume Name is enough. 

      // 2. Update Group Specific Stats (if groupId provided)
      if (groupId) {
        await sql(`UPDATE group_players SET
            nickname = COALESCE($1, nickname),
            position = COALESCE($2, position),
            rating = COALESCE($3, rating),
            matches_played = COALESCE($4, matches_played),
            is_monthly_subscriber = COALESCE($5, is_monthly_subscriber),
            monthly_start_month = COALESCE($6, monthly_start_month),
            is_guest = COALESCE($7, is_guest)
            WHERE group_id = $8 AND player_id = $9`,
          [
            body.nickname || null,
            body.position || null,
            body.rating !== undefined ? Number(body.rating) : null,
            body.matchesPlayed !== undefined ? Number(body.matchesPlayed) : null,
            body.isMonthlySubscriber !== undefined ? (body.isMonthlySubscriber ? 1 : 0) : null,
            body.monthlyStartMonth || null,
            body.isGuest !== undefined ? (body.isGuest ? 1 : 0) : null,
            groupId,
            targetUserId
          ]
        );
      } else {
        // If no groupId provided, maybe we want to update ALL group_players records for this user?
        // Or just return.
        // Usually player edit is within a group context.
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, id: String(targetUserId) }));

    } catch (err: any) {
      console.error(err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String(err?.message || 'Internal Error') }));
    }
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
