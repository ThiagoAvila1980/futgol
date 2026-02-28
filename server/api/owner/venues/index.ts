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

  if (req.method === 'GET') {
    const rows = await sql(`SELECT * FROM venues WHERE owner_id = $1 ORDER BY name ASC`, [userId]) as any[];
    const data = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      contactName: r.contact_name,
      contactPhone: r.contact_phone,
      coordinates: { lat: r.coordinates_lat, lng: r.coordinates_lng },
      description: r.description,
      photos: r.photos ? JSON.parse(r.photos) : [],
      isActive: !!r.is_active
    }));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === 'POST') {
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const { name, address, city, contactName, contactPhone, coordinates, description, photos } = body;
    if (!name) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Name is required' }));
      return;
    }

    const photosJson = JSON.stringify(photos || []);
    const now = new Date().toISOString();

    const rows = await sql(`
      INSERT INTO venues(
        owner_id, name, address, city, contact_name, contact_phone,
        coordinates_lat, coordinates_lng, description, photos, is_active, created_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11)
      RETURNING id
    `, [
      userId, name, address || '', city || '', contactName || '', contactPhone || '',
      coordinates?.lat || null, coordinates?.lng || null, description || '', photosJson, now
    ]) as any[];

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: rows[0].id }));
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
