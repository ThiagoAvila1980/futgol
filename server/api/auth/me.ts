import { ready } from '../_db';
import type { AuthRequest } from '../middleware/auth';

export default async function (req: AuthRequest, res: any) {
  const userId = req.user?.id;
  if (!userId) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ detail: 'Unauthorized' }));
  }

  try {
    const sql = await ready();
    const rows = (await sql(
      `SELECT id, name, email, phone, avatar, birth_date, favorite_team, primary_group_id, usuario, role FROM players WHERE id = $1`,
      [userId],
    )) as any[];

    if (!rows.length) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ detail: 'User not found' }));
    }

    const row = rows[0];
    const user = {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      phone: row.phone || null,
      avatar: row.avatar || null,
      birthDate: row.birth_date || null,
      favoriteTeam: row.favorite_team || null,
      primaryGroupId: row.primary_group_id || undefined,
      usuario: !!row.usuario,
      role: row.role || 'user',
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(user));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ detail: 'Internal error' }));
  }
}
