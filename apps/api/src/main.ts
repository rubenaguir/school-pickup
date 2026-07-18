import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
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

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);

  Logger.log(`CasiLlego API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
