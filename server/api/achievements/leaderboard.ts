import { ready } from '../_db';

function safeJson<T>(raw: any, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function computePlayerPointsFromMatch(m: any): Record<string, { attended: boolean }> {
  const confirmed: string[] = safeJson(m.confirmed_player_ids, []);
  const arrived: string[] = safeJson(m.arrived_player_ids, []);
  const teamA: any[] = safeJson(m.team_a, []);
  const teamB: any[] = safeJson(m.team_b, []);
  const subMatches: any[] = safeJson(m.sub_matches, []);

  const attendees = new Set<string>(arrived.filter(Boolean));
  for (const p of [...teamA, ...teamB]) {
    if (p && typeof p.id === 'string') attendees.add(p.id);
  }
  for (const sm of subMatches) {
    for (const p of [...(sm?.teamA || []), ...(sm?.teamB || [])]) {
      if (p && typeof p.id === 'string') attendees.add(p.id);
    }
  }

  if (attendees.size === 0) {
    for (const pid of confirmed) attendees.add(pid);
  }

  const goals: Record<string, number> = {};
  const assists: Record<string, number> = {};
  for (const sm of subMatches) {
    const g = sm?.goals || {};
    const a = sm?.assists || {};
    if (g && typeof g === 'object') {
      for (const [pid, count] of Object.entries(g)) {
        const n = Number(count || 0);
        if (!Number.isFinite(n) || n <= 0) continue;
        goals[pid] = (goals[pid] || 0) + n;
      }
    }
    if (a && typeof a === 'object') {
      for (const [pid, count] of Object.entries(a)) {
        const n = Number(count || 0);
        if (!Number.isFinite(n) || n <= 0) continue;
        assists[pid] = (assists[pid] || 0) + n;
      }
    }
  }

  const allPlayers = new Set<string>([...attendees, ...Object.keys(goals), ...Object.keys(assists)]);
  const out: Record<string, { attended: boolean }> = {};
  for (const pid of allPlayers) {
    out[pid] = { attended: attendees.has(pid) };
  }
  return out;
}

const levelThresholds = [0, 5, 15, 30, 50, 80, 120, 170, 230, 300];

async function buildAllTimeLeaderboard(sql: any, groupId: string) {
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
  return rows.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

async function buildPeriodLeaderboard(sql: any, groupId: string, start: string, end: string) {
  const players = (await sql(
    `SELECT 
        gp.player_id,
        p.name,
        gp.nickname,
        gp.position,
        gp.rating,
        p.avatar
      FROM group_players gp
      JOIN players p ON p.id = gp.player_id
      WHERE gp.group_id = $1`,
    [groupId]
  )) as any[];

  const badgeRows = (await sql(
    `SELECT player_id, badge FROM achievements
     WHERE group_id = $1
       AND substring(awarded_at from 1 for 10) >= $2
       AND substring(awarded_at from 1 for 10) <= $3`,
    [groupId, start, end]
  )) as { player_id: string; badge: string }[];

  const earnedBadgesByPlayer: Record<string, string[]> = {};
  const badgeCountByPlayer: Record<string, number> = {};
  for (const row of badgeRows) {
    const pid = String(row.player_id);
    if (!earnedBadgesByPlayer[pid]) earnedBadgesByPlayer[pid] = [];
    earnedBadgesByPlayer[pid].push(String(row.badge));
    badgeCountByPlayer[pid] = (badgeCountByPlayer[pid] || 0) + 1;
  }

  const matchRows = (await sql(
    `SELECT * FROM matches
     WHERE group_id = $1
       AND finished = 1
       AND (is_canceled IS NULL OR is_canceled = 0)
       AND date >= $2 AND date <= $3`,
    [groupId, start, end]
  )) as any[];

  const matchesPlayedByPlayer: Record<string, number> = {};
  const mvpCountByPlayer: Record<string, number> = {};
  const primeiroJogoXpByPlayer: Record<string, number> = {};

  for (const m of matchRows) {
    const pointsMap = m.player_points
      ? safeJson<Record<string, any>>(m.player_points, {})
      : computePlayerPointsFromMatch(m);

    for (const [playerId, p] of Object.entries(pointsMap || {})) {
      if (!playerId) continue;
      if (p?.attended) {
        matchesPlayedByPlayer[playerId] = (matchesPlayedByPlayer[playerId] || 0) + 1;
      }
    }

    const mid = m.mvp_id as string | null;
    if (mid) {
      mvpCountByPlayer[mid] = (mvpCountByPlayer[mid] || 0) + 1;
    }

    const raw = m.primeiro_jogo_status;
    if (raw && String(raw).trim()) {
      try {
        const o = JSON.parse(raw) as Record<string, string>;
        for (const [pid, st] of Object.entries(o || {})) {
          const pts = st === 'V' ? 3 : st === 'E' ? 1 : 0;
          primeiroJogoXpByPlayer[pid] = (primeiroJogoXpByPlayer[pid] || 0) + pts;
        }
      } catch {
        /* ignore */
      }
    }
  }

  const rows = players.map((p: any) => {
    const pid = p.player_id as string;
    const pj = primeiroJogoXpByPlayer[pid] || 0;
    const mp = matchesPlayedByPlayer[pid] || 0;
    const mvp = mvpCountByPlayer[pid] || 0;
    const tb = badgeCountByPlayer[pid] || 0;
    const fromMatches = mp * 10;
    const fromMvp = mvp * 25;
    const fromBadges = tb * 15;
    const xp = fromMatches + fromMvp + fromBadges + pj;
    const level = levelThresholds.findIndex(t => xp < t);
    return {
      playerId: pid,
      name: p.name,
      nickname: p.nickname,
      position: p.position,
      rating: p.rating,
      matchesPlayed: mp,
      avatar: p.avatar,
      totalBadges: tb,
      mvpCount: mvp,
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
  return rows.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

export default async function (req: any, res: any) {
  try {
    const { groupId, startDate, endDate } = req.query;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId é obrigatório' });
    }

    const sql = await ready();

    const start = typeof startDate === 'string' ? startDate.trim() : '';
    const end = typeof endDate === 'string' ? endDate.trim() : '';
    const usePeriod = /^(\d{4})-(\d{2})-(\d{2})$/.test(start) && /^(\d{4})-(\d{2})-(\d{2})$/.test(end);

    const result = usePeriod
      ? await buildPeriodLeaderboard(sql, groupId, start, end)
      : await buildAllTimeLeaderboard(sql, groupId);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
}
