import { ready } from '../_db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function (req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).end('Method Not Allowed');
    }

    let body: any = (req as any).body;
    if (!body || Object.keys(body).length === 0) {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }

    const { email, password, name, phone, nickname, birthDate, favoriteTeam, position, avatar, role } = body;

    if (!email || !password || !name) {
        return res.status(400).json({ detail: 'Missing fields' });
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
    const userRole = role === 'field_owner' ? 'field_owner' : 'user';
    const sql = await ready();

    const existingRecords = await sql(`
        SELECT id, email, phone, usuario 
        FROM players 
        WHERE email = $1 OR (phone IS NOT NULL AND REGEXP_REPLACE(phone, '\\D', '', 'g') = $2)
    `, [email, cleanPhone]) as any[];

    let userId: string | null = null;
    let isExistingRecord = false;

    if (existingRecords.length > 0) {
        const activeUser = existingRecords.find((p: any) => p.usuario);
        if (activeUser) {
            const isEmailMatch = activeUser.email?.toLowerCase() === email.toLowerCase();
            return res.status(400).json({
                detail: isEmailMatch ? 'Este email já está vinculado a uma conta ativa.' : 'Este celular já possui uma conta ativa.'
            });
        }
        const phoneMatch = cleanPhone ? existingRecords.find((p: any) => p.phone && String(p.phone).replace(/\D/g, '') === cleanPhone) : null;
        const adopter = phoneMatch || existingRecords[0];
        userId = String(adopter.id);
        isExistingRecord = true;
    } else {
        userId = (globalThis as any).crypto?.randomUUID?.() || (await import('node:crypto')).randomUUID();
    }

    const hash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    if (isExistingRecord) {
        await sql(`
            UPDATE players SET 
                email = $2, password_hash = $3, name = $4, role = $6, 
                usuario = true, avatar = COALESCE($7, avatar),
                created_at = COALESCE(created_at, $5)
            WHERE id = $1
        `, [userId, email, hash, name, now, userRole, avatar || null]);
    } else {
        await sql(`
            INSERT INTO players(id, email, password_hash, name, phone, role, created_at, usuario, avatar)
            VALUES($1, $2, $3, $4, $5, $6, $7, true, $8)
        `, [userId, email, hash, name, cleanPhone, userRole, now, avatar || null]);
    }

    if (phone || birthDate || favoriteTeam) {
        await sql(`
            UPDATE players SET 
                phone = COALESCE($2, phone),
                birth_date = COALESCE($3, birth_date),
                favorite_team = COALESCE($4, favorite_team)
            WHERE id = $1
        `, [userId, cleanPhone, birthDate || null, favoriteTeam || null]);
    }

    const secret = process.env.JWT_SECRET || 'dev-secret';
    const token = jwt.sign({ sub: userId, email, role: userRole }, secret, { expiresIn: '7d' });

    const userObj = {
        id: userId,
        name,
        email,
        nickname,
        role: userRole,
        phone: cleanPhone,
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
    };

    res.status(200).json({ access: token, user: userObj });
}
