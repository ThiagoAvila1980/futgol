import jwt from 'jsonwebtoken';
import { ready } from '../_db';

export default async function (req: any, res: any) {
  const auth = String(req.headers['authorization'] || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    res.statusCode = 401;
    res.end(JSON.stringify({ detail: 'Unauthorized' }));
    return;
  }
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload: any = jwt.verify(token, secret);
    const userId = String(payload.sub || '');

    const sql = await ready();
    const rows = await sql(`SELECT id, name, email, phone, avatar, birth_date, favorite_team, primary_group_id, usuario FROM players WHERE id = $1`, [userId]) as any[];

    if (!rows.length) {
      res.statusCode = 404;
      res.end(JSON.stringify({ detail: 'User not found' }));
      return;
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
      usuario: !!row.usuario
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(user));
  } catch {
    res.statusCode = 401;
    res.end(JSON.stringify({ detail: 'Unauthorized' }));
  }
}
