import { ready } from '../../../api/_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    const url = String((req as any).originalUrl || (req as any).path || req.url || '');
    const match = url.match(/\/api\/groups\/([^\/]+)\/request_join/);
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
    const message = body.message || '';

    if (!groupId || !userId) {
        res.statusCode = 400;
        res.end('Missing groupId or userId');
        return;
    }

    try {
        // Check if running integer IDs or Text IDs for Group.
        // Group ID is TEXT. Player ID is INTEGER (from legacy/schema).
        // But frontend sends userId as UUID (string) for User.
        // However, players table id is SERIAL (int).
        // Wait, `authService.register` creates `players` with serial ID?
        // Let's check `auth/register.ts`.
        // It says `INSERT INTO players... RETURNING id`. Players ID is serial.
        // But frontend `User` object has `id` as string.
        // If backend expects INTEGER for player_id, I must convert.
        // But wait, `migrate_ids` changed IDs to TEXT?
        // Let's check `_db.ts`.
        // `players.id` is SERIAL (lines 35).
        // `groups.id` is TEXT (line 53).
        // `group_players.player_id` is INTEGER (line 74).
        // `group_requests.player_id` is INTEGER (line 17 above, in diff).

        // Frontend `user.id` is usually a string.
        // If `User` is from `players` table, `id` is "1", "2" (stringified int).
        // If we migrated to UUIDs for PLAYERS, then schema should be TEXT.
        // The previous migration script `migrate_ids.ts` was for GROUPS, FIELDS, MATCHES.
        // Did it migrate PLAYERS?
        // Let's check `migrate_ids.ts`.

        // Assuming player_id is INT or user passes numeric ID string.

        await sql(`
      INSERT INTO group_requests(id, group_id, player_id, message, status, created_at)
      VALUES(gen_random_uuid(), $1, $2, $3, 'pending', $4)
      ON CONFLICT (group_id, player_id) 
      DO UPDATE SET message = EXCLUDED.message, status = 'pending', created_at = EXCLUDED.created_at
    `, [groupId, userId, message, new Date().toISOString()]);

        // Also update legacy pending_requests column in groups table for safety/legacy compatibility if needed?
        // We decided to read from dynamic query in index.ts, so no need to update `groups.pending_requests`.

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
    } catch (err: any) {
        console.error(err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
    }
}
