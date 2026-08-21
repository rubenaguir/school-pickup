import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DismissalException,
  DismissalWindow,
  Enrollment,
  Institution,
  PickupRequest,
} from '@casillego/shared/entities';
import { resolveDeadline, resolveDismissalWindowEnd } from './punctuality';
import { resolveReportWindow, type ReportPeriod } from './report-period';
import type { DeliveriesByDayEntry, InstitutionReportsResponse } from './dto/responses';

@Injectable()
export class InstitutionReportsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(PickupRequest)
    private readonly pickupRequestsRepository: Repository<PickupRequest>,
    @InjectRepository(DismissalWindow)
    private readonly dismissalWindowsRepository: Repository<DismissalWindow>,
    @InjectRepository(DismissalException)
    private readonly dismissalExceptionsRepository: Repository<DismissalException>,
  ) {}

  async get(
    institutionId: string,
    period: ReportPeriod,
    now: Date = new Date(),
  ): Promise<InstitutionReportsResponse> {
    const window = resolveReportWindow(period, now);

    const [
      institution,
      activeStudentsCount,
      deliveredPickups,
      dismissalWindows,
      dismissalExceptions,
    ] = await Promise.all([
      this.institutionsRepository.findOne({ where: { id: institutionId } }),
      // ADR-060 point 3: today's census, independent of `period`.
      this.enrollmentsRepository.count({
        where: { institution: { id: institutionId }, status: 'approved' },
      }),
      this.pickupRequestsRepository
        .createQueryBuilder('pickup')
        .innerJoinAndSelect('pickup.enrollment', 'enrollment')
        .leftJoinAndSelect('enrollment.group', 'group')
        .where('pickup.institution = :institutionId', { institutionId })
        .andWhere('pickup.status = :status', { status: 'delivered' })
        .andWhere('pickup.completedAt BETWEEN :start AND :end', {
          start: window.start,
          end: window.end,
        })
        .getMany(),
      this.dismissalWindowsRepository.find({
        where: { institution: { id: institutionId }, status: 'active' },
      }),
      this.dismissalExceptionsRepository.find({ where: { institution: { id: institutionId } } }),
    ]);

    const arrivalToleranceMinutes = institution?.arrivalToleranceMinutes ?? 0;

    return {
      period,
      averagePickupDurationSeconds: this.averagePickupDurationSeconds(deliveredPickups),
      activeStudentsCount,
      punctualityRate: this.punctualityRate(
        deliveredPickups,
        dismissalWindows,
        dismissalExceptions,
        arrivalToleranceMinutes,
      ),
      deliveriesByDay: this.deliveriesByDay(deliveredPickups),
    };
  }

  /** Same definition as ADR-038 point 6, acotado a esta institución y periodo. */
  private averagePickupDurationSeconds(pickups: readonly PickupRequest[]): number | null {
    if (pickups.length === 0) return null;
    const totalSeconds = pickups.reduce(
      (sum, pickup) => sum + (pickup.completedAt!.getTime() - pickup.startedAt.getTime()) / 1000,
      0,
    );
    return Math.round(totalSeconds / pickups.length);
  }

  /**
   * ADR-060 point 4. A pickup with no resolvable window/exception is skipped
   * entirely — it counts toward neither the numerator nor the denominator.
   */
  private punctualityRate(
    pickups: readonly PickupRequest[],
    dismissalWindows: readonly DismissalWindow[],
    dismissalExceptions: readonly DismissalException[],
    arrivalToleranceMinutes: number,
  ): number | null {
    let resolvableCount = 0;
    let onTimeCount = 0;

    for (const pickup of pickups) {
      const completedAt = pickup.completedAt!;
      const date = toCalendarDate(completedAt);
      const weekday = completedAt.getDay();
      const level = pickup.enrollment.group?.name ?? null;

      const windowEnd = resolveDismissalWindowEnd(
        date,
        weekday,
        level,
        dismissalExceptions,
        dismissalWindows,
      );
      if (windowEnd === null) continue;

      resolvableCount += 1;
      const deadline = resolveDeadline(date, windowEnd, arrivalToleranceMinutes);
      if (completedAt.getTime() <= deadline.getTime()) {
        onTimeCount += 1;
      }
    }

    if (resolvableCount === 0) return null;
    return Math.round((onTimeCount / resolvableCount) * 100);
  }

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
