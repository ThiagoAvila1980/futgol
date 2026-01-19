import { ready } from '../../../api/_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    const url = String((req as any).originalUrl || (req as any).path || req.url || '');
    const match = url.match(/\/api\/groups\/([^\/]+)\/demote_member/);
    const groupId = (req as any).params?.id || (match ? match[1] : undefined);

    if (req.method !== 'POST') {
        res.statusCode = 405; res.end('Method Not Allowed'); return;
    }

    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }

    const userId = body.userId;
    if (!groupId || !userId) {
        res.statusCode = 400; res.end('Missing groupId or userId'); return;
    }

    try {
        const groupRows = await sql(`SELECT admin_id, admins FROM groups WHERE id = $1`, [groupId]) as any[];
        if (groupRows.length === 0) { res.statusCode = 404; res.end('Group not found'); return; }

        // Cant demote the group owner (main admin)
        if (groupRows[0].admin_id === userId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Cannot demote group owner' }));
            return;
        }

        let admins: string[] = [];
        const adminsRaw = groupRows[0].admins;
        if (adminsRaw) {
            try {
                admins = Array.isArray(adminsRaw) ? adminsRaw : JSON.parse(adminsRaw);
            } catch {
                admins = [];
            }
        }

        if (admins.includes(userId)) {
            admins = admins.filter(id => id !== userId);
            await sql(`UPDATE groups SET admins = $1 WHERE id = $2`, [JSON.stringify(admins), groupId]);
        }

        // Also update role in group_players
        await sql(`UPDATE group_players SET role = 'member' WHERE group_id = $1 AND player_id = $2`, [groupId, userId]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
    } catch (err: any) {
        console.error('Error in demote_member:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err.message) }));
    }
}
