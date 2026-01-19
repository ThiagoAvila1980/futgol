import { ready } from '../_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const rows = await sql(`
    SELECT g.*, 
           (SELECT json_agg(player_id) FROM group_requests WHERE group_id = g.id AND status = 'pending') as dynamic_requests 
    FROM groups g
  `) as any[];
  const data = rows.map((g: any) => ({
    id: String(g.id),
    adminId: g.admin_id,
    admins: g.admins ? JSON.parse(g.admins) : [],
    name: g.name,
    sport: g.sport,
    inviteCode: g.invite_code,
    createdAt: g.created_at,
    members: g.members ? JSON.parse(g.members) : [],
    pendingRequests: (g.dynamic_requests || []).map(String),
    paymentMode: g.payment_mode,
    fixedAmount: g.fixed_amount ?? 0,
    monthlyFee: g.monthly_fee ?? 0,
    city: g.city,
    logo: g.logo || undefined
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
