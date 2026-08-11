import { describe, expect, it, vi } from 'vitest';
import { InstitutionReportsService } from './institution-reports.service';
import type {
  DismissalException,
  DismissalWindow,
  Enrollment,
  Institution,
  PickupRequest,
} from '@casillego/shared/entities';

function buildDismissalWindow(overrides: Partial<DismissalWindow>): DismissalWindow {
  return {
    id: 'dw-1',
    institutionId: 'inst-1',
    institution: { id: 'inst-1' } as Institution,
    weekday: 0,
    startTime: '13:00',
    endTime: '14:00',
    label: 'Salida vespertina',
    level: null,
    status: 'active',
    ...overrides,
  };
}

function buildDismissalException(overrides: Partial<DismissalException>): DismissalException {
  return {
    id: 'de-1',
    institutionId: 'inst-1',
    institution: { id: 'inst-1' } as Institution,
    date: '2026-07-20',
    name: 'Fin de cursos',
    level: null,
    time: '11:00',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildPickup(overrides: {
  startedAt: Date;
  completedAt: Date;
  gradeOrGroup?: string | null;
}): PickupRequest {
  return {
    id: `pickup-${Math.random()}`,
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    enrollment: { gradeOrGroup: overrides.gradeOrGroup ?? null } as Enrollment,
  } as PickupRequest;
}

interface BuildServiceOptions {
  arrivalToleranceMinutes?: number;
  activeStudentsCount?: number;
  pickups?: PickupRequest[];
  dismissalWindows?: DismissalWindow[];
  dismissalExceptions?: DismissalException[];
}

function buildService(options: BuildServiceOptions = {}) {
  const institutionsRepo = {
    findOne: vi
      .fn()
      .mockResolvedValue({ arrivalToleranceMinutes: options.arrivalToleranceMinutes ?? 10 }),
  };
  const enrollmentsRepo = {
    count: vi.fn().mockResolvedValue(options.activeStudentsCount ?? 0),
  };
  const queryBuilder: Record<string, unknown> = {
    getMany: vi.fn().mockResolvedValue(options.pickups ?? []),
  };
  for (const method of ['innerJoinAndSelect', 'where', 'andWhere']) {
    queryBuilder[method] = vi.fn(() => queryBuilder);
  }
  const pickupRequestsRepo = {
    createQueryBuilder: vi.fn(() => queryBuilder),
  };
  const dismissalWindowsRepo = {
    find: vi.fn().mockResolvedValue(options.dismissalWindows ?? []),
  };
  const dismissalExceptionsRepo = {
    find: vi.fn().mockResolvedValue(options.dismissalExceptions ?? []),
  };

  const service = new InstitutionReportsService(
    institutionsRepo as never,
    enrollmentsRepo as never,
    pickupRequestsRepo as never,
    dismissalWindowsRepo as never,
    dismissalExceptionsRepo as never,
  );
  return { service, enrollmentsRepo };
}

describe('InstitutionReportsService', () => {
  it('reports activeStudentsCount straight from the enrollments count, independent of the period', async () => {
    const { service } = buildService({ activeStudentsCount: 42, pickups: [] });
    const report = await service.get('inst-1', 'today');
    expect(report.activeStudentsCount).toBe(42);
  });

  it('answers null averagePickupDurationSeconds, null punctualityRate and an empty deliveriesByDay when nothing was delivered', async () => {
    const { service } = buildService({ pickups: [] });
    const report = await service.get('inst-1', 'last30Days');
    expect(report.averagePickupDurationSeconds).toBeNull();
    expect(report.punctualityRate).toBeNull();
    expect(report.deliveriesByDay).toEqual([]);
  });

  it('averages completedAt - startedAt across the delivered pickups', async () => {
    const pickups = [
      buildPickup({
        startedAt: new Date(2026, 6, 20, 13, 40),
        completedAt: new Date(2026, 6, 20, 13, 50),
      }),
      buildPickup({
        startedAt: new Date(2026, 6, 21, 13, 40),
        completedAt: new Date(2026, 6, 21, 14, 0),
      }),
    ];
    const { service } = buildService({ pickups });
    const report = await service.get('inst-1', 'last30Days');
    // 600s and 1200s -> average 900s.
    expect(report.averagePickupDurationSeconds).toBe(900);
  });

  it('groups deliveries by the calendar date of completedAt', async () => {
    const pickups = [
      buildPickup({
        startedAt: new Date(2026, 6, 20, 13, 0),
        completedAt: new Date(2026, 6, 20, 13, 30),
      }),
      buildPickup({
        startedAt: new Date(2026, 6, 20, 13, 5),
        completedAt: new Date(2026, 6, 20, 13, 40),
      }),
      buildPickup({
        startedAt: new Date(2026, 6, 21, 13, 0),
        completedAt: new Date(2026, 6, 21, 13, 30),
      }),
    ];
    const { service } = buildService({ pickups });
    const report = await service.get('inst-1', 'last30Days');
    expect(report.deliveriesByDay).toEqual([
      { date: '2026-07-20', count: 2 },
      { date: '2026-07-21', count: 1 },
    ]);
  });

  describe('punctualityRate (ADR-060 point 4)', () => {
    it('counts a delivery inside the tolerance window as on time', async () => {
      const completedAt = new Date(2026, 6, 20, 13, 5); // 5 min after the window's end.
      const weekday = completedAt.getDay();
      const pickups = [buildPickup({ startedAt: new Date(2026, 6, 20, 12, 50), completedAt })];
      const { service } = buildService({
        arrivalToleranceMinutes: 10,
        pickups,
        dismissalWindows: [buildDismissalWindow({ weekday, endTime: '13:00' })],
      });
      const report = await service.get('inst-1', 'last30Days');
      expect(report.punctualityRate).toBe(100);
    });

    it('counts a delivery past the tolerance window as late', async () => {
      const completedAt = new Date(2026, 6, 20, 13, 15); // 15 min after the window's end.
      const weekday = completedAt.getDay();
      const pickups = [buildPickup({ startedAt: new Date(2026, 6, 20, 12, 50), completedAt })];
      const { service } = buildService({
        arrivalToleranceMinutes: 10,
        pickups,
        dismissalWindows: [buildDismissalWindow({ weekday, endTime: '13:00' })],
      });
      const report = await service.get('inst-1', 'last30Days');
      expect(report.punctualityRate).toBe(0);
    });

    it('excludes a delivery with no resolvable window or exception from the rate, without counting it as late', async () => {
      const onTime = new Date(2026, 6, 20, 13, 5);
      const weekday = onTime.getDay();
      const unresolvable = new Date(2026, 6, 21, 13, 5); // Different weekday, no window defined for it.
      const pickups = [
        buildPickup({ startedAt: new Date(2026, 6, 20, 12, 50), completedAt: onTime }),
        buildPickup({ startedAt: new Date(2026, 6, 21, 12, 50), completedAt: unresolvable }),
      ];
      const { service } = buildService({
        arrivalToleranceMinutes: 10,
        pickups,
        dismissalWindows: [buildDismissalWindow({ weekday, endTime: '13:00' })],
      });
      const report = await service.get('inst-1', 'last30Days');
      // Only the resolvable one counts: 1/1 = 100%, not 1/2 = 50%.
      expect(report.punctualityRate).toBe(100);
    });

    it('prefers a level-specific dismissal_exception over a level = null one on the same date (ADR-018 pt.10 criterion)', async () => {
      // The specific-level exception ends at 13:00 (tight); the level = null one
      // ends at 14:00 (loose). A "Primaria" delivery at 13:15 should be matched
      // against the specific one and therefore counted late.
      const completedAt = new Date(2026, 6, 20, 13, 15);
      const pickups = [
        buildPickup({
          startedAt: new Date(2026, 6, 20, 12, 50),
          completedAt,
          gradeOrGroup: 'Primaria',
        }),
      ];
      const { service } = buildService({
        arrivalToleranceMinutes: 5,
        pickups,
        dismissalExceptions: [
          buildDismissalException({
            id: 'de-specific',
            date: '2026-07-20',
            level: 'Primaria',
            time: '13:00',
          }),
          buildDismissalException({ id: 'de-all', date: '2026-07-20', level: null, time: '14:00' }),
        ],
      });
      const report = await service.get('inst-1', 'last30Days');
      expect(report.punctualityRate).toBe(0);
    });

    it('falls back to the level = null dismissal_exception when no specific-level one matches the student', async () => {
      const completedAt = new Date(2026, 6, 20, 11, 5); // 5 min after the level=null exception's 11:00.
      const pickups = [
        buildPickup({
          startedAt: new Date(2026, 6, 20, 10, 50),
          completedAt,
          gradeOrGroup: 'Secundaria',
        }),
      ];
      const { service } = buildService({
        arrivalToleranceMinutes: 10,
        pickups,
        dismissalExceptions: [
          buildDismissalException({
            id: 'de-specific',
            date: '2026-07-20',
            level: 'Primaria',
            time: '13:00',
          }),
          buildDismissalException({ id: 'de-all', date: '2026-07-20', level: null, time: '11:00' }),
        ],
      });
      const report = await service.get('inst-1', 'last30Days');
      expect(report.punctualityRate).toBe(100);
    });

    it('an exception on the exact date wins over the recurring window', async () => {
      const completedAt = new Date(2026, 6, 20, 11, 5);
      const weekday = completedAt.getDay();
      const pickups = [buildPickup({ startedAt: new Date(2026, 6, 20, 10, 50), completedAt })];
      const { service } = buildService({
        arrivalToleranceMinutes: 10,
        pickups,
        // The recurring window would put this delivery an hour late...
        dismissalWindows: [buildDismissalWindow({ weekday, endTime: '10:00' })],
        // ...but the exception for this exact date says the window ended at 11:00.
        dismissalExceptions: [
          buildDismissalException({ date: '2026-07-20', level: null, time: '11:00' }),
        ],
      });
      const report = await service.get('inst-1', 'last30Days');
      expect(report.punctualityRate).toBe(100);
    });

    it('answers null when no delivery in the period has a resolvable window', async () => {
      const pickups = [
        buildPickup({
          startedAt: new Date(2026, 6, 20, 12, 50),
          completedAt: new Date(2026, 6, 20, 13, 5),
        }),
      ];
      const { service } = buildService({ pickups, dismissalWindows: [], dismissalExceptions: [] });
      const report = await service.get('inst-1', 'last30Days');
      expect(report.punctualityRate).toBeNull();
    });
  });
});
