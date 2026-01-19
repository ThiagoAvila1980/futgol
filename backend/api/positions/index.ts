import { ready } from '../_db';

export default async function (req: any, res: any) {
    const sql = await ready();
    if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }
    const rows = await sql(`SELECT name FROM position_functions ORDER BY name ASC`) as any[];
    const data = rows.map((r: any) => r.name);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
}
