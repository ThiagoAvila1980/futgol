import { ready } from '../_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }
    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }

    const groupId = String(body.groupId || '');
    const playerId = String(body.playerId || '');
    const amount = Number(body.amount ?? 0);
    const dateStr = String(body.date || new Date().toISOString().split('T')[0]);

    // Normalize date to the 1st of the month
    const d = new Date(dateStr + 'T12:00:00Z');
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const normalizedDate = `${year}-${month}-01`;

    const id = `monthly_agg_${groupId}_${year}_${month}`;

    try {
        // 1. Get current transaction if exists
        const existing = await sql(`SELECT amount, paid_player_ids FROM transactions WHERE id = $1`, [id]) as any[];

        let newAmount = amount;
        let newPaidIds = playerId;

        if (existing && existing.length > 0) {
            const currentIds = (existing[0].paid_player_ids || '').split(',').filter(Boolean);
            if (!currentIds.includes(playerId)) {
                currentIds.push(playerId);
                newAmount = Number(existing[0].amount) + amount;
            } else {
                // Player already paid, just return success
                res.statusCode = 200;
                res.end(JSON.stringify({ ok: true, status: 'already_paid' }));
                return;
            }
            newPaidIds = currentIds.join(',');
        }

        const description = `Mensalidades`;

        await sql(`INSERT INTO transactions(id, group_id, description, amount, type, date, category, paid_player_ids)
               VALUES($1,$2,$3,$4,'INCOME',$5,'MONTHLY_FEE',$6)
               ON CONFLICT (id) DO UPDATE SET 
                  amount = EXCLUDED.amount,
                  paid_player_ids = EXCLUDED.paid_player_ids,
                  description = EXCLUDED.description`,
            [id, groupId, description, newAmount, normalizedDate, newPaidIds]
        );

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
    } catch (err: any) {
        console.error('Error in upsert_monthly transaction:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
    }
}
