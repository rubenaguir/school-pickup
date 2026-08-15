import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import type { InstitutionStatus } from '@casillego/shared';
import {
  Enrollment,
  Institution,
  PickupRequest,
  StudentGuardian,
} from '@casillego/shared/entities';
import { resolveMetricsWindow, type MetricsWindow } from './metrics-window';
import type { AdminMetricsResponse, TopInstitutionByUsage } from './dto/responses';
import type { DeliveriesByDayEntry } from '../institution-reports/dto/responses';

const INSTITUTION_STATUS_VALUES: readonly InstitutionStatus[] = [
  'pending',
  'approved',
  'suspended',
];

/** ADR-038 point 5: the leaderboard is a top 5, not a full ranking. */
const TOP_INSTITUTIONS_LIMIT = 5;

/**
 * The six global metrics of feature 024, computed on the fly with
 * COUNT/AVG — no cache and no pre-aggregation in this phase (ADR-038 point 7).
 */
@Injectable()
export class AdminMetricsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(StudentGuardian)
    private readonly studentGuardiansRepository: Repository<StudentGuardian>,
    @InjectRepository(PickupRequest)
    private readonly pickupRequestsRepository: Repository<PickupRequest>,
  ) {}

  async get(now: Date = new Date()): Promise<AdminMetricsResponse> {
    const window = resolveMetricsWindow(now);
    // Independent of `window`: a fixed 14-day trailing window for the
    // deliveries chart, not the calendar-month comparison above (ADR-074
    // point 2 — the two serve different purposes).
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      institutionsByStatus,
      enrollmentsPending,
      registeredGuardiansCount,
      currentPeriod,
      previousPeriod,
      topInstitutionsByUsage,
      averagePickupDurationSeconds,
      recentDeliveries,
    ] = await Promise.all([
      this.countInstitutionsByStatus(),
      this.enrollmentsRepository.count({ where: { status: 'pending' } }),
      this.countRegisteredGuardians(),
      this.countPickupRequestsBetween(window.currentStart, window.currentEnd),
      this.countPickupRequestsBetween(window.previousStart, window.previousEnd),
      this.findTopInstitutionsByUsage(window),
      this.averagePickupDurationSeconds(window),
      this.pickupRequestsRepository.find({
        where: { status: 'delivered', completedAt: Between(fourteenDaysAgo, now) },
      }),
    ]);

    return {
      institutionsByStatus,
      pendingRequests: {
        enrollmentsPending,
        // Same number as institutionsByStatus.pending, exposed twice on
        // purpose: the super-admin works these two queues independently
        // (ADR-038 point 3).
        institutionsPendingApproval: institutionsByStatus.pending,
      },
      registeredGuardiansCount,
      pickupRequestsTotal: { currentPeriod, previousPeriod },
      topInstitutionsByUsage,
      averagePickupDurationSeconds,
      deliveriesByDay: this.deliveriesByDay(recentDeliveries),
    };
  }

  private async countInstitutionsByStatus(): Promise<Record<InstitutionStatus, number>> {
    const rows = await this.institutionsRepository
      .createQueryBuilder('institution')
      .select('institution.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('institution.status')
      .getRawMany<{ status: InstitutionStatus; count: string }>();

    // GROUP BY omits statuses with no rows; the contract always carries the
    // three keys, so they start at zero rather than going missing.
    const counts = Object.fromEntries(
      INSTITUTION_STATUS_VALUES.map((status) => [status, 0]),
    ) as Record<InstitutionStatus, number>;
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  /**
   * ADR-038 point 4: distinct users appearing as `guardian_user_id`, with no
   * filter on the link's own status — "registered" is deliberately broader
   * than "active".
   */
  private async countRegisteredGuardians(): Promise<number> {
    const row = await this.studentGuardiansRepository
      .createQueryBuilder('link')
      .select('COUNT(DISTINCT link.guardian_user_id)', 'count')
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private countPickupRequestsBetween(start: Date, end: Date): Promise<number> {
    return this.pickupRequestsRepository.count({ where: { startedAt: Between(start, end) } });
  }

  private async findTopInstitutionsByUsage(
    window: MetricsWindow,
  ): Promise<TopInstitutionByUsage[]> {
    const rows = await this.pickupRequestsRepository
      .createQueryBuilder('pickup')
      .innerJoin('pickup.institution', 'institution')
      .select('institution.id', 'institutionId')
      .addSelect('institution.name', 'name')
      .addSelect('COUNT(*)', 'pickupRequestsCount')
      .where('pickup.startedAt BETWEEN :start AND :end', {
        start: window.currentStart,
        end: window.currentEnd,
      })
      .groupBy('institution.id')
      .addGroupBy('institution.name')
      .orderBy('COUNT(*)', 'DESC')
      // Tie-break by name so the list is stable between calls; with COUNT
      // alone, equal counts come back in whatever order the plan produces.
      .addOrderBy('institution.name', 'ASC')
      .limit(TOP_INSTITUTIONS_LIMIT)
      .getRawMany<{ institutionId: string; name: string; pickupRequestsCount: string }>();

    return rows.map((row) => ({
      institutionId: row.institutionId,
      name: row.name,
      pickupRequestsCount: Number(row.pickupRequestsCount),
    }));
  }

  /**
   * ADR-038 point 6: `completed_at - started_at` averaged over the pickups
   * delivered in the window. `cancelled` and non-terminal states are out —
   * they never completed a real trip.
   */
  private async averagePickupDurationSeconds(window: MetricsWindow): Promise<number | null> {
    const row = await this.pickupRequestsRepository
      .createQueryBuilder('pickup')
      .select('AVG(EXTRACT(EPOCH FROM (pickup.completedAt - pickup.startedAt)))', 'averageSeconds')
      .where('pickup.status = :status', { status: 'delivered' })
      .andWhere('pickup.startedAt BETWEEN :start AND :end', {
        start: window.currentStart,
        end: window.currentEnd,
      })
      .getRawOne<{ averageSeconds: string | null }>();

    // AVG over an empty set is NULL, which is exactly the contract's "no data
    // to average" — not an error, not a zero.
    const average = row?.averageSeconds;
    if (average === null || average === undefined) return null;
    // Rounded to whole seconds: the raw AVG carries microsecond decimals that
    // mean nothing on a dashboard.
    return Math.round(Number(average));
  }

  /**
   * Same grouping as `InstitutionReportsService.deliveriesByDay`, platform-wide
   * instead of scoped to one institution. Duplicated rather than promoted to a
   * shared util: a 5-line function used in two places doesn't clear the "no
   * abstraction without a clear need" bar (ADR-036).
   */
  private deliveriesByDay(pickups: readonly PickupRequest[]): DeliveriesByDayEntry[] {
    const counts = new Map<string, number>();
    for (const pickup of pickups) {
      const date = toCalendarDate(pickup.completedAt!);
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, count]) => ({ date, count }));
  }
}

function toCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
