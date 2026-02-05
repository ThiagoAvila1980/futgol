import { ready } from '../../_db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const id = (req.query.id || (req as any).params?.id) as string;
  const { voterId, votedForId } = req.body;

  if (!id || !voterId || !votedForId) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing required fields' }));
    return;
  }

  try {
    const sql = await ready();

    // 1. Verify match exists and retrieve player lists
    const matches = await sql(`SELECT * FROM matches WHERE id = $1`, [id as string]) as any[];

    if (matches.length === 0) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Match not found' }));
      return;
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
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Voter was not present at the match' }));
      return;
    }

    if (!arrivedIds.includes(votedForId)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Voted player was not present at the match' }));
      return;
    }

    // Check if voting is closed (2 days after match)
    const matchDate = new Date(`${match.date}T${match.time || '00:00:00'}`);
    const now = new Date();
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    if (now.getTime() - matchDate.getTime() > twoDaysInMs) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Votação encerrada para esta partida' }));
      return;
    }

    // 2. Insert vote
    await sql(`
      INSERT INTO match_votes (match_id, voter_id, voted_for_id, created_at)
      VALUES ($1, $2, $3, $4)
    `, [id as string, voterId, votedForId, new Date().toISOString()]);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;

  } catch (error: any) {
    if (error.code === '23505') { // Unique violation (idx_match_votes_unique_voter)
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'User already voted for this match' }));
      return;
    }
    console.error('Vote error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
    return;
  }
}
