import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const {
      fieldId,
      groupId,
      bookedBy,
      date: bodyDate,
      startTime: bodyStartTime,
      endTime: bodyEndTime,
      paymentMethod,
      slotId,
    } = req.body;

    if (!fieldId || !bookedBy) {
      return res.status(400).json({ error: 'Campos obrigatórios: fieldId e bookedBy' });
    }

    const sql = await ready();

    let date = bodyDate;
    let startTime = bodyStartTime;
    let endTime = bodyEndTime;

    // Quando um slot é informado, usamos os horários cadastrados no slot
    if (slotId) {
      const slots = await sql(
        `SELECT * FROM field_slots WHERE id = $1 AND field_id = $2`,
        [slotId, fieldId]
      );

      if (!slots.length) {
        return res.status(404).json({ error: 'Slot de horário não encontrado para este campo' });
      }

      const slot = slots[0];
      if (slot.is_booked) {
        return res.status(409).json({ error: 'Horário já reservado' });
      }

      // start_time e end_time são textos no formato ISO (ex.: 2026-03-17T18:00:00)
      const startIso: string = slot.start_time;
      const endIso: string = slot.end_time;
      date = startIso.slice(0, 10);
      startTime = startIso.slice(11, 16);
      endTime = endIso.slice(11, 16);
    }

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Campos obrigatórios: date, startTime, endTime' });
    }

    const conflicts = await sql(
      `SELECT id FROM field_bookings
       WHERE field_id = $1 AND date = $2 AND status != 'cancelled'
       AND (start_time < $4 AND end_time > $3)`,
      [fieldId, date, startTime, endTime]
    );

    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'Horário já reservado' });
    }

    const fields = await sql(`SELECT hourly_rate, owner_id, name FROM fields WHERE id = $1`, [fieldId]);
    const hourlyRate = fields.length ? fields[0].hourly_rate || 0 : 0;

    const startH = parseInt(startTime.split(':')[0]);
    const endH = parseInt(endTime.split(':')[0]);
    const hours = Math.max(1, endH - startH);
    const totalPrice = hourlyRate * hours;

    const now = new Date().toISOString();
    const id = (globalThis as any).crypto?.randomUUID?.() || (await import('node:crypto')).randomUUID();

    await sql(
      `INSERT INTO field_bookings(id, field_id, group_id, booked_by, date, start_time, end_time, total_price, status, payment_method, created_at)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, fieldId, groupId || null, bookedBy, date, startTime, endTime, totalPrice, 'confirmed', paymentMethod || 'pix', now]
    );

    if (slotId) {
      await sql(
        `UPDATE field_slots SET is_booked = 1 WHERE id = $1`,
        [slotId]
      );
    }

    // TODO: implementar canal de notificação real (push/WhatsApp/e-mail) para o dono do campo.
    // Aqui, garantimos ao menos o registro da reserva associada ao campo e ao owner.

    res.status(201).json({
      id,
      fieldId,
      date,
      startTime,
      endTime,
      totalPrice,
      status: 'confirmed',
    });
  } catch (error: any) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Erro ao criar reserva' });
  }
}
