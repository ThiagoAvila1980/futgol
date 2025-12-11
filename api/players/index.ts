import { ready } from '../_db';

export default async function (req: any, res: any) {
  const sql = await ready();
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const groupId = url.searchParams.get('groupId') || '';
  const rows = await sql(`SELECT p.*, pr.name as pr_name, pr.nickname as pr_nickname, pr.birth_date as pr_birth_date, pr.email as pr_email, pr.phone as pr_phone, pr.favorite_team as pr_favorite_team, pr.position as pr_position, pr.avatar as pr_avatar 
                          FROM players p 
                          LEFT JOIN player_profiles pr ON pr.id = p.profile_id
                          WHERE p.group_id = $1`, [groupId]) as any[];
  const data = rows.map((p: any) => ({
    id: p.id,
    groupId: p.group_id,
    userId: p.user_id || undefined,
    name: p.pr_name ?? p.name,
    nickname: p.pr_nickname ?? p.nickname,
    birthDate: p.pr_birth_date ?? p.birth_date,
    email: p.pr_email ?? p.email,
    phone: (p.pr_phone ?? p.phone) || undefined,
    favoriteTeam: p.pr_favorite_team ?? p.favorite_team,
    position: (p.pr_position ?? p.position) || 'Meio-Campo',
    rating: Number(p.rating || 0),
    matchesPlayed: Number(p.matches_played || 0),
    avatar: (p.pr_avatar ?? p.avatar) || undefined,
    isMonthlySubscriber: !!p.is_monthly_subscriber,
    monthlyStartMonth: p.monthly_start_month || undefined,
    isGuest: !!p.is_guest
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
