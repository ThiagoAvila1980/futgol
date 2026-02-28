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
    // Optionally check if role is 'field_owner'
  } catch {
    res.statusCode = 401;
    res.end(JSON.stringify({ detail: 'Invalid Token' }));
    return;
  }

  if (req.method === 'GET') {
    // List fields owned by user (optional filter by venueId)
    const venueId = (req.query?.venueId || '').toString();
    const rows = await sql(
      venueId
        ? `SELECT * FROM fields WHERE owner_id = $1 AND venue_id = $2 ORDER BY name ASC`
        : `SELECT * FROM fields WHERE owner_id = $1 ORDER BY name ASC`,
      venueId ? [userId, venueId] : [userId]
    ) as any[];
    const data = rows.map((r: any) => ({
      id: r.id,
      ownerId: r.owner_id,
      venueId: r.venue_id,
      type: r.type,
      name: r.name,
      location: r.location,
      contactName: r.contact_name,
      contactPhone: r.contact_phone,
      hourlyRate: Number(r.hourly_rate || 0),
      coordinates: { lat: r.coordinates_lat, lng: r.coordinates_lng },
      description: r.description,
      photos: r.photos ? JSON.parse(r.photos) : [],
      city: r.city,
      isActive: !!r.is_active
    }));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === 'POST') {
    // Create new field
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }

    const { name, type, venueId, hourlyRate, coordinates, description, photos } = body;
    if (!name) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Name is required' }));
      return;
    }

    const photosJson = JSON.stringify(photos || []);
    
    // Create field linked to owner_id
    // Note: group_id is optional now. If the owner has a primary group, maybe link it? 
    // For now, leave group_id null if purely owner managed.
    
    const result = await sql(`
      INSERT INTO fields (
        owner_id, venue_id, type, name, hourly_rate, coordinates_lat, coordinates_lng, 
        description, photos, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
      RETURNING id
    `, [
      userId, venueId || null, type || null, name,
      hourlyRate || 0, coordinates?.lat || null, coordinates?.lng || null,
      description || '', photosJson
    ]) as any[];

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: result[0].id }));
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
