import { ready } from '../_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const groupId = url.searchParams.get('groupId') || '';
  const rows = await sql(`SELECT * FROM fields WHERE group_id = $1`, [groupId]) as any[];
  const data = rows.map((f: any) => ({
    id: f.id,
    groupId: f.group_id,
    name: f.name,
    location: f.location,
    contactName: f.contact_name || undefined,
    contactPhone: f.contact_phone || undefined,
    hourlyRate: Number(f.hourly_rate || 0),
    coordinates: (f.coordinates_lat != null && f.coordinates_lng != null) ? { lat: Number(f.coordinates_lat), lng: Number(f.coordinates_lng) } : undefined
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
