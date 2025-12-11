import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { ready } from '../_db';

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
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ detail: 'Preencha todos os campos' }));
    return;
  }
  const sql = await ready();
  const hash = createHash('sha256').update(password).digest('hex');
  const rows = await sql(`SELECT id, email, name FROM users WHERE email = $1 AND password_hash = $2`, [email, hash]) as any[];
  if (!rows.length) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ detail: 'Credenciais inválidas' }));
    return;
  }
  const row = rows[0];
  const user = { id: String(row.id), name: String(row.name), email: String(row.email) };
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const access = jwt.sign({ sub: user.id, email: user.email, name: user.name }, secret, { expiresIn: '1h' });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ user, access, refresh: '' }));
}
