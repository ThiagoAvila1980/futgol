import { ready } from '../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  const url = String((req as any).originalUrl || (req as any).path || req.url || '');
  const match = url.match(/\/api\/players\/(\d+)/);
  const idRaw = (req as any).params?.id || (match ? match[1] : (req.query?.id as string | undefined));
  if (req.method === 'PUT') {
    try {
      let body: any = (req as any).body;
      if (!body || Object.keys(body).length === 0) {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
      }
      let profileIdNum: number | undefined = /^\d+$/.test(String(body.profileId || '')) ? Number(body.profileId) : undefined;
      const phone = body.phone ? String(body.phone) : '';
      const email = body.email ? String(body.email) : '';
      if (!profileIdNum) {
        let prRows: any[] = [];
        if (email) prRows = await sql(`SELECT id FROM player_profiles WHERE email = $1`, [email]) as any[];
        if (!prRows.length && phone) prRows = await sql(`SELECT id FROM player_profiles WHERE phone = $1`, [phone]) as any[];
        if (prRows.length) {
          profileIdNum = Number(prRows[0].id);
        } else {
          const rows = await sql(`INSERT INTO player_profiles(user_id, name, nickname, birth_date, email, phone, favorite_team, position, avatar, created_at)
                   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                   ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, nickname=EXCLUDED.nickname, birth_date=EXCLUDED.birth_date, phone=EXCLUDED.phone, favorite_team=EXCLUDED.favorite_team, position=EXCLUDED.position, avatar=EXCLUDED.avatar
                   RETURNING id`,
                   [body.userId || null, String(body.name || ''), String(body.nickname || ''), String(body.birthDate || ''), email || null, phone || null, String(body.favoriteTeam || ''), String(body.position || ''), body.avatar ? String(body.avatar) : null, new Date().toISOString()]) as any[];
          profileIdNum = Number(rows[0].id);
        }
      } else {
        await sql(`UPDATE player_profiles SET user_id=$2, name=$3, nickname=$4, birth_date=$5, email=$6, phone=$7, favorite_team=$8, position=$9, avatar=$10 WHERE id=$1`,
          [profileIdNum, body.userId || null, String(body.name || ''), String(body.nickname || ''), String(body.birthDate || ''), email || null, phone || null, String(body.favoriteTeam || ''), String(body.position || ''), body.avatar ? String(body.avatar) : null]
        );
      }
      const payload = {
        id: /^\d+$/.test(String(body.id || idRaw || '')) ? Number(body.id || idRaw) : undefined,
        group_id: String(body.groupId || ''),
        user_id: body.userId ? String(body.userId) : null,
        profile_id: profileIdNum || null,
        name: String(body.name || ''),
        nickname: String(body.nickname || ''),
        birth_date: String(body.birthDate || ''),
        email: String(body.email || ''),
        phone: body.phone ? String(body.phone) : null,
        favorite_team: String(body.favoriteTeam || ''),
        position: String(body.position || ''),
        rating: Number(body.rating ?? 0),
        matches_played: Number(body.matchesPlayed ?? 0),
        avatar: body.avatar ? String(body.avatar) : null,
        is_monthly_subscriber: body.isMonthlySubscriber ? 1 : 0,
        monthly_start_month: body.monthlyStartMonth ? String(body.monthlyStartMonth) : null,
        is_guest: body.isGuest ? 1 : 0
      };
      if (payload.id == null) {
        const rows = await sql(`INSERT INTO players(group_id, user_id, profile_id, name, nickname, birth_date, email, phone, favorite_team, position, rating, matches_played, avatar, is_monthly_subscriber, monthly_start_month, is_guest)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
               RETURNING id`,
          [payload.group_id, payload.user_id, payload.profile_id, payload.name, payload.nickname, payload.birth_date, payload.email, payload.phone, payload.favorite_team, payload.position, payload.rating, payload.matches_played, payload.avatar, payload.is_monthly_subscriber, payload.monthly_start_month, payload.is_guest]
        ) as any[];
        const newId = rows[0]?.id;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ...payload, id: String(newId) }));
      } else {
        await sql(`INSERT INTO players(id, group_id, user_id, profile_id, name, nickname, birth_date, email, phone, favorite_team, position, rating, matches_played, avatar, is_monthly_subscriber, monthly_start_month, is_guest)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
               ON CONFLICT (id) DO UPDATE SET group_id=EXCLUDED.group_id, user_id=EXCLUDED.user_id, profile_id=EXCLUDED.profile_id, name=EXCLUDED.name, nickname=EXCLUDED.nickname, birth_date=EXCLUDED.birth_date, email=EXCLUDED.email, phone=EXCLUDED.phone, favorite_team=EXCLUDED.favorite_team, position=EXCLUDED.position, rating=EXCLUDED.rating, matches_played=EXCLUDED.matches_played, avatar=EXCLUDED.avatar, is_monthly_subscriber=EXCLUDED.is_monthly_subscriber, monthly_start_month=EXCLUDED.monthly_start_month, is_guest=EXCLUDED.is_guest`,
          [payload.id, payload.group_id, payload.user_id, payload.profile_id, payload.name, payload.nickname, payload.birth_date, payload.email, payload.phone, payload.favorite_team, payload.position, payload.rating, payload.matches_played, payload.avatar, payload.is_monthly_subscriber, payload.monthly_start_month, payload.is_guest]
        );
        res.statusCode = 204;
        res.end('');
      }
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String(err?.message || 'Internal Error') }));
    }
    return;
  }
  res.statusCode = 405;
  res.end('Method Not Allowed');
}
