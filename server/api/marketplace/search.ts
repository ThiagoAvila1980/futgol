import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const {
      lat,
      lng,
      radius = 10,
      city,
      type,
      minPrice,
      maxPrice,
      name,
      date,
    } = req.query;
    const sql = await ready();
    const params: any[] = [];
    let query = `
      SELECT f.*, v.name as venue_name, v.address as venue_address, v.city as venue_city,
             COALESCE(r.avg_rating, 0) as avg_rating,
             COALESCE(r.review_count, 0) as review_count
      FROM fields f
      LEFT JOIN venues v ON v.id = f.venue_id
      LEFT JOIN (
        SELECT field_id, AVG(rating) as avg_rating, COUNT(*) as review_count
        FROM field_reviews GROUP BY field_id
      ) r ON r.field_id = f.id
      INNER JOIN players p ON p.id = f.owner_id AND p.role = 'field_owner'
      WHERE f.is_active = 1
    `;

    if (name) {
      params.push(`%${name}%`);
      query += ` AND f.name ILIKE $${params.length}`;
    }

    if (city) {
      params.push(`%${city}%`);
      query += ` AND (f.city ILIKE $${params.length} OR v.city ILIKE $${params.length})`;
    }

    if (type) {
      params.push(type);
      query += ` AND f.type = $${params.length}`;
    }

    if (minPrice) {
      params.push(Number(minPrice));
      query += ` AND f.hourly_rate >= $${params.length}`;
    }

    if (maxPrice) {
      params.push(Number(maxPrice));
      query += ` AND f.hourly_rate <= $${params.length}`;
    }

    if (date) {
      // Retorna apenas campos que possuem pelo menos um slot disponível na data informada
      params.push(date);
      const dateIdx = params.length;
      query += ` AND EXISTS (
        SELECT 1 FROM field_slots fs
        WHERE fs.field_id = f.id
          AND fs.is_booked = 0
          AND fs.start_time::date = $${dateIdx}
      )`;
    }

    if (lat && lng) {
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const radiusKm = Number(radius);
      params.push(latNum, lngNum, radiusKm);
      const latIdx = params.length - 2;
      const lngIdx = params.length - 1;
      const radIdx = params.length;
      query += ` AND f.coordinates_lat IS NOT NULL AND f.coordinates_lng IS NOT NULL
        AND (
          6371 * acos(
            cos(radians($${latIdx})) * cos(radians(f.coordinates_lat)) *
            cos(radians(f.coordinates_lng) - radians($${lngIdx})) +
            sin(radians($${latIdx})) * sin(radians(f.coordinates_lat))
          )
        ) <= $${radIdx}`;
    }

    query += ` ORDER BY avg_rating DESC, review_count DESC LIMIT 50`;

    const fields = await sql(query, params);
    const result = fields.map((f: any) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      location: f.location,
      city: f.city || f.venue_city,
      hourlyRate: f.hourly_rate,
      coordinates: f.coordinates_lat ? { lat: f.coordinates_lat, lng: f.coordinates_lng } : null,
      description: f.description,
      photos: f.photos ? JSON.parse(f.photos) : [],
      venueName: f.venue_name,
      venueAddress: f.venue_address,
      avgRating: Number(f.avg_rating).toFixed(1),
      reviewCount: Number(f.review_count),
      contactName: f.contact_name,
      contactPhone: f.contact_phone,
      isActive: !!f.is_active,
    }));

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Marketplace search error:', error);
    res.status(500).json({ error: 'Erro ao buscar quadras' });
  }
}
