import { ready } from '../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  const id = req.query?.id || (req.url.split('/').pop() as string);
  if (req.method === 'PUT') {
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const idFromBody = body.id;
    const idFromPath = id;
    const numericId = idFromBody != null ? Number(idFromBody) : (idFromPath && /^\d+$/.test(String(idFromPath)) ? Number(idFromPath) : undefined);
    const payload = {
      id: Number.isFinite(numericId as number) ? (numericId as number) : undefined,
      group_id: String(body.groupId || ''),
      name: String(body.name || ''),
      location: String(body.location || ''),
      contact_name: body.contactName ? String(body.contactName) : null,
      contact_phone: body.contactPhone ? String(body.contactPhone) : null,
      hourly_rate: Number(body.hourlyRate ?? 0),
      coordinates_lat: body.coordinates?.lat != null ? Number(body.coordinates.lat) : null,
      coordinates_lng: body.coordinates?.lng != null ? Number(body.coordinates.lng) : null
    };
    if (payload.id == null) {
      const rows = await sql(`INSERT INTO fields(group_id, name, location, contact_name, contact_phone, hourly_rate, coordinates_lat, coordinates_lng)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [payload.group_id, payload.name, payload.location, payload.contact_name, payload.contact_phone, payload.hourly_rate, payload.coordinates_lat, payload.coordinates_lng]
      ) as any[];
      const newId = rows[0]?.id;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...payload, id: String(newId) }));
    } else {
      await sql(`INSERT INTO fields(id, group_id, name, location, contact_name, contact_phone, hourly_rate, coordinates_lat, coordinates_lng)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
               ON CONFLICT (id) DO UPDATE SET group_id=EXCLUDED.group_id, name=EXCLUDED.name, location=EXCLUDED.location, contact_name=EXCLUDED.contact_name, contact_phone=EXCLUDED.contact_phone, hourly_rate=EXCLUDED.hourly_rate, coordinates_lat=EXCLUDED.coordinates_lat, coordinates_lng=EXCLUDED.coordinates_lng`,
        [payload.id, payload.group_id, payload.name, payload.location, payload.contact_name, payload.contact_phone, payload.hourly_rate, payload.coordinates_lat, payload.coordinates_lng]
      );
      res.statusCode = 204;
      res.end('');
    }
    return;
  }
  if (req.method === 'DELETE') {
    await sql(`DELETE FROM fields WHERE id = $1`, [id]);
    res.statusCode = 204;
    res.end('');
    return;
  }
  res.statusCode = 405;
  res.end('Method Not Allowed');
}
