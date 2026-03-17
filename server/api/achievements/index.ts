import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const { playerId, groupId } = req.query;
    const sql = await ready();

    let query = `SELECT * FROM achievements WHERE 1=1`;
    const params: any[] = [];

    if (playerId) {
      params.push(playerId);
      query += ` AND player_id = $${params.length}`;
    }
    if (groupId) {
      params.push(groupId);
      query += ` AND group_id = $${params.length}`;
    }

    query += ` ORDER BY awarded_at DESC`;
    const rows = await sql(query, params);
    res.status(200).json(rows);
  } catch (error: any) {
    console.error('Achievements error:', error);
    res.status(500).json({ error: 'Erro ao buscar conquistas' });
  }
}
