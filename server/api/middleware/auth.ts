import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME } from '../auth/cookie';
import { getJwtSecret } from '../jwtSecret';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; name: string; role: string };
}

const JWT_SECRET = getJwtSecret();

const PUBLIC_ROUTES = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/teams',
  '/api/positions',
  '/api/fields/search',
];

function isPublicRoute(req: Request): boolean {
  const fullPath = `${req.baseUrl}${req.path}`.replace(/\/+$/, '');
  return PUBLIC_ROUTES.includes(fullPath);
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next();
  if (isPublicRoute(req)) return next();

  const auth = String(req.headers['authorization'] || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const fromCookie =
    req.cookies && typeof req.cookies[AUTH_COOKIE_NAME] === 'string'
      ? String(req.cookies[AUTH_COOKIE_NAME])
      : '';
  const token = fromCookie || bearer;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação requerido' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: String(payload.sub || ''),
      email: String(payload.email || ''),
      name: String(payload.name || ''),
      role: String(payload.role || 'user'),
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}
