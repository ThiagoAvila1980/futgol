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

  if (!groupId) {
    // If no group ID, maybe return empty or all users? 
    // Usually this endpoint is called with groupId.
    res.statusCode = 400;
    res.end('Missing groupId');
    return;
  }

  const rows = await sql(
    `SELECT u.id as user_id, u.name, u.email, u.phone, u.avatar, u.birth_date, u.favorite_team,
              gp.id as link_id, gp.role, gp.joined_at, gp.nickname, gp.position, gp.rating, gp.matches_played, 
              gp.is_monthly_subscriber, gp.monthly_start_month, gp.is_guest
       FROM players u
       INNER JOIN group_players gp ON gp.player_id = u.id
       WHERE gp.group_id = $1`,
    [groupId]
  ) as any[];

  const data = rows.map((r: any) => ({
    id: String(r.user_id),
    groupPlayerId: String(r.link_id),
    groupId: String(groupId),
    userId: String(r.user_id),
    name: String(r.name || ''),
    nickname: String(r.nickname || ''),
    birthDate: String(r.birth_date || ''),
    email: String(r.email || ''),
    phone: r.phone ? String(r.phone) : null,
    favoriteTeam: String(r.favorite_team || ''),
    position: String(r.position || 'Meio-Campo'),
    rating: Number(r.rating ?? 5.0),
    matchesPlayed: Number(r.matches_played ?? 0),
    avatar: r.avatar ? String(r.avatar) : null,
    isMonthlySubscriber: Number(r.is_monthly_subscriber ?? 0) === 1,
    monthlyStartMonth: r.monthly_start_month ? String(r.monthly_start_month) : null,
    isGuest: Number(r.is_guest ?? 0) === 1,
    role: r.role ? String(r.role) : 'member',
    joinedAt: r.joined_at ? String(r.joined_at) : ''
  }));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
