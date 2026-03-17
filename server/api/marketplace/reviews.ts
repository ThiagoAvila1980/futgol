import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const { fieldId } = req.params;
    if (!fieldId) return res.status(400).json({ error: 'fieldId requerido' });

    const sql = await ready();

    if (req.method === 'GET') {
      const reviews = await sql(
        `SELECT fr.*, p.name as player_name, p.avatar as player_avatar
         FROM field_reviews fr
         JOIN players p ON p.id = fr.player_id
         WHERE fr.field_id = $1
         ORDER BY fr.created_at DESC`,
        [fieldId]
      );

      const stats = await sql(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total
         FROM field_reviews WHERE field_id = $1`,
        [fieldId]
      );

      return res.status(200).json({
        reviews: reviews.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.created_at,
          playerName: r.player_name,
          playerAvatar: r.player_avatar,
        })),
        avgRating: stats[0] ? Number(stats[0].avg_rating).toFixed(1) : '0',
        totalReviews: stats[0] ? Number(stats[0].total) : 0,
      });
    }

    if (req.method === 'POST') {
      const { playerId, rating, comment } = req.body;
      if (!playerId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'playerId e rating (1-5) são obrigatórios' });
      }

      const now = new Date().toISOString();
      await sql(
        `INSERT INTO field_reviews(field_id, player_id, rating, comment, created_at)
         VALUES($1, $2, $3, $4, $5)`,
        [fieldId, playerId, rating, comment || null, now]
      );

      return res.status(201).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Reviews error:', error);
    res.status(500).json({ error: 'Erro ao processar avaliações' });
  }
}
