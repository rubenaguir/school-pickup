import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { ResendVerificationThrottlerGuard } from './guards/resend-verification-throttler.guard';

// Scaled-down windows (milliseconds instead of hour/60s) so the test exercises
// the same "N per window AND cooldown between consecutive" guard logic as the
// real /auth/resend-verification route without waiting a real hour.
const HOURLY_TTL_MS = 300;
const COOLDOWN_TTL_MS = 50;

@Controller('test')
class TestController {
  @UseGuards(ResendVerificationThrottlerGuard)
  @Throttle({
    hourly: { limit: 3, ttl: HOURLY_TTL_MS },
    cooldown: { limit: 1, ttl: COOLDOWN_TTL_MS },
  })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() body: { email: string }): { message: string } {
    return { message: `sent to ${body.email}` };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ResendVerificationThrottlerGuard (HTTP)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'hourly', ttl: HOURLY_TTL_MS, limit: 3 },
          { name: 'cooldown', ttl: COOLDOWN_TTL_MS, limit: 1 },
        ]),
      ],
      controllers: [TestController],
      providers: [ResendVerificationThrottlerGuard],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows up to 3 requests per window, spaced past the cooldown, then rejects the 4th with 429', async () => {
    const email = 'hourly-limit@example.com';

    for (let i = 0; i < 3; i++) {
      const res = await request(server).post('/test/resend-verification').send({ email });
      expect(res.status).toBe(200);
      await sleep(COOLDOWN_TTL_MS + 10);
    }

    const fourth = await request(server).post('/test/resend-verification').send({ email });
    expect(fourth.status).toBe(429);
    expect(fourth.body).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  }, 10_000);

  it('rejects a second request for the same email inside the cooldown window, even under the hourly limit', async () => {
    const email = 'cooldown@example.com';

    const first = await request(server).post('/test/resend-verification').send({ email });
    expect(first.status).toBe(200);

    const second = await request(server).post('/test/resend-verification').send({ email });
    expect(second.status).toBe(429);
    expect(second.body).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('tracks limits per email independently', async () => {
    const a = await request(server)
      .post('/test/resend-verification')
      .send({ email: 'a@example.com' });
    const b = await request(server)
      .post('/test/resend-verification')
      .send({ email: 'b@example.com' });

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });
});
