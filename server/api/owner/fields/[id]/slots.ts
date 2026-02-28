import { ready } from '../../../_db';
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

  // Extract Field ID from URL
  // Expected URL: /api/owner/fields/:id/slots
  const urlParts = req.url.split('?')[0].split('/');
  const fieldId = urlParts[urlParts.indexOf('fields') + 1];

  if (!fieldId) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing Field ID' }));
    return;
  }

  // Verify ownership
  const check = await sql(`SELECT owner_id, hourly_rate FROM fields WHERE id = $1`, [fieldId]) as any[];
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
  const defaultPrice = check[0].hourly_rate || 0;

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (!start || !end) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Start and End dates are required' }));
      return;
    }

    const slots = await sql(`
      SELECT * FROM field_slots 
      WHERE field_id = $1 
      AND start_time >= $2 
      AND start_time <= $3
      ORDER BY start_time ASC
    `, [fieldId, start, end]) as any[];

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(slots.map((s: any) => ({
      id: s.id,
      fieldId: s.field_id,
      startTime: s.start_time,
      endTime: s.end_time,
      price: s.price,
      isBooked: !!s.is_booked,
      bookedByGroupId: s.booked_by_group_id
    }))));
    return;
  }

  if (req.method === 'POST') {
    // Generate slots
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }

    // Expecting array of slots or generation rules
    // For simplicity: Array of { start: string, end: string, price?: number }
    const { slots } = body; // Array<{ start: string, end: string, price?: number }>
    
    if (!Array.isArray(slots)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid slots array' }));
      return;
    }

    let createdCount = 0;
    for (const s of slots) {
      if (!s.start || !s.end) continue;
      await sql(`
        INSERT INTO field_slots (field_id, start_time, end_time, price, is_booked)
        VALUES ($1, $2, $3, $4, 0)
      `, [fieldId, s.start, s.end, s.price ?? defaultPrice]);
      createdCount++;
    }

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ created: createdCount }));
    return;
  }

  if (req.method === 'DELETE') {
    // Delete slots in range
    const url = new URL(req.url, `http://${req.headers.host}`);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (!start || !end) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Start and End dates are required' }));
      return;
    }

    // Only delete unbooked slots to avoid issues
    await sql(`
      DELETE FROM field_slots 
      WHERE field_id = $1 
      AND start_time >= $2 
      AND start_time <= $3
      AND is_booked = 0
    `, [fieldId, start, end]);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
