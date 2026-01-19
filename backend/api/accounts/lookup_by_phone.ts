import { ready } from '../_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }
    const phoneRaw = req.query?.phone;
    if (!phoneRaw) {
        res.statusCode = 400;
        res.end(JSON.stringify({ detail: 'Phone required' }));
        return;
    }
    const phone = String(phoneRaw).replace(/\D/g, '');

    // Check if profile exists in players table - using REGEXP_REPLACE to find digits only
    const profiles = await sql(`SELECT * FROM players WHERE REGEXP_REPLACE(phone, '\\D', '', 'g') = $1`, [phone]) as any[];
    const profile = profiles[0];

    if (!profile) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ found: false }));
        return;
    }

    // Find associated groups (using ID as string match in JSON array or whatever the logic was)
    // Legacy logic used `members LIKE %"user_id"%`. 
    // Now members column in groups might still use user_id.
    const userId = String(profile.id);

    const rows = await sql(`
    SELECT g.id, g.name 
    FROM groups g
    WHERE g.members LIKE $1
  `, [`%\"${userId}\"%`]) as any[];

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        found: true,
        source: 'profile',
        profile: {
            name: profile.name,
            nickname: profile.nickname || profile.name.split(' ')[0],
            birthDate: profile.birth_date,
            email: profile.email,
            favoriteTeam: profile.favorite_team,
            position: profile.position,
            userId: userId, // Critical for linking
            usuario: !!profile.usuario
        },
        groups: rows
    }));
}
