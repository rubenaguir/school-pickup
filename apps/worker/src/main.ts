import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

try {
  process.loadEnvFile(join(__dirname, '../../../.env'));
} catch {
  // No .env file present (e.g. CI/prod inject env vars directly) — ignore.
}

/**
 * The worker is a long-running NestJS standalone application context (no HTTP
 * server). It subscribes to the MQTT broker and computes ETAs.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  Logger.log('CasiLlego worker started', 'Bootstrap');
}

void bootstrap();
