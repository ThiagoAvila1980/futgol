import { VercelRequest, VercelResponse } from '@vercel/node';
import { ready } from '../../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = (req.query.id || (req as any).params?.id) as string;

  if (!id) {
    return res.status(400).json({ error: 'Missing match id' });
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
    
    return res.status(200).json({
      votes: votes.map((v: any) => ({
        id: v.id,
        matchId: v.match_id,
        voterId: v.voter_id,
        votedForId: v.voted_for_id,
        createdAt: v.created_at
      })),
      counts: voteCounts
    });

  } catch (error) {
    console.error('Get votes error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
