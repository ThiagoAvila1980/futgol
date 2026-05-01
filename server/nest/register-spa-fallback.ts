import express from 'express';
import type { Application } from 'express';
import path from 'path';
import fs from 'fs';
import uploadsIndex from '../api/uploads/index';

/** Estáticos do cliente, uploads e fallback SPA — deve ser registrado por último. */
export function registerStaticAndSpaFallback(app: Application): void {
  const frontendDist = path.resolve(process.cwd(), '../client/dist');
  const indexHtml = path.join(frontendDist, 'index.html');
  const hasFrontend = fs.existsSync(indexHtml);

  if (hasFrontend) {
    app.use(express.static(frontendDist));
  }

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch {
    /* ignore */
  }
  app.use('/uploads', express.static(uploadsDir));

  app.post('/api/uploads', uploadsIndex);

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    if (hasFrontend) {
      res.sendFile(indexHtml);
    } else {
      res.status(404).send('Not Found (API Server)');
    }
  });
}
