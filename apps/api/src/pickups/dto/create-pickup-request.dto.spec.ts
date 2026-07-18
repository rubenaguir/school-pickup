import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreatePickupRequestDto } from './create-pickup-request.dto';

// Exercises the DTO's class-validator decorators directly — the same
// mechanism the global ValidationPipe (apps/api/src/main.ts) uses under the
// hood — without booting Nest or an HTTP server.
async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreatePickupRequestDto, plain);
  return validate(dto);
}

describe('CreatePickupRequestDto', () => {
  it('rejects arrivalMode "walking" combined with vehicleId', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      arrivalMode: 'walking',
      vehicleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects arrivalMode "walking" combined with vehicleDescription/vehiclePlate', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      arrivalMode: 'walking',
      vehicleDescription: 'Camioneta prestada blanca',
      vehiclePlate: 'XYZ-999',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('accepts arrivalMode "walking" alone, with no vehicle fields', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      arrivalMode: 'walking',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a catalog vehicle (vehicleId alone)', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      vehicleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a free-capture vehicle (vehicleDescription/vehiclePlate without vehicleId)', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      vehicleDescription: 'Camioneta prestada blanca',
      vehiclePlate: 'XYZ-999',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects vehicleId combined with vehicleDescription (regression, already rejected before this change)', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      vehicleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      vehicleDescription: 'Camioneta prestada blanca',
    });

    expect(errors).not.toHaveLength(0);
  });
});
