import { ready } from '../_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const rows = await sql(`SELECT * FROM groups`) as any[];
  const data = rows.map((g: any) => ({
    id: String(g.id),
    adminId: g.admin_id,
    admins: g.admins ? JSON.parse(g.admins) : [],
    name: g.name,
    sport: g.sport,
    inviteCode: g.invite_code,
    createdAt: g.created_at,
    members: g.members ? JSON.parse(g.members) : [],
    pendingRequests: g.pending_requests ? JSON.parse(g.pending_requests) : [],
    paymentMode: g.payment_mode,
    fixedAmount: g.fixed_amount ?? 0,
    monthlyFee: g.monthly_fee ?? 0,
    city: g.city
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
