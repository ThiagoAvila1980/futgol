import { ready } from '../_db';

const BADGE_DEFINITIONS: Record<string, { title: string; description: string }> = {
  first_match: { title: 'Primeira Partida', description: 'Participou da primeira partida' },
  mvp_first: { title: 'Primeiro MVP', description: 'Eleito MVP pela primeira vez' },
  mvp_5: { title: 'Craque Frequente', description: 'Eleito MVP 5 vezes' },
  mvp_10: { title: 'Lenda do MVP', description: 'Eleito MVP 10 vezes' },
  matches_10: { title: 'Veterano', description: 'Participou de 10 partidas' },
  matches_50: { title: 'Centurião', description: 'Participou de 50 partidas' },
  matches_100: { title: 'Imortal', description: 'Participou de 100 partidas' },
  streak_5: { title: 'Sequência de 5', description: '5 partidas consecutivas' },
  streak_10: { title: 'Máquina', description: '10 partidas consecutivas' },
  top_scorer_month: { title: 'Artilheiro do Mês', description: 'Maior número de gols no mês' },
  perfect_attendance: { title: 'Pontualidade 10', description: 'Presente em todas as partidas do mês' },
  group_founder: { title: 'Fundador', description: 'Criou o grupo' },
};

export default async function (req: any, res: any) {
  try {
    const { playerId, groupId, badge } = req.body;
    if (!playerId || !badge) {
      return res.status(400).json({ error: 'playerId e badge são obrigatórios' });
    }

    const def = BADGE_DEFINITIONS[badge];
    if (!def) {
      return res.status(400).json({ error: 'Badge inválido', available: Object.keys(BADGE_DEFINITIONS) });
    }

    const sql = await ready();
    const existing = await sql(
      `SELECT id FROM achievements WHERE player_id = $1 AND badge = $2 AND ($3::text IS NULL OR group_id = $3)`,
      [playerId, badge, groupId || null]
    );

    if (existing.length > 0) {
      return res.status(200).json({ alreadyAwarded: true });
    }

    const now = new Date().toISOString();
    await sql(
      `INSERT INTO achievements(player_id, group_id, badge, title, description, awarded_at)
       VALUES($1, $2, $3, $4, $5, $6)`,
      [playerId, groupId || null, badge, def.title, def.description, now]
    );

    res.status(201).json({ success: true, badge, title: def.title });
  } catch (error: any) {
    console.error('Award error:', error);
    res.status(500).json({ error: 'Erro ao conceder conquista' });
  }
}
