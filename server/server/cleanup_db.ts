import { ready } from '../api/_db';

async function run() {
  const sql = await ready();

  const players = await sql(`SELECT id FROM players`) as any[];
  const playerSet = new Set<string>(players.map((p: any) => String(p.id)));

  const groups = await sql(`SELECT id, admin_id, admins FROM groups`) as any[];
  for (const g of groups) {
    let admins: string[] = [];
    try {
      if (Array.isArray(g.admins)) admins = g.admins.map(String);
      else if (typeof g.admins === 'string' && g.admins.trim()) admins = JSON.parse(g.admins);
    } catch {
      admins = [];
    }
    const adminId = g.admin_id ? String(g.admin_id) : '';
    if (adminId) admins.push(adminId);
    admins = admins.map(String).filter(id => playerSet.has(id));
    admins = Array.from(new Set(admins));
    await sql(`UPDATE groups SET admins = $1, pending_requests = NULL WHERE id = $2`, [JSON.stringify(admins), String(g.id)]);
    for (const uid of admins) {
      const rows = await sql(`SELECT id FROM group_players WHERE group_id = $1 AND player_id = $2`, [String(g.id), uid]) as any[];
      if (!rows.length) {
        await sql(`INSERT INTO group_players(id, group_id, player_id, role, joined_at) VALUES(gen_random_uuid(), $1, $2, 'admin', $3)`, [String(g.id), uid, new Date().toISOString()]);
      } else {
        await sql(`UPDATE group_players SET role = 'admin' WHERE group_id = $1 AND player_id = $2`, [String(g.id), uid]);
      }
    }
  }

  const matches = await sql(`SELECT id, confirmed_player_ids, paid_player_ids, arrived_player_ids, mvp_id FROM matches`) as any[];
  for (const m of matches) {
    function parseList(v: any): string[] {
      try {
        if (Array.isArray(v)) return v.map(String);
        if (typeof v === 'string' && v.trim()) return JSON.parse(v).map(String);
      } catch {}
      return [];
    }
    const confirmed = parseList(m.confirmed_player_ids).filter((id: string) => playerSet.has(id));
    const paid = parseList(m.paid_player_ids).filter((id: string) => playerSet.has(id));
    const arrived = parseList(m.arrived_player_ids).filter((id: string) => playerSet.has(id));
    let mvpId = m.mvp_id ? String(m.mvp_id) : null;
    if (mvpId && !playerSet.has(mvpId)) mvpId = null;
    await sql(
      `UPDATE matches SET confirmed_player_ids = $2, paid_player_ids = $3, arrived_player_ids = $4, mvp_id = $5 WHERE id = $1`,
      [String(m.id), JSON.stringify(confirmed), JSON.stringify(paid), JSON.stringify(arrived), mvpId]
    );
  }

  const txs = await sql(`SELECT id, related_player_id, paid_player_ids FROM transactions`) as any[];
  for (const t of txs) {
    let related = t.related_player_id ? String(t.related_player_id) : null;
    if (related && !playerSet.has(related)) related = null;
    let paidList: string[] = [];
    if (typeof t.paid_player_ids === 'string' && t.paid_player_ids.trim()) {
      paidList = t.paid_player_ids.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    paidList = paidList.filter(id => playerSet.has(id));
    const paidText = paidList.length ? paidList.join(',') : null;
    await sql(`UPDATE transactions SET related_player_id = $2, paid_player_ids = $3 WHERE id = $1`, [String(t.id), related, paidText]);
  }

  console.log('Cleanup finished');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
