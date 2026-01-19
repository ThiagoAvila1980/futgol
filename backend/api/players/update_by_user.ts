import { ready } from '../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
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
  const userId = String(body.userId || '');
  const userData = body.userData || {};
  if (!userId) {
    res.statusCode = 400;
    res.end('Missing userId');
    return;
  }

  const name = userData.name != null ? String(userData.name) : undefined;
  const birthDate = userData.birthDate != null ? String(userData.birthDate) : undefined;
  const email = userData.email != null ? String(userData.email) : undefined;
  const favoriteTeam = userData.favoriteTeam != null ? String(userData.favoriteTeam) : undefined;
  const avatar = userData.avatar != null ? String(userData.avatar) : undefined;
  const phone = userData.phone != null ? String(userData.phone) : undefined;

  // We primarily update the Users table (Global Profile)
  await sql(
    `UPDATE players 
       SET 
         name = COALESCE($2, name),
         birth_date = COALESCE($3, birth_date),
         favorite_team = COALESCE($4, favorite_team),
         avatar = COALESCE($5, avatar),
         email = COALESCE($6, email),
         phone = COALESCE($7, phone)
       WHERE id = $1`,
    [userId, name, birthDate, favoriteTeam, avatar, email, phone]
  );

  // Note: Position and Nickname are now group-specific. 
  // We do not update them globally here. 
  // If the frontend sends them, they are ignored for the global profile.
  // This is by design based on the refactor.

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}
