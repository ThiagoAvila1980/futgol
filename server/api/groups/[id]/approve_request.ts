import { ready } from '../../../api/_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    const url = String((req as any).originalUrl || (req as any).path || req.url || '');
    const match = url.match(/\/api\/groups\/([^\/]+)\/approve_request/);
    const groupId = (req as any).params?.id || (match ? match[1] : undefined);

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

    const userId = body.userId;

    if (!groupId || !userId) {
        res.statusCode = 400;
        res.end('Missing groupId or userId');
        return;
    }

    try {
        // 1. Update Request Status
        await sql(`UPDATE group_requests SET status = 'accepted' WHERE group_id = $1 AND player_id = $2`, [groupId, userId]);

        // 2. Add to Group Players
        await sql(`
            INSERT INTO group_players(group_id, player_id, role, joined_at)
            VALUES($1, $2, 'member', $3)
            ON CONFLICT (group_id, player_id) DO NOTHING
        `, [groupId, userId, new Date().toISOString()]);

        // 3. Update Legacy Group Members JSON (for backward compatibility if needed)
        // We fetching existing members JSON, parse, add, update.
        const groupRows = await sql(`SELECT members, pending_requests FROM groups WHERE id = $1`, [groupId]) as any[];
        if (groupRows.length > 0) {
            let members: string[] = [];
            try { members = JSON.parse(groupRows[0].members || '[]'); } catch { }

            if (!members.includes(String(userId))) {
                members.push(String(userId));
                await sql(`UPDATE groups SET members = $1 WHERE id = $2`, [JSON.stringify(members), groupId]);
            }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
    } catch (err: any) {
        console.error(err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
    }
}
