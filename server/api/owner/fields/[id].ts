import { ready } from '../../_db';
import jwt from 'jsonwebtoken';

export default async function (req: any, res: any) {
  const sql = await ready();

  // Auth Check
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

  // Parse ID from URL (manual parsing since we are in raw handler context mostly or wrapped)
  // Assuming route is /api/owner/fields/:id
  const urlParts = req.url.split('?')[0].split('/');
  const id = urlParts[urlParts.length - 1]; 

  if (!id) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing ID' }));
    return;
  }

  // Verify ownership
  const check = await sql(`SELECT owner_id FROM fields WHERE id = $1`, [id]) as any[];
  if (!check.length) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Field not found' }));
    return;
  }
  if (check[0].owner_id !== userId) {
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

    const { name, type, venueId, hourlyRate, coordinates, description, photos, isActive } = body;
    const photosJson = JSON.stringify(photos || []);

    await sql(`
      UPDATE fields SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        hourly_rate = COALESCE($3, hourly_rate),
        coordinates_lat = COALESCE($4, coordinates_lat),
        coordinates_lng = COALESCE($5, coordinates_lng),
        description = COALESCE($6, description),
        photos = COALESCE($7, photos),
        is_active = COALESCE($8, is_active),
        venue_id = COALESCE($9, venue_id)
      WHERE id = $10
    `, [
      name, type || null, hourlyRate,
      coordinates?.lat, coordinates?.lng, description, photosJson, 
      isActive === undefined ? null : (isActive ? 1 : 0),
      venueId || null, id
    ]);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.method === 'DELETE') {
    await sql(`DELETE FROM fields WHERE id = $1`, [id]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
