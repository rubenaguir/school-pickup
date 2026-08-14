import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListPickupRequestsQueryDto } from './list-pickup-requests-query.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListPickupRequestsQueryDto, plain);
  return validate(dto);
}

describe('ListPickupRequestsQueryDto', () => {
  it('accepts a valid enrollmentId with no other fields', async () => {
    const errors = await validateDto({ enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });

    expect(errors).toHaveLength(0);
  });

  it('accepts a valid deliveryPointId with no other fields', async () => {
    const errors = await validateDto({ deliveryPointId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });

    expect(errors).toHaveLength(0);
  });

  it('accepts a valid institutionId with no other fields', async () => {
    const errors = await validateDto({ institutionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' });

    expect(errors).toHaveLength(0);
  });

  it('rejects none of enrollmentId/deliveryPointId/institutionId', async () => {
    const errors = await validateDto({});

    expect(errors).not.toHaveLength(0);
  });

  // Multiple filters present is not "the first one wins": each mode has
  // different authorization rules, so an ambiguous request must be rejected.
  it('rejects enrollmentId and deliveryPointId together', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      deliveryPointId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects deliveryPointId and institutionId together', async () => {
    const errors = await validateDto({
      deliveryPointId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      institutionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects all three at once', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      deliveryPointId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      institutionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects an enrollmentId that is not a UUID', async () => {
    const errors = await validateDto({ enrollmentId: 'not-a-uuid' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a deliveryPointId that is not a UUID', async () => {
    const errors = await validateDto({ deliveryPointId: 'not-a-uuid' });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects an institutionId that is not a UUID', async () => {
    const errors = await validateDto({ institutionId: 'not-a-uuid' });

    expect(errors).not.toHaveLength(0);
  });

  it('accepts status/limit/offset alongside deliveryPointId', async () => {
    const errors = await validateDto({
      deliveryPointId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'arrived',
      limit: '10',
      offset: '0',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts status/limit/offset alongside institutionId', async () => {
    const errors = await validateDto({
      institutionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      status: 'arriving',
      limit: '10',
      offset: '0',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a status within the enum', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'delivered',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a status outside the enum', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'not-a-status',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('coerces limit and offset query strings to numbers', async () => {
    const dto = plainToInstance(ListPickupRequestsQueryDto, {
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      limit: '10',
      offset: '20',
    });

    expect(dto.limit).toBe(10);
    expect(dto.offset).toBe(20);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-integer limit', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      limit: '1.5',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a limit below 1', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      limit: '0',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a negative offset', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      offset: '-1',
    });

    expect(errors).not.toHaveLength(0);
  });

  it('accepts an offset of 0', async () => {
    const errors = await validateDto({
      enrollmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      offset: '0',
    });

    expect(errors).toHaveLength(0);
  });
});
