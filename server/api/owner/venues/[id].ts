import { ready } from '../../_db';
import jwt from 'jsonwebtoken';

export default async function (req: any, res: any) {
  const sql = await ready();

  const auth = String(req.headers['authorization'] || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    res.statusCode = 401;
    res.end(JSON.stringify({ detail: 'Unauthorized' }));
    return;
  }

  let userId = '';
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload: any = jwt.verify(token, secret);
    userId = String(payload.sub || '');
  } catch {
    res.statusCode = 401;
    res.end(JSON.stringify({ detail: 'Invalid Token' }));
    return;
  }

  // Parse :id
  const urlParts = req.url.split('?')[0].split('/');
  const id = urlParts[urlParts.length - 1];
  if (!id) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing ID' }));
    return;
  }

  // Ownership check
  const rows = await sql(`SELECT owner_id FROM venues WHERE id = $1`, [id]) as any[];
  if (!rows.length) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Venue not found' }));
    return;
  }
  if (rows[0].owner_id !== userId) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  if (req.method === 'PUT') {
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const { name, address, city, contactName, contactPhone, coordinates, description, photos, isActive } = body;
    const photosJson = JSON.stringify(photos || []);
    await sql(`
      UPDATE venues SET
        name = COALESCE($1, name),
        address = COALESCE($2, address),
        city = COALESCE($3, city),
        contact_name = COALESCE($4, contact_name),
        contact_phone = COALESCE($5, contact_phone),
        coordinates_lat = COALESCE($6, coordinates_lat),
        coordinates_lng = COALESCE($7, coordinates_lng),
        description = COALESCE($8, description),
        photos = COALESCE($9, photos),
        is_active = COALESCE($10, is_active)
      WHERE id = $11
    `, [
      name, address, city, contactName, contactPhone,
      coordinates?.lat, coordinates?.lng, description, photosJson,
      isActive === undefined ? null : (isActive ? 1 : 0),
      id
    ]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.method === 'DELETE') {
    await sql(`DELETE FROM venues WHERE id = $1`, [id]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
