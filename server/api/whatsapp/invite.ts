import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const { groupId } = req.params;
    if (!groupId) return res.status(400).json({ error: 'groupId requerido' });

    const sql = await ready();
    const groups = await sql(`SELECT id, name, invite_code, sport, city FROM groups WHERE id = $1`, [groupId]);

    if (!groups.length) return res.status(404).json({ error: 'Grupo não encontrado' });
    const group = groups[0];

    const baseUrl = process.env.CLIENT_URL || 'https://futgol.app.br';
    const inviteLink = `${baseUrl}/join/${group.invite_code}`;

    const sportCityLine = [
      group.sport || '',
      group.city ? `em ${group.city}` : '',
    ].filter(Boolean).join(' ');

    const text = [
      `O grupo de futebol *${group.name}* te convidou para o grupo!`,
      sportCityLine,
      `Entre pelo link: ${baseUrl}`,
      `faça seu cadastro e busque pelo grupo ${group.name} para fazer parte da equipe!`,
    ].filter(Boolean).join('\n');

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

    res.status(200).json({ inviteLink, whatsappUrl, text, inviteCode: group.invite_code });
  } catch (error: any) {
    console.error('WhatsApp invite error:', error);
    res.status(500).json({ error: 'Erro ao gerar convite' });
  }
}
