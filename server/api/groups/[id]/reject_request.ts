import { ready } from '../../../api/_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    const url = String((req as any).originalUrl || (req as any).path || req.url || '');
    const match = url.match(/\/api\/groups\/([^\/]+)\/reject_request/);
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
        await sql(`UPDATE group_requests SET status = 'rejected' WHERE group_id = $1 AND player_id = $2`, [groupId, userId]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
    } catch (err: any) {
        console.error('Error in reject_request:', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(err.message) }));
    }
}
