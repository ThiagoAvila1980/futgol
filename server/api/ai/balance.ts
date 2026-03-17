import { GoogleGenAI } from '@google/genai';
import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const { groupId, playerIds, numTeams = 2 } = req.body;
    if (!groupId || !playerIds?.length) {
      return res.status(400).json({ error: 'groupId e playerIds são obrigatórios' });
    }

    const sql = await ready();
    const placeholders = playerIds.map((_: any, i: number) => `$${i + 2}`).join(',');
    const players = await sql(
      `SELECT gp.player_id, gp.nickname, gp.position, gp.rating, gp.matches_played,
              p.name
       FROM group_players gp
       JOIN players p ON p.id = gp.player_id
       WHERE gp.group_id = $1 AND gp.player_id IN (${placeholders})`,
      [groupId, ...playerIds]
    );

    const matchHistory = await sql(
      `SELECT id, team_a, team_b, score_a, score_b, mvp_id, sub_matches
       FROM matches WHERE group_id = $1 AND finished = 1
       ORDER BY date DESC LIMIT 20`,
      [groupId]
    );

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json(fallbackBalance(players, numTeams));
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um especialista em futebol. Distribua os jogadores em ${numTeams} times equilibrados.

Jogadores:
${players.map((p: any) => `- ${p.nickname || p.name} | Posição: ${p.position || 'N/A'} | Rating: ${p.rating}/10 | Partidas: ${p.matches_played}`).join('\n')}

${matchHistory.length > 0 ? `Histórico recente (últimas ${matchHistory.length} partidas disponível para contexto).` : ''}

Regras:
1. Distribua posições equilibradamente (goleiro, defesa, meio, ataque)
2. Equilibre a média de rating entre os times
3. Considere a experiência (partidas jogadas)

Responda APENAS em JSON válido no formato:
{
  "teams": [
    { "name": "Time A", "players": ["id1", "id2"], "avgRating": 7.5, "reasoning": "..." },
    { "name": "Time B", "players": ["id3", "id4"], "avgRating": 7.3, "reasoning": "..." }
  ],
  "analysis": "Explicação geral do balanceamento"
}

IDs dos jogadores: ${players.map((p: any) => `${p.player_id} (${p.nickname || p.name})`).join(', ')}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json(fallbackBalance(players, numTeams));
    }

    const result = JSON.parse(jsonMatch[0]);
    res.status(200).json({ ...result, aiPowered: true });
  } catch (error: any) {
    console.error('AI balance error:', error);
    res.status(500).json({ error: 'Erro na IA de balanceamento' });
  }
}

function fallbackBalance(players: any[], numTeams: number) {
  const sorted = [...players].sort((a, b) => (b.rating || 5) - (a.rating || 5));
  const teams: any[][] = Array.from({ length: numTeams }, () => []);

  sorted.forEach((player, idx) => {
    teams[idx % numTeams].push(player);
  });

  return {
    teams: teams.map((t, i) => ({
      name: `Time ${String.fromCharCode(65 + i)}`,
      players: t.map((p: any) => p.player_id),
      avgRating: t.length ? +(t.reduce((s: number, p: any) => s + (p.rating || 5), 0) / t.length).toFixed(1) : 0,
      reasoning: 'Balanceamento por rating (fallback sem IA)',
    })),
    analysis: 'Balanceamento algorítmico (Gemini não disponível)',
    aiPowered: false,
  };
}
