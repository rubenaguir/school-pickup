import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { describe, expect, it, vi } from 'vitest';
import { PurgeService } from './purge.service';

// Mirrors @nestjs/schedule's internal metadata key (schedule.constants.ts);
// not re-exported from the package's public entrypoint, so it's duplicated
// here rather than deep-importing dist internals.
const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';

function buildQueryBuilder(affected: number) {
  const state: { sql?: string; params?: Record<string, unknown> } = {};
  const qb = {
    delete: vi.fn(() => qb),
    from: vi.fn(() => qb),
    where: vi.fn((sql: string, params: Record<string, unknown>) => {
      state.sql = sql;
      state.params = params;
      return qb;
    }),
    execute: vi.fn(() => Promise.resolve({ affected })),
  };
  return { qb, state };
}

function buildService(affected: number) {
  const { qb, state } = buildQueryBuilder(affected);
  const locationUpdateRepo = { createQueryBuilder: vi.fn(() => qb) };
  const service = new PurgeService(locationUpdateRepo as never);
  return { service, qb, state };
}

describe('PurgeService', () => {
  it('deletes location_updates for pickup_requests completed more than 90 days ago', async () => {
    const { service, qb, state } = buildService(12);

    await service.purgeExpiredLocationUpdates();

    expect(qb.delete).toHaveBeenCalled();
    expect(qb.from).toHaveBeenCalled();
    expect(state.sql).toContain('completed_at < :cutoff');

    const cutoff = state.params?.cutoff as Date;
    const expectedCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
  });

  it('does not purge location_updates for pickup_requests completed less than 90 days ago', async () => {
    const { service, state } = buildService(0);

    await service.purgeExpiredLocationUpdates();

    // Postgres, not this service, applies `completed_at < cutoff`: a
    // pickup_request completed 10 days ago is on the wrong side of the
    // cutoff and never matches the subquery.
    const cutoff = state.params?.cutoff as Date;
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(tenDaysAgo.getTime()).toBeGreaterThan(cutoff.getTime());
  });

  it('never purges location_updates for still-active pickup_requests (completed_at IS NULL)', async () => {
    const { service, state } = buildService(0);

    await service.purgeExpiredLocationUpdates();

    expect(state.sql).toContain('completed_at IS NOT NULL');
  });

  it('registers the cron job with the daily early-morning expression', () => {
    // Reflection lookup of decorator metadata, not an unbound call.
    /* eslint-disable @typescript-eslint/unbound-method */
    const cronOptions = Reflect.getMetadata(
      SCHEDULE_CRON_OPTIONS,
      PurgeService.prototype.purgeExpiredLocationUpdates,
    ) as { cronTime: string } | undefined;
    /* eslint-enable @typescript-eslint/unbound-method */

    expect(cronOptions?.cronTime).toBe(CronExpression.EVERY_DAY_AT_3AM);
  });

  it('logs the number of purged rows', async () => {
    const { service } = buildService(7);
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await service.purgeExpiredLocationUpdates();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('7'));
    logSpy.mockRestore();
  });
});
