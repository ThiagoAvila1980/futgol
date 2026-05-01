import type { Application } from 'express';

/**
 * Rotas API ainda não migradas para controllers Nest (delegação direta aos handlers legados).
 * Deve ser chamado antes de nestApp.init() para preservar precedência sobre rotas Nest quando necessário.
 *
 * As rotas REST principais estão em `server/src/rest/rest.controllers.ts` (RestModule).
 */
export function registerLegacyExpressApiRoutes(_app: Application): void {
  // Intencionalmente vazio: rotas migradas para Nest (RestModule).
}
