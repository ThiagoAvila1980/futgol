import { VercelRequest, VercelResponse } from '@vercel/node';
import { ready } from '../../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = (req.query.id || (req as any).params?.id) as string;
  const { voterId, votedForId } = req.body;

  if (!id || !voterId || !votedForId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const sql = await ready();

    // 1. Verify match exists and retrieve player lists
    const matches = await sql(`SELECT * FROM matches WHERE id = $1`, [id as string]) as any[];

    if (matches.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matches[0];

    // Parse arrivedPlayerIds (stored as JSON string)
    let arrivedIds: string[] = [];
    try {
      if (typeof match.arrived_player_ids === 'string') {
        arrivedIds = JSON.parse(match.arrived_player_ids);
      } else if (Array.isArray(match.arrived_player_ids)) {
        // In case it's somehow already an array (postgres driver sometimes parses json)
        arrivedIds = match.arrived_player_ids;
      }
    } catch (e) {
      console.error('Error parsing arrived_player_ids', e);
      arrivedIds = [];
    }

    if (!arrivedIds.includes(voterId)) {
      return res.status(403).json({ error: 'Voter was not present at the match' });
    }

    if (!arrivedIds.includes(votedForId)) {
      return res.status(400).json({ error: 'Voted player was not present at the match' });
    }

    // Check if voting is closed (2 days after match)
    const matchDate = new Date(`${match.date}T${match.time || '00:00:00'}`);
    const now = new Date();
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    if (now.getTime() - matchDate.getTime() > twoDaysInMs) {
      return res.status(403).json({ error: 'Votação encerrada para esta partida' });
    }

    // 2. Insert vote
    await sql(`
      INSERT INTO match_votes (match_id, voter_id, voted_for_id, created_at)
      VALUES ($1, $2, $3, $4)
    `, [id as string, voterId, votedForId, new Date().toISOString()]);

    return res.status(200).json({ success: true });

  } catch (error: any) {
    if (error.code === '23505') { // Unique violation (idx_match_votes_unique_voter)
      return res.status(400).json({ error: 'User already voted for this match' });
    }
    console.error('Vote error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
