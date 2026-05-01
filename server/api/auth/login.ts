import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { ready } from '../_db';
import { getJwtSecret } from '../jwtSecret';
import { setAuthCookie } from './cookie';

export default async function (req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  let body: any = (req as any).body;
  if (!body || Object.keys(body).length === 0) {
    const chunks: any[] = [];
    for await (const chunk of req) chunks.push(chunk);
    try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
  }
  const email = String(body.email || '');
  const password = String(body.password || '');
  if (!email || !password) {
    return res.status(400).json({ detail: 'Preencha todos os campos' });
  }
  const sql = await ready();
  const rows = await sql(
    `SELECT id, email, name, phone, avatar, birth_date, favorite_team, primary_group_id, usuario, role, password_hash FROM players WHERE email = $1`,
    [email]
  ) as any[];
  if (!rows.length) {
    return res.status(400).json({ detail: 'Credenciais inválidas' });
  }
  const row = rows[0];
  const storedHash = row.password_hash;

  let passwordValid = false;
  if (storedHash.startsWith('$2')) {
    passwordValid = await bcrypt.compare(password, storedHash);
  } else {
    const sha256 = createHash('sha256').update(password).digest('hex');
    passwordValid = sha256 === storedHash;
    if (passwordValid) {
      const bcryptHash = await bcrypt.hash(password, 12);
      await sql(`UPDATE players SET password_hash = $1 WHERE id = $2`, [bcryptHash, row.id]);
    }
  }

  if (!passwordValid) {
    return res.status(400).json({ detail: 'Credenciais inválidas' });
  }

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
    role: row.role || 'user'
  };
  const secret = getJwtSecret();
  const access = jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role }, secret, {
    expiresIn: '7d',
  });
  setAuthCookie(res, access);
  res.status(200).json({ user, refresh: '' });
}
