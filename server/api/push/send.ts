import webpush from 'web-push';
import { ready } from '../_db';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@futgol.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export default async function (req: any, res: any) {
  try {
    const { title, body, targetPlayerIds, groupId } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Título e corpo são obrigatórios' });
    }

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return res.status(200).json({ success: true, sent: 0, message: 'VAPID keys não configuradas' });
    }

    const sql = await ready();
    let subs: any[];

    if (targetPlayerIds?.length) {
      const placeholders = targetPlayerIds.map((_: any, i: number) => `$${i + 1}`).join(',');
      subs = await sql(`SELECT * FROM push_subscriptions WHERE player_id IN (${placeholders})`, targetPlayerIds);
    } else if (groupId) {
      subs = await sql(
        `SELECT ps.* FROM push_subscriptions ps
         JOIN group_players gp ON gp.player_id = ps.player_id
         WHERE gp.group_id = $1`,
        [groupId]
      );
    } else {
      return res.status(400).json({ error: 'Especifique targetPlayerIds ou groupId' });
    }

    const payload = JSON.stringify({ title, body, icon: '/favicon.png', badge: '/favicon.png' });
    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        }, payload);
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410) {
          await sql(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
        }
      }
    }

    res.status(200).json({ success: true, sent });
  } catch (error: any) {
    console.error('Push send error:', error);
    res.status(500).json({ error: 'Erro ao enviar notificações' });
  }
}
