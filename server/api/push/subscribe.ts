import { ready } from '../_db';

export default async function (req: any, res: any) {
  try {
    const { subscription, playerId } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth || !playerId) {
      return res.status(400).json({ error: 'Dados de inscrição inválidos' });
    }

    const sql = await ready();
    const now = new Date().toISOString();

    await sql(
      `INSERT INTO push_subscriptions(player_id, endpoint, keys_p256dh, keys_auth, created_at)
       VALUES($1, $2, $3, $4, $5)
       ON CONFLICT(endpoint) DO UPDATE SET keys_p256dh = $3, keys_auth = $4`,
      [playerId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, now]
    );

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Erro ao registrar notificação' });
  }
}
