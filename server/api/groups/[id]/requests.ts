import { ready } from '../../../api/_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    const url = String((req as any).originalUrl || (req as any).path || req.url || '');
    const match = url.match(/\/api\/groups\/([^\/]+)\/requests/);
    const groupId = (req as any).params?.id || (match ? match[1] : undefined);

    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    if (!groupId) {
        res.statusCode = 400;
        res.end('Missing groupId');
        return;
    }

    try {
        const rows = await sql(`
      SELECT 
        r.id as request_id,
        r.message,
        r.created_at as request_date,
        p.id as user_id,
        p.name,
        p.email,
        p.phone,
        p.avatar
      FROM group_requests r
      JOIN players p ON r.player_id = p.id
      WHERE r.group_id = $1 AND r.status = 'pending'
      ORDER BY r.created_at DESC
    `, [groupId]) as any[];

        const requests = rows.map((r: any) => ({
            requestId: String(r.request_id),
            message: r.message,
            createdAt: r.request_date,
            user: {
                id: String(r.user_id),
                name: r.name,
                email: r.email,
                phone: r.phone,
                avatar: r.avatar
            }
        }));

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(requests));
    } catch (err: any) {
        console.error(err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
    }
}
