import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/create-validation-pipe';

try {
  process.loadEnvFile(join(__dirname, '../../../.env'));
} catch {
  // No .env file present (e.g. CI/prod inject env vars directly) — ignore.
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());

  // Native `ws`, not socket.io: the browser already speaks WebSocket and the
  // bridge needs no fallback transports or custom protocol (ADR-050 pt.1).
  // The gateway mounts on this same HTTP server under its own `path`, which
  // setGlobalPrefix does not touch.
  app.useWebSocketAdapter(new WsAdapter(app));

  // Explicit allowlist, never `origin: true` — the frontends are separate
  // origins in development (Vite) and behind nginx in production, where an
  // empty CORS_ORIGINS leaves this off entirely because everything is
  // same-origin. `credentials: false`: tokens travel in the Authorization
  // header, not in cookies. See ADR-043 point 1.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: false });
  }

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);

  Logger.log(`CasiLlego API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
