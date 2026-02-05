import { ready } from '../../_db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const id = (req.query.id || (req as any).params?.id) as string;

  if (!id) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing match id' }));
    return;
  }

  try {
    const sql = await ready();
    
    // Get all votes for this match
    const votes = await sql(`
      SELECT * FROM match_votes WHERE match_id = $1
    `, [id as string]) as any[];

    // Calculate aggregation (MVP count)
    const voteCounts: Record<string, number> = {};
    votes.forEach((v: any) => {
      const votedFor = v.voted_for_id;
      voteCounts[votedFor] = (voteCounts[votedFor] || 0) + 1;
    });

    // Find current MVP(s)
    let maxVotes = 0;
    Object.values(voteCounts).forEach(count => {
      if (count > maxVotes) maxVotes = count;
    });
    
    // Note: We return raw votes so frontend can check if user voted, 
    // and also aggregated stats if needed.
    // Or we can just return the list and let frontend process.
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      votes: votes.map((v: any) => ({
        id: v.id,
        matchId: v.match_id,
        voterId: v.voter_id,
        votedForId: v.voted_for_id,
        createdAt: v.created_at
      })),
      counts: voteCounts
    }));
    return;

  } catch (error) {
    console.error('Get votes error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
    return;
  }
}
