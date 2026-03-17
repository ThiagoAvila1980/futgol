import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const { matchId, groupId, type } = req.body;
    const sql = await ready();

    if (type === 'match_summary' && matchId) {
      const matches = await sql(`SELECT * FROM matches WHERE id = $1`, [matchId]);
      if (!matches.length) return res.status(404).json({ error: 'Partida não encontrada' });
      const match = matches[0];

      const group = groupId
        ? (await sql(`SELECT name FROM groups WHERE id = $1`, [groupId]))[0]
        : null;

      const teamANames = match.team_a ? JSON.parse(match.team_a).map((p: any) => p.nickname || p.name).join(', ') : 'N/A';
      const teamBNames = match.team_b ? JSON.parse(match.team_b).map((p: any) => p.nickname || p.name).join(', ') : 'N/A';

      const text = [
        `⚽ *${group?.name || 'Futgol'}* - Resultado`,
        `📅 ${match.date} ${match.time || ''}`,
        '',
        `🔵 Time A: ${match.score_a ?? '-'}`,
        teamANames,
        '',
        `🔴 Time B: ${match.score_b ?? '-'}`,
        teamBNames,
        '',
        match.mvp_id ? `🏆 MVP da Partida` : '',
        '',
        `📱 Gerencie sua pelada no Futgol!`,
      ].filter(Boolean).join('\n');

      const baseUrl = process.env.CLIENT_URL || 'https://futgol.app';
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

      return res.status(200).json({ text, whatsappUrl, baseUrl });
    }

    if (type === 'match_reminder' && matchId) {
      const matches = await sql(`SELECT * FROM matches WHERE id = $1`, [matchId]);
      if (!matches.length) return res.status(404).json({ error: 'Partida não encontrada' });
      const match = matches[0];

      const fields = match.field_id
        ? await sql(`SELECT name FROM fields WHERE id = $1`, [match.field_id])
        : [];

      const text = [
        `⚽ *Lembrete de Pelada!*`,
        `📅 ${match.date} às ${match.time || ''}`,
        fields.length ? `📍 ${fields[0].name}` : '',
        `👥 ${(match.confirmed_player_ids || '').split(',').filter(Boolean).length} confirmados`,
        '',
        `Confirme sua presença no Futgol!`,
      ].filter(Boolean).join('\n');

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      return res.status(200).json({ text, whatsappUrl });
    }

    res.status(400).json({ error: 'Tipo inválido. Use: match_summary ou match_reminder' });
  } catch (error: any) {
    console.error('WhatsApp share error:', error);
    res.status(500).json({ error: 'Erro ao gerar compartilhamento' });
  }
}
