import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ensureSchema } from '../api/_db';
import { applyGlobalMiddleware } from '../nest/apply-global-middleware';
import { registerLegacyExpressApiRoutes } from '../nest/register-legacy-routes';
import { registerStaticAndSpaFallback } from '../nest/register-spa-fallback';

async function bootstrap() {
  await ensureSchema();

  const expressApp = express();
  applyGlobalMiddleware(expressApp);
  registerLegacyExpressApiRoutes(expressApp);

  const adapter = new ExpressAdapter(expressApp);
  const nestApp = await NestFactory.create(AppModule, adapter, {
    bufferLogs: true,
    bodyParser: false,
  });

  await nestApp.init();
  registerStaticAndSpaFallback(expressApp);

  const port = Number(process.env.PORT || 3001);
  await nestApp.listen(port, '0.0.0.0');
  console.log(`Futgol API (NestJS + Express) em http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});
