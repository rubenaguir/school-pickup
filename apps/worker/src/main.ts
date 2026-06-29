import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * The worker is a long-running NestJS standalone application context (no HTTP
 * server). It will subscribe to the MQTT broker and compute ETAs; for now it
 * just boots the module graph.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  Logger.log('CasiLlego worker started', 'Bootstrap');
}

void bootstrap();
