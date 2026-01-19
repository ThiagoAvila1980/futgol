import { ready } from '../_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    const userId = req.query?.userId || '';
    if (!userId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ detail: 'userId is required' }));
        return;
    }

    // Busca grupos onde o usuário é o adminId, está na lista legacy de members (JSON) ou na tabela group_players
    console.log(`[by_user] Fetching for userId: ${userId}`);

    const rows = await sql(`
    SELECT g.*,
           (SELECT json_agg(player_id) FROM group_requests WHERE group_id = g.id AND status = 'pending') as dynamic_requests
    FROM groups g
    WHERE g.admin_id = $1 
    OR g.members LIKE $2
    OR EXISTS (SELECT 1 FROM group_players gp WHERE gp.group_id = g.id AND gp.player_id = $1)
  `, [userId, `%\"${userId}\"%`]);

    console.log(`[by_user] Found ${rows.length} groups.`);

    const data = rows.map((g: any) => {
        const membersList = g.members ? JSON.parse(g.members) : [];
        // Ensure current user is in members list for frontend compatibility
        if (!membersList.includes(userId)) {
            membersList.push(userId);
        }

        return {
            id: String(g.id),
            adminId: g.admin_id,
            admins: g.admins ? JSON.parse(g.admins) : [],
            name: g.name,
            sport: g.sport,
            inviteCode: g.invite_code,
            createdAt: g.created_at,
            members: membersList,
            pendingRequests: (g.dynamic_requests || []).map(String),
            paymentMode: g.payment_mode,
            fixedAmount: g.fixed_amount ?? 0,
            monthlyFee: g.monthly_fee ?? 0,
            city: g.city,
            logo: g.logo || undefined
        };
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
}
