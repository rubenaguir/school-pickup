import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { DeliverPickupRequestDto } from './deliver-pickup-request.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(DeliverPickupRequestDto, plain);
  return validate(dto);
}

describe('DeliverPickupRequestDto', () => {
  it('accepts a valid 4-digit deliveryCode', async () => {
    const errors = await validateDto({ deliveryCode: '1234' });

    expect(errors).toHaveLength(0);
  });

  it('accepts a deliveryCode with leading zeros', async () => {
    const errors = await validateDto({ deliveryCode: '0042' });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing deliveryCode', async () => {
    const errors = await validateDto({});

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a deliveryCode shorter than 4 digits', async () => {
    const errors = await validateDto({ deliveryCode: '123' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a deliveryCode longer than 4 digits', async () => {
    const errors = await validateDto({ deliveryCode: '12345' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a deliveryCode with non-digit characters', async () => {
    const errors = await validateDto({ deliveryCode: 'abcd' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a numeric deliveryCode (must be a string)', async () => {
    const errors = await validateDto({ deliveryCode: 1234 });

    expect(errors).not.toHaveLength(0);
  });
});
