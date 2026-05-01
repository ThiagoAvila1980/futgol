import fs from 'fs';
import path from 'path';
import { ready } from '../_db';
import type { AuthRequest } from '../middleware/auth';

export default async function (req: AuthRequest, res: any) {
  await ready();

  if (!req.user?.id) {
    res.statusCode = 401;
    res.end(JSON.stringify({ detail: 'Unauthorized' }));
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  let body: any = (req as any).body;
  if (!body || Object.keys(body).length === 0) {
    const chunks: any[] = [];
    for await (const chunk of req) chunks.push(chunk);
    try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
  }

  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'No files provided' }));
    return;
  }

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}

  const urls: string[] = [];
  for (const f of files) {
    const name = String(f.name || 'image');
    const dataUrl = String(f.dataUrl || '');
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) continue;
    const mime = match[1];
    const base64 = match[2];
    const ext = mime.split('/')[1] || 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${name.replace(/\s+/g, '_')}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    try {
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      urls.push(`/uploads/${filename}`);
    } catch (e: any) {
      // ignore single file failure
    }
  }

  if (!urls.length) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Failed to save files' }));
    return;
  }

  res.statusCode = 201;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ urls }));
}
