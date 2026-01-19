import { ready } from '../_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }
    const id = req.query?.id;
    if (!id) {
        res.statusCode = 400;
        res.end(JSON.stringify({ detail: 'ID required' }));
        return;
    }

    // Find user and profile
    const rows = await sql(`
    SELECT u.id, u.name, u.email, u.phone, u.birth_date, u.favorite_team, u.avatar, u.usuario
    FROM players u
    WHERE cast(u.id as text) = $1
  `, [id]) as any[];

    if (rows.length === 0) {
        res.statusCode = 404;
        res.end(JSON.stringify({ detail: 'User not found' }));
        return;
    }

    const r = rows[0];
    const user = {
        id: String(r.id),
        name: r.name,
        email: r.email,
        nickname: r.nickname || r.name.split(' ')[0],
        birthDate: r.birth_date,
        phone: r.phone,
        favoriteTeam: r.favorite_team,
        position: r.position,
        avatar: r.avatar,
        usuario: !!r.usuario
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(user));
}
