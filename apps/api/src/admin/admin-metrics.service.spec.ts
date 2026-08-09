import { describe, expect, it, vi } from 'vitest';
import { AdminMetricsService } from './admin-metrics.service';

interface QueryBuilderResult {
  rawMany?: unknown[];
  rawOne?: unknown;
}

/**
 * Minimal chainable stand-in for TypeORM's QueryBuilder: every method returns
 * itself and the terminal getters answer whatever the test staged.
 */
function buildQueryBuilder(result: QueryBuilderResult) {
  const builder: Record<string, unknown> = {
    getRawMany: vi.fn().mockResolvedValue(result.rawMany ?? []),
    getRawOne: vi.fn().mockResolvedValue(result.rawOne),
  };
  for (const method of [
    'select',
    'addSelect',
    'innerJoin',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
    'limit',
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

function buildService(options?: {
  institutionRows?: { status: string; count: string }[];
  enrollmentsPending?: number;
  guardiansCount?: string | undefined;
  pickupCounts?: number[];
  topRows?: { institutionId: string; name: string; pickupRequestsCount: string }[];
  averageSeconds?: string | null;
}) {
  const institutionsRepo = {
    createQueryBuilder: vi.fn(() => buildQueryBuilder({ rawMany: options?.institutionRows ?? [] })),
  };
  const enrollmentsRepo = {
    count: vi.fn().mockResolvedValue(options?.enrollmentsPending ?? 0),
  };
  const studentGuardiansRepo = {
    createQueryBuilder: vi.fn(() =>
      buildQueryBuilder({ rawOne: { count: options?.guardiansCount ?? '0' } }),
    ),
  };

  const pickupCounts = options?.pickupCounts ?? [0, 0];
  let countCall = 0;
  const pickupRequestsRepo = {
    count: vi.fn(() => Promise.resolve(pickupCounts[countCall++] ?? 0)),
    createQueryBuilder: vi
      .fn()
      // First call is the top-5 leaderboard, second is the average.
      .mockImplementationOnce(() => buildQueryBuilder({ rawMany: options?.topRows ?? [] }))
      .mockImplementationOnce(() =>
        buildQueryBuilder({
          rawOne: { averageSeconds: options?.averageSeconds ?? null },
        }),
      ),
  };

  const service = new AdminMetricsService(
    institutionsRepo as never,
    enrollmentsRepo as never,
    studentGuardiansRepo as never,
    pickupRequestsRepo as never,
  );
  return { service, enrollmentsRepo, pickupRequestsRepo };
}

describe('AdminMetricsService', () => {
  it('returns the six metric groups of feature 024', async () => {
    const { service } = buildService({
      institutionRows: [
        { status: 'approved', count: '7' },
        { status: 'pending', count: '2' },
      ],
      enrollmentsPending: 11,
      guardiansCount: '43',
      pickupCounts: [120, 95],
      topRows: [{ institutionId: 'inst-1', name: 'Colegio A', pickupRequestsCount: '60' }],
      averageSeconds: '431.68',
    });

    const metrics = await service.get(new Date(2026, 6, 19, 12, 0, 0));

    expect(metrics).toEqual({
      institutionsByStatus: { pending: 2, approved: 7, suspended: 0 },
      pendingRequests: { enrollmentsPending: 11, institutionsPendingApproval: 2 },
      registeredGuardiansCount: 43,
      pickupRequestsTotal: { currentPeriod: 120, previousPeriod: 95 },
      topInstitutionsByUsage: [
        { institutionId: 'inst-1', name: 'Colegio A', pickupRequestsCount: 60 },
      ],
      averagePickupDurationSeconds: 432,
    });
  });

  it('reports every status, including those with no institutions', async () => {
    const { service } = buildService({ institutionRows: [{ status: 'pending', count: '3' }] });
    const metrics = await service.get(new Date(2026, 6, 19));
    expect(metrics.institutionsByStatus).toEqual({ pending: 3, approved: 0, suspended: 0 });
  });

  it('answers null for the average when nothing was delivered in the window', async () => {
    const { service } = buildService({ averageSeconds: null });
    const metrics = await service.get(new Date(2026, 6, 19));
    expect(metrics.averagePickupDurationSeconds).toBeNull();
  });

  it('reports a previous period of zero without failing the comparison', async () => {
    // Feature 024, third case: a brand-new month with no history is 0, not an
    // error and not a division by zero.
    const { service } = buildService({ pickupCounts: [8, 0] });
    const metrics = await service.get(new Date(2026, 6, 19));
    expect(metrics.pickupRequestsTotal).toEqual({ currentPeriod: 8, previousPeriod: 0 });
  });

  it('counts the two pickup periods over disjoint windows', async () => {
    const { service, pickupRequestsRepo } = buildService({ pickupCounts: [5, 4] });
    await service.get(new Date(2026, 6, 19, 12, 0, 0));

    // Between(start, end) keeps both bounds in the operator's public `value`.
    const [current, previous] = pickupRequestsRepo.count.mock.calls.map(
      ([arg]: [{ where: { startedAt: { value: [Date, Date] } } }]) => arg.where.startedAt.value,
    );
    expect(current[0]).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(previous[0]).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
    expect(previous[1].getTime()).toBeLessThan(current[0].getTime());
  });
});
