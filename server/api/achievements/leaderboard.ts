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

    const badgeRows = (await sql(
      `SELECT player_id, badge FROM achievements WHERE group_id = $1`,
      [groupId]
    )) as { player_id: string; badge: string }[];

    const earnedBadgesByPlayer: Record<string, string[]> = {};
    for (const row of badgeRows) {
      const pid = String(row.player_id);
      if (!earnedBadgesByPlayer[pid]) earnedBadgesByPlayer[pid] = [];
      earnedBadgesByPlayer[pid].push(String(row.badge));
    }

    const pjRows = await sql(
      `SELECT primeiro_jogo_status FROM matches
       WHERE group_id = $1 AND finished = 1 AND (is_canceled IS NULL OR is_canceled = 0)
         AND primeiro_jogo_status IS NOT NULL AND TRIM(primeiro_jogo_status) != ''`,
      [groupId]
    ) as any[];

    const primeiroJogoXpByPlayer: Record<string, number> = {};
    for (const row of pjRows) {
      try {
        const o = JSON.parse(row.primeiro_jogo_status) as Record<string, string>;
        for (const [pid, st] of Object.entries(o || {})) {
          const pts = st === 'V' ? 3 : st === 'E' ? 1 : 0;
          primeiroJogoXpByPlayer[pid] = (primeiroJogoXpByPlayer[pid] || 0) + pts;
        }
      } catch {
        /* ignore malformed json */
      }
    }

    const levelThresholds = [0, 5, 15, 30, 50, 80, 120, 170, 230, 300];
    const rows = leaderboard.map((p: any) => {
      const pid = p.player_id as string;
      const pj = primeiroJogoXpByPlayer[pid] || 0;
      const fromMatches = (p.matches_played || 0) * 10;
      const fromMvp = (p.mvp_count || 0) * 25;
      const fromBadges = (Number(p.total_badges) || 0) * 15;
      const xp = fromMatches + fromMvp + fromBadges + pj;
      const level = levelThresholds.findIndex(t => xp < t);
      return {
        playerId: pid,
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
        primeiroJogoPoints: pj,
        earnedBadges: earnedBadgesByPlayer[pid] || [],
        xpBreakdown: {
          fromMatches,
          fromMvp,
          fromBadges,
          fromPrimeiroJogo: pj,
        },
      };
    });

    rows.sort((a, b) => b.xp - a.xp);
    const result = rows.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
}
