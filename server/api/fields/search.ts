import { ready } from '../_db';

export default async function (req: any, res: any) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const sql = await ready();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const city = url.searchParams.get('city');
  
  let query = `SELECT * FROM fields WHERE is_active = 1`;
  const params: any[] = [];

  if (city) {
    query += ` AND city ILIKE $1`;
    params.push(`%${city}%`);
  }

  query += ` ORDER BY name ASC`;

  const rows = await sql(query, params) as any[];
  
  const data = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    hourlyRate: Number(r.hourly_rate || 0),
    coordinates: { lat: r.coordinates_lat, lng: r.coordinates_lng },
    description: r.description,
    photos: r.photos ? JSON.parse(r.photos) : [],
    city: r.city
  }));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
