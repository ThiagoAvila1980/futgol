import { clearAuthCookie } from './cookie';

export default function (req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }
  clearAuthCookie(res);
  res.status(200).json({ ok: true });
}
