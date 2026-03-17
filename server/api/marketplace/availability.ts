import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const { fieldId, date } = req.query;

    if (!fieldId || !date) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: fieldId e date' });
    }

    const sql = await ready();
    const params: any[] = [fieldId, date];

    // Slots disponíveis: não marcados como reservados e sem conflito com reservas já realizadas
    const slots = await sql(
      `
      SELECT fs.*
      FROM field_slots fs
      WHERE fs.field_id = $1
        AND fs.is_booked = 0
        AND SUBSTRING(fs.start_time, 1, 10) = $2
        AND NOT EXISTS (
          SELECT 1
          FROM field_bookings b
          WHERE b.field_id = fs.field_id
            AND b.date = $2
            AND b.status != 'cancelled'
            AND (b.start_time < fs.end_time AND b.end_time > fs.start_time)
        )
      ORDER BY fs.start_time
      `,
      params
    );

    const result = slots.map((s: any) => ({
      id: s.id,
      fieldId: s.field_id,
      startTime: s.start_time,
      endTime: s.end_time,
      price: s.price,
    }));

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Marketplace availability error:', error);
    res.status(500).json({ error: 'Erro ao buscar horários disponíveis' });
  }
}

