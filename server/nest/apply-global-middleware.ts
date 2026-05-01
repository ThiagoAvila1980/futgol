import express from 'express';
import type { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../api/middleware/auth';

/** Middleware global aplicado antes de qualquer rota Nest ou Express legada. */
export function applyGlobalMiddleware(app: Application): void {
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

  app.use(
    cors({
      origin:
        process.env.NODE_ENV === 'production'
          ? [process.env.CLIENT_URL || 'https://futgol.app']
          : true,
      credentials: true,
    }),
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    /** SPA pode disparar várias leituras em rajada (bundle paralelo); default maior evita 429 em uso normal. */
    max: Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? 600),
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/', apiLimiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use((req, res, next) => {
    if (req.path !== '/' && req.path.endsWith('/')) {
      req.url = req.url.replace(/\/+$/, '');
    }
    next();
  });

  app.use('/api', authMiddleware as express.RequestHandler);
}
