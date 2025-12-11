import { ready } from '../../api/_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  let id = req.query?.id || (req.url.split('/').pop() as string);
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
      admin_id: String(body.adminId || ''),
      admins: JSON.stringify(body.admins || []),
      name: String(body.name || ''),
      sport: String(body.sport || ''),
      invite_code: String(body.inviteCode || ''),
      created_at: String(body.createdAt || new Date().toISOString()),
      members: JSON.stringify(body.members || []),
      pending_requests: JSON.stringify(body.pendingRequests || []),
      payment_mode: String(body.paymentMode || ''),
      fixed_amount: body.fixedAmount ?? 0,
      monthly_fee: body.monthlyFee ?? 0,
      city: String(body.city || '')
    };
    if (payload.id == null) {
      const rows = await sql(`INSERT INTO groups(admin_id, admins, name, sport, invite_code, created_at, members, pending_requests, payment_mode, fixed_amount, monthly_fee, city)
                              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [payload.admin_id, payload.admins, payload.name, payload.sport, payload.invite_code, payload.created_at, payload.members, payload.pending_requests, payload.payment_mode, payload.fixed_amount, payload.monthly_fee, payload.city]
      ) as any[];
      const newId = rows[0]?.id;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...payload, id: String(newId) }));
    } else {
      await sql(`INSERT INTO groups(id, admin_id, admins, name, sport, invite_code, created_at, members, pending_requests, payment_mode, fixed_amount, monthly_fee, city)
                 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                 ON CONFLICT (id) DO UPDATE SET admin_id=EXCLUDED.admin_id, admins=EXCLUDED.admins, name=EXCLUDED.name, sport=EXCLUDED.sport, invite_code=EXCLUDED.invite_code, created_at=EXCLUDED.created_at, members=EXCLUDED.members, pending_requests=EXCLUDED.pending_requests, payment_mode=EXCLUDED.payment_mode, fixed_amount=EXCLUDED.fixed_amount, monthly_fee=EXCLUDED.monthly_fee, city=EXCLUDED.city`,
        [payload.id, payload.admin_id, payload.admins, payload.name, payload.sport, payload.invite_code, payload.created_at, payload.members, payload.pending_requests, payload.payment_mode, payload.fixed_amount, payload.monthly_fee, payload.city]
      );
      res.statusCode = 204;
      res.end('');
    }
    return;
  }
  res.statusCode = 405;
  res.end('Method Not Allowed');
}
