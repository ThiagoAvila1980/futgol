import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const { groupId } = req.query;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId é obrigatório' });
    }

    const sql = await ready();

    const leaderboard = await sql(`
      SELECT 
        gp.player_id,
        p.name,
        gp.nickname,
        gp.position,
        gp.rating,
        gp.matches_played,
        p.avatar,
        COUNT(a.id) as total_badges,
        (SELECT COUNT(*) FROM matches m 
         WHERE m.group_id = $1 AND m.finished = 1 AND m.mvp_id = gp.player_id) as mvp_count
      FROM group_players gp
      JOIN players p ON p.id = gp.player_id
      LEFT JOIN achievements a ON a.player_id = gp.player_id AND a.group_id = $1
      WHERE gp.group_id = $1
      GROUP BY gp.player_id, p.name, gp.nickname, gp.position, gp.rating, gp.matches_played, p.avatar
      ORDER BY total_badges DESC, mvp_count DESC, gp.rating DESC
      LIMIT 50
    `, [groupId]);

    const levelThresholds = [0, 5, 15, 30, 50, 80, 120, 170, 230, 300];
    const result = leaderboard.map((p: any, idx: number) => {
      const xp = (p.matches_played || 0) * 10 + (p.mvp_count || 0) * 25 + (p.total_badges || 0) * 15;
      const level = levelThresholds.findIndex(t => xp < t);
      return {
        rank: idx + 1,
        playerId: p.player_id,
        name: p.name,
        nickname: p.nickname,
        position: p.position,
        rating: p.rating,
        matchesPlayed: p.matches_played || 0,
        avatar: p.avatar,
        totalBadges: Number(p.total_badges) || 0,
        mvpCount: Number(p.mvp_count) || 0,
        xp,
        level: level === -1 ? levelThresholds.length : level,
      };
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
}
