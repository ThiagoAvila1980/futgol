import { ready } from '../_db';
import type { AuthRequest } from '../middleware/auth';

export default async function (req: AuthRequest, res: any) {
  if (req.method !== 'PUT') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ detail: 'Unauthorized' }));
  }

  try {
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try {
        body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      } catch {
        body = {};
      }
    }

    const { name, email, phone, avatar, birthDate, favoriteTeam, primaryGroupId } = body;
    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
    const sql = await ready();

    if (String(body.id) !== userId) {
      res.statusCode = 403;
      res.end(JSON.stringify({ detail: 'Forbidden' }));
      return;
    }

    await sql(
      `
      UPDATE players 
      SET name = $1, email = $2, phone = $3, avatar = $4, birth_date = $5, favorite_team = $6, primary_group_id = $7 
      WHERE id = $8
    `,
      [
        name,
        email,
        cleanPhone,
        avatar || null,
        birthDate || null,
        favoriteTeam || null,
        primaryGroupId || null,
        userId,
      ],
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error(error);
    res.statusCode = 401;
    res.end(JSON.stringify({ detail: 'Unauthorized or Internal Error' }));
  }
}
