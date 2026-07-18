import type { Server } from 'node:http';
import {
  Body,
  Controller,
  ForbiddenException,
  Module,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createValidationPipe } from './create-validation-pipe';
import { CreatePickupRequestDto } from '../pickups/dto/create-pickup-request.dto';
import { CreateEnrollmentDto } from '../enrollments/dto/create-enrollment.dto';

interface ErrorResponseBody {
  code?: string;
  message?: string;
  details?: Array<{ property: string; constraints: string[] }>;
}

@Controller('probe')
class ProbeController {
  @Post('pickup-requests')
  createPickupRequest(@Body() dto: CreatePickupRequestDto): CreatePickupRequestDto {
    return dto;
  }

  @Post('enrollments')
  createEnrollment(@Body() dto: CreateEnrollmentDto): CreateEnrollmentDto {
    return dto;
  }

  @Post('forbidden')
  throwForbidden(): never {
    throw new ForbiddenException({ code: 'X', message: 'y' });
  }

  @Post('unprocessable')
  throwUnprocessable(): never {
    throw new UnprocessableEntityException({ code: 'X', message: 'y' });
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

// Exercises the real createValidationPipe() — the same factory main.ts uses
// — against real DTOs via supertest, without booting the real AppModule
// (which needs live Postgres + MQTT).
describe('createValidationPipe', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, { logger: false });
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('populates details with the real field and constraint for walking + vehicleId', async () => {
    const res = await request(httpServer).post('/probe/pickup-requests').send({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      arrivalMode: 'walking',
      vehicleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    const body = res.body as ErrorResponseBody;

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_PAYLOAD');
    expect(body.details).toContainEqual({
      property: 'enrollmentId',
      constraints: [
        'arrivalMode "walking" cannot be combined with vehicleId, vehicleDescription, or vehiclePlate.',
      ],
    });
  });

  it('populates details with the real field and constraint for a different DTO (CreateEnrollmentDto)', async () => {
    const res = await request(httpServer).post('/probe/enrollments').send({
      studentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    const body = res.body as ErrorResponseBody;

    expect(res.status).toBe(400);
    expect(body.details).toContainEqual({
      property: 'studentId',
      constraints: ['Exactly one of institutionId or joinCode must be provided.'],
    });
  });

  it('populates details for a plain missing field with no custom validator', async () => {
    const res = await request(httpServer).post('/probe/pickup-requests').send({});
    const body = res.body as ErrorResponseBody;

    expect(res.status).toBe(400);
    const enrollmentIdDetail = (body.details ?? []).find(
      (detail) => detail.property === 'enrollmentId',
    );
    expect(enrollmentIdDetail).toBeDefined();
    expect(enrollmentIdDetail?.constraints.length).toBeGreaterThan(0);
  });

  it('does not add a details field to a ForbiddenException thrown directly by a controller', async () => {
    const res = await request(httpServer).post('/probe/forbidden').send();
    const body = res.body as ErrorResponseBody;

    expect(res.status).toBe(403);
    expect(body).toEqual({ code: 'X', message: 'y' });
    expect(body.details).toBeUndefined();
  });

  it('does not add a details field to an UnprocessableEntityException thrown directly by a controller', async () => {
    const res = await request(httpServer).post('/probe/unprocessable').send();
    const body = res.body as ErrorResponseBody;

    expect(res.status).toBe(422);
    expect(body).toEqual({ code: 'X', message: 'y' });
    expect(body.details).toBeUndefined();
  });
});
