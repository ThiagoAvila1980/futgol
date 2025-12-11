import jwt from 'jsonwebtoken';

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
    const user = { id: String(payload.sub || ''), name: String(payload.name || 'Usuário'), email: String(payload.email || '') };
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(user));
  } catch {
    res.statusCode = 401;
    res.end(JSON.stringify({ detail: 'Unauthorized' }));
  }
}
