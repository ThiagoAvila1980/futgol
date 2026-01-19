import { ready } from '../_db';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';

export default async function (req: any, res: any) {
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

    const { email, password, name, phone, nickname, birthDate, favoriteTeam, position, avatar } = body;

    if (!email || !password || !name) {
        res.statusCode = 400;
        res.end(JSON.stringify({ detail: 'Missing fields' }));
        return;
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
    const sql = await ready();

    // 1. Check for existing records by Email or Phone
    const existingRecords = await sql(`
        SELECT id, email, phone, usuario 
        FROM players 
        WHERE email = $1 OR (phone IS NOT NULL AND REGEXP_REPLACE(phone, '\\D', '', 'g') = $2)
    `, [email, cleanPhone]) as any[];

    let userId: string | null = null;
    let isExistingRecord = false;

    if (existingRecords.length > 0) {
        // Check if any of the matches is already an active user
        const activeUser = existingRecords.find(p => p.usuario);
        if (activeUser) {
            const isEmailMatch = activeUser.email?.toLowerCase() === email.toLowerCase();
            res.statusCode = 400;
            res.end(JSON.stringify({
                detail: isEmailMatch ? 'Este email já está vinculado a uma conta ativa.' : 'Este celular já possui uma conta ativa.'
            }));
            return;
        }
        // If we reach here, we found one or more guest records (usuario=false)
        // We adopt the first one found (preferring phone match if multiple exist)
        const phoneMatch = cleanPhone ? existingRecords.find(p => p.phone && String(p.phone).replace(/\D/g, '') === cleanPhone) : null;
        const adopter = phoneMatch || existingRecords[0];
        userId = String(adopter.id);
        isExistingRecord = true;
    } else {
        // Brand new user
        userId = (globalThis as any).crypto?.randomUUID?.() || (await import('node:crypto')).randomUUID();
    }

    const hash = createHash('sha256').update(password).digest('hex');
    const now = new Date().toISOString();

    // 3. Insert or Update
    if (isExistingRecord) {
        // Update existing player profile to become a full user account
        await sql(`
            UPDATE players SET 
                email = $2, 
                password_hash = $3, 
                name = $4, 
                role = 'user', 
                usuario = true,
                avatar = COALESCE($6, avatar),
                created_at = COALESCE(created_at, $5)
            WHERE id = $1
        `, [userId, email, hash, name, now, avatar || null]);
    } else {
        // Create brand new player record with user status
        await sql(`
            INSERT INTO players(id, email, password_hash, name, phone, role, created_at, usuario, avatar)
            VALUES($1, $2, $3, $4, $5, 'user', $6, true, $7)
        `, [userId, email, hash, name, cleanPhone, now, avatar || null]);
    }

    // Update Player Profile Fields directly in players table
    if (phone || birthDate || favoriteTeam) {
        await sql(`
        UPDATE players SET 
           phone = COALESCE($2, phone),
           birth_date = COALESCE($3, birth_date),
           favorite_team = COALESCE($4, favorite_team)
        WHERE id = $1
      `, [userId, cleanPhone, birthDate || null, favoriteTeam || null]);
    }

    // Generate Token
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const token = jwt.sign({ sub: userId, email: email, role: 'user' }, secret, { expiresIn: '7d' });

    const userObj = {
        id: userId,
        name,
        email,
        nickname,
        phone: cleanPhone,
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
        access: token,
        user: userObj
    }));
}
