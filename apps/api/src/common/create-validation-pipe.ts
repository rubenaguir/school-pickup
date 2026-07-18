import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { toInvalidPayloadDetails } from './validation-error.util';

// Extracted out of main.ts so it can be exercised with supertest against a
// throwaway controller/module, without booting the real AppModule (which
// requires live Postgres + MQTT to start).
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'The request payload is invalid.',
        details: toInvalidPayloadDetails(errors),
      }),
  });
}
