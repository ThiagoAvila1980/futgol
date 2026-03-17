import { ready } from '../_db';

type PlayerPoints = {
  attended: boolean;
  goals: number;
  assists: number;
  points: number;
};

type Snapshot = {
  matchesAttended: number;
  goals: number;
  assists: number;
  mvpCount: number;
  currentStreak: number;
};

const BADGE_THRESHOLDS = {
  matches: [10, 50, 100],
  mvp: [1, 5, 10],
  streak: [5, 10],
};

async function awardBadgeIfNeeded(sql: any, opts: { playerId: string; groupId: string; badge: string }) {
  const { playerId, groupId, badge } = opts;
  const { BADGE_DEFINITIONS } = await import('./award');
  const def = (BADGE_DEFINITIONS as any)[badge];
  if (!def) {
    console.warn('Unknown badge id in from_match:', badge);
    return;
  }
  const existing = await sql(
    `SELECT id FROM achievements WHERE player_id = $1 AND badge = $2 AND group_id = $3`,
    [playerId, groupId]
  );
  if (existing.length > 0) return;
  const now = new Date().toISOString();
  await sql(
    `INSERT INTO achievements(player_id, group_id, badge, title, description, awarded_at)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [playerId, groupId, badge, def.title, def.description, now]
  );
}

export async function processAchievementsForMatch(matchId: string) {
  const sql = await ready();
  const rows = await sql(`SELECT * FROM matches WHERE id = $1`, [matchId]) as any[];
  const current = rows[0];
  if (!current) return;
  if (!current.finished || current.is_canceled) return;

  const groupId = current.group_id as string;
  const matchDate = current.date as string;
  const matchTime = (current.time || '00:00') as string;
  const ymCurrent = matchDate.slice(0, 7);

  const allMatches = await sql(
    `SELECT * FROM matches 
     WHERE group_id = $1 
       AND finished = 1 
       AND (is_canceled IS NULL OR is_canceled = 0)
       AND (date < $2 OR (date = $2 AND COALESCE(time,'00:00') <= $3))
     ORDER BY date ASC, COALESCE(time,'00:00') ASC`,
    [groupId, matchDate, matchTime]
  ) as any[];

  const monthMatches = allMatches.filter(m => (m.date as string).slice(0, 7) === ymCurrent);

  const pointsByMatch: Record<string, Record<string, PlayerPoints>> = {};
  const allPlayerIds = new Set<string>();

  for (const m of allMatches) {
    let p: Record<string, PlayerPoints> = {};
    try {
      if (m.player_points) {
        p = JSON.parse(m.player_points);
      }
    } catch {
      p = {};
    }
    pointsByMatch[m.id] = p;
    Object.keys(p || {}).forEach(pid => {
      if (pid) allPlayerIds.add(pid);
    });
  }

  const currentMatchPoints = pointsByMatch[matchId] || {};
  const focusedPlayers = new Set<string>(Object.keys(currentMatchPoints));
  if (focusedPlayers.size === 0) return;

  const before: Record<string, Snapshot> = {};
  const after: Record<string, Snapshot> = {};
  const beforeStreak: Record<string, number> = {};
  const afterStreak: Record<string, number> = {};

  const totals: Record<string, Snapshot> = {};
  const monthGoals: Record<string, number> = {};
  const monthMatchesAttended: Record<string, number> = {};
  let monthTotalMatches = 0;

  for (const pid of allPlayerIds) {
    totals[pid] = { matchesAttended: 0, goals: 0, assists: 0, mvpCount: 0, currentStreak: 0 };
  }

  for (const m of allMatches) {
    const mid = m.id as string;
    const date = m.date as string;
    const ym = date.slice(0, 7);
    const matchPoints = pointsByMatch[mid] || {};
    const isCurrent = mid === matchId;

    if (isCurrent) {
      for (const pid of focusedPlayers) {
        const snap = totals[pid] || { matchesAttended: 0, goals: 0, assists: 0, mvpCount: 0, currentStreak: 0 };
        before[pid] = { ...snap };
        beforeStreak[pid] = snap.currentStreak;
      }
    }

    const playersInMatch = Object.entries(matchPoints) as [string, PlayerPoints][];
    const mvpId = m.mvp_id as string | null;

    if (ym === ymCurrent) {
      monthTotalMatches += 1;
    }

    for (const [pid, p] of playersInMatch) {
      if (!totals[pid]) {
        totals[pid] = { matchesAttended: 0, goals: 0, assists: 0, mvpCount: 0, currentStreak: 0 };
      }
      const t = totals[pid];
      if (p.attended) {
        t.matchesAttended += 1;
        t.currentStreak += 1;
        if (ym === ymCurrent) {
          monthMatchesAttended[pid] = (monthMatchesAttended[pid] || 0) + 1;
        }
      } else {
        t.currentStreak = 0;
      }
      t.goals += p.goals || 0;
      t.assists += p.assists || 0;
      if (mvpId && mvpId === pid) {
        t.mvpCount += 1;
      }
      if (ym === ymCurrent) {
        monthGoals[pid] = (monthGoals[pid] || 0) + (p.goals || 0);
      }
    }

    if (isCurrent) {
      for (const pid of focusedPlayers) {
        const snap = totals[pid] || { matchesAttended: 0, goals: 0, assists: 0, mvpCount: 0, currentStreak: 0 };
        after[pid] = { ...snap };
        afterStreak[pid] = snap.currentStreak;
      }
    }
  }

  for (const pid of focusedPlayers) {
    const b = before[pid] || { matchesAttended: 0, goals: 0, assists: 0, mvpCount: 0, currentStreak: 0 };
    const a = after[pid] || b;

    if (b.matchesAttended === 0 && a.matchesAttended > 0) {
      await awardBadgeIfNeeded(sql, { playerId: pid, groupId, badge: 'first_match' });
    }

    for (const threshold of BADGE_THRESHOLDS.matches) {
      if (b.matchesAttended < threshold && a.matchesAttended >= threshold) {
        const badge = threshold === 10 ? 'matches_10' : threshold === 50 ? 'matches_50' : 'matches_100';
        await awardBadgeIfNeeded(sql, { playerId: pid, groupId, badge });
      }
    }

    for (const threshold of BADGE_THRESHOLDS.mvp) {
      if (b.mvpCount < threshold && a.mvpCount >= threshold) {
        const badge = threshold === 1 ? 'mvp_first' : threshold === 5 ? 'mvp_5' : 'mvp_10';
        await awardBadgeIfNeeded(sql, { playerId: pid, groupId, badge });
      }
    }

    const bs = beforeStreak[pid] || b.currentStreak || 0;
    const as = afterStreak[pid] || a.currentStreak || 0;
    for (const threshold of BADGE_THRESHOLDS.streak) {
      if (bs < threshold && as >= threshold) {
        const badge = threshold === 5 ? 'streak_5' : 'streak_10';
        await awardBadgeIfNeeded(sql, { playerId: pid, groupId, badge });
      }
    }
  }

  if (monthMatches.length > 0) {
    let maxGoals = 0;
    for (const pid of Object.keys(monthGoals)) {
      if (monthGoals[pid] > maxGoals) maxGoals = monthGoals[pid];
    }
    if (maxGoals > 0) {
      for (const pid of Object.keys(monthGoals)) {
        if (monthGoals[pid] === maxGoals && focusedPlayers.has(pid)) {
          await awardBadgeIfNeeded(sql, { playerId: pid, groupId, badge: 'top_scorer_month' });
        }
      }
    }
    if (monthTotalMatches > 0) {
      for (const pid of Object.keys(monthMatchesAttended)) {
        if (monthMatchesAttended[pid] === monthTotalMatches && focusedPlayers.has(pid)) {
          await awardBadgeIfNeeded(sql, { playerId: pid, groupId, badge: 'perfect_attendance' });
        }
      }
    }
  }
}

