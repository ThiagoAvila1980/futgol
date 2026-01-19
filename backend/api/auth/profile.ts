import jwt from 'jsonwebtoken';
import { ready } from '../_db';

export default async function (req: any, res: any) {
    if (req.method !== 'PUT') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
    }

    const auth = String(req.headers['authorization'] || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
        res.statusCode = 401;
        res.end(JSON.stringify({ detail: 'Unauthorized' }));
        return;
    }

    try {
        const secret = process.env.JWT_SECRET || 'dev-secret';
        const payload: any = jwt.verify(token, secret);
        const userId = String(payload.sub || '');

        let body: any = (req as any).body;
        if (!body || Object.keys(body).length === 0) {
            const chunks: any[] = [];
            for await (const chunk of req) chunks.push(chunk);
            try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
        }

        const { name, email, phone, avatar, birthDate, favoriteTeam, primaryGroupId } = body;
        const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
        const sql = await ready();

        // Verificação simples: apenas o próprio usuário pode atualizar seu perfil
        if (String(body.id) !== userId) {
            res.statusCode = 403;
            res.end(JSON.stringify({ detail: 'Forbidden' }));
            return;
        }

        await sql(`
      UPDATE players 
      SET name = $1, email = $2, phone = $3, avatar = $4, birth_date = $5, favorite_team = $6, primary_group_id = $7 
      WHERE id = $8
    `, [name, email, cleanPhone, avatar || null, birthDate || null, favoriteTeam || null, primaryGroupId || null, userId]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        console.error(error);
        res.statusCode = 401;
        res.end(JSON.stringify({ detail: 'Unauthorized or Internal Error' }));
    }
}
